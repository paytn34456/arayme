"""LABME local school server  -  Python 3 + SQLite, no extra packages needed.
Run START_LABME.bat (or: python app.py). Serves http://0.0.0.0:8080 to every device on the same Wi-Fi."""
import base64, hashlib, json, mimetypes, os, queue, secrets, socket, sqlite3, ssl, sys, threading, time
from datetime import datetime, timedelta, timezone
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

BASE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.realpath(os.path.join(BASE, "static"))
DB_PATH = os.path.join(BASE, "labme.db")
HOST, HTTP_PORT, PORT = "0.0.0.0", 8080, 8443   # PORT = secure (HTTPS) port; 8080 redirects to it
CERT, KEY, CERT_IPS = (os.path.join(BASE, n) for n in ("labme-cert.pem", "labme-key.pem", "labme-cert.ips"))
CTX = None
KEYS = {"users", "equip", "tx", "att", "logs"}   # same data groups the LABME website already uses
MAX_BODY = 4_000_000
db_lock = threading.Lock()
listeners, listeners_lock = set(), threading.Lock()

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

def connect():
    c = sqlite3.connect(DB_PATH, timeout=15)
    c.execute("PRAGMA journal_mode=WAL")
    return c

def init_db():
    with db_lock, closing(connect()) as c:
        c.execute("CREATE TABLE IF NOT EXISTS shards (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated REAL NOT NULL)")
        c.commit()

def db_get(k):
    with db_lock, closing(connect()) as c:
        r = c.execute("SELECT v FROM shards WHERE k=?", (k,)).fetchone()
    return r[0] if r else None

def db_put(k, v):
    with db_lock, closing(connect()) as c:
        c.execute("INSERT INTO shards(k,v,updated) VALUES(?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated=excluded.updated", (k, v, time.time()))
        c.commit()

def broadcast(k, v):
    msg = ("event: doc\ndata: " + json.dumps({"k": k, "data": {"v": v}}) + "\n\n").encode("utf-8")
    with listeners_lock:
        for q in list(listeners):
            try: q.put_nowait(msg)
            except queue.Full: pass

def lan_ips():
    found = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))        # no packet is sent; just asks the OS which adapter is used
        found.append(s.getsockname()[0]); s.close()
    except Exception:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if ip not in found: found.append(ip)
    except Exception:
        pass
    good = [i for i in found if not i.startswith(("127.", "169.254."))]
    def rank(i):
        if i.startswith("192.168."): return 0
        if i.startswith("10."): return 1
        if i.startswith("172."): return 2
        return 3
    return sorted(good, key=rank)

IPS = lan_ips()
SERVER_URL = "http://%s:%d" % (IPS[0] if IPS else "127.0.0.1", HTTP_PORT)


# ---------- self-signed certificate (pure Python; no OpenSSL or extra packages needed) ----------
def _der(tag, body): 
    n = len(body)
    l = bytes([n]) if n < 128 else (bytes([0x80 | (len(x := n.to_bytes((n.bit_length() + 7) // 8, "big")))]) + x)
    return bytes([tag]) + l + body
def _int(v): 
    b = v.to_bytes(max(1, (v.bit_length() + 8) // 8), "big"); return _der(2, b)
def _seq(*p): return _der(0x30, b"".join(p))
def _oid(o):
    p = [int(x) for x in o.split(".")]; b = bytes([p[0] * 40 + p[1]])
    for v in p[2:]:
        c = [v & 127]; v >>= 7
        while v: c.append(0x80 | (v & 127)); v >>= 7
        b += bytes(reversed(c))
    return _der(6, b)
def _is_prime(n):
    if n < 4: return n in (2, 3)
    for sp in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        if n % sp == 0: return n == sp
    d, r = n - 1, 0
    while d % 2 == 0: d //= 2; r += 1
    for _ in range(20):
        x = pow(secrets.randbelow(n - 3) + 2, d, n)
        if x in (1, n - 1): continue
        for _ in range(r - 1):
            x = x * x % n
            if x == n - 1: break
        else: return False
    return True
def _prime(bits):
    while True:
        c = secrets.randbits(bits) | (3 << (bits - 2)) | 1
        if _is_prime(c) and (c - 1) % 65537: return c
def _pem(label, der):
    b = base64.b64encode(der).decode()
    return "-----BEGIN %s-----\n%s\n-----END %s-----\n" % (label, "\n".join(b[i:i + 64] for i in range(0, len(b), 64)), label)
def make_cert(ips):
    e = 65537
    while True:
        p, q = _prime(1024), _prime(1024)
        if p != q: break
    n, phi = p * q, (p - 1) * (q - 1)
    d = pow(e, -1, phi)
    key = _seq(_int(0), _int(n), _int(e), _int(d), _int(p), _int(q), _int(d % (p - 1)), _int(d % (q - 1)), _int(pow(q, -1, p)))
    alg = _seq(_oid("1.2.840.113549.1.1.11"), _der(5, b""))
    name = _seq(_der(0x31, _seq(_oid("2.5.4.3"), _der(0x0C, b"LABME Local Server"))))
    now = datetime.now(timezone.utc) - timedelta(days=1)
    t = lambda x: _der(0x17, x.strftime("%y%m%d%H%M%SZ").encode())
    san = _seq(_der(0x82, b"localhost"), *[_der(0x87, bytes(int(x) for x in ip.split("."))) for ip in ips])
    ext = _der(0xA3, _seq(
        _seq(_oid("2.5.29.17"), _der(4, san)),
        _seq(_oid("2.5.29.19"), _der(1, b"\xff"), _der(4, _seq())) if False else _seq(_oid("2.5.29.19"), _der(4, _seq())),
        _seq(_oid("2.5.29.37"), _der(4, _seq(_oid("1.3.6.1.5.5.7.3.1"))))))
    tbs = _seq(_der(0xA0, _int(2)), _int(secrets.randbits(63) | 1), alg, name, _seq(t(now), t(now + timedelta(days=800))), name,
               _seq(_seq(_oid("1.2.840.113549.1.1.1"), _der(5, b"")), _der(3, b"\x00" + _seq(_int(n), _int(e)))), ext)
    di = bytes.fromhex("3031300d060960864801650304020105000420") + hashlib.sha256(tbs).digest()
    em = b"\x00\x01" + b"\xff" * (256 - len(di) - 3) + b"\x00" + di
    sig = pow(int.from_bytes(em, "big"), d, n).to_bytes(256, "big")
    return _pem("CERTIFICATE", _seq(tbs, alg, _der(3, b"\x00" + sig))), _pem("RSA PRIVATE KEY", key)

def setup_tls():
    """Create (once) and load a certificate that covers this PC's Wi-Fi address(es)."""
    global CTX
    try:
        want = sorted(IPS)
        have = open(CERT_IPS).read().split() if os.path.exists(CERT_IPS) and os.path.exists(CERT) and os.path.exists(KEY) else None
        if have is None or not set(want) <= set(have):
            print("   Creating secure certificate (first run takes a few seconds)...")
            c, k = make_cert(want)
            open(CERT, "w").write(c); open(KEY, "w").write(k); open(CERT_IPS, "w").write(" ".join(want))
        CTX = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        CTX.load_cert_chain(CERT, KEY)
        return True
    except Exception as ex:
        print("   (HTTPS unavailable: %s) - running without HTTPS." % ex); CTX = None; return False

class Handler(BaseHTTPRequestHandler):
    server_version = "LABME"
    def log_message(self, *a): pass
    def setup(self):
        if isinstance(self.request, ssl.SSLSocket):
            self.request.settimeout(10); self.request.do_handshake(); self.request.settimeout(None)
        super().setup()

    def send_json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path == "/api/health": return self.send_json(200, {"ok": True})
        if path == "/api/info": return self.send_json(200, {"url": SERVER_URL, "ips": IPS})
        if path == "/api/events": return self.events()
        if path.startswith("/api/doc/labme/"):
            k = path.rsplit("/", 1)[1]
            if k not in KEYS: return self.send_json(404, {"error": "unknown"})
            v = db_get(k)
            return self.send_json(200, {"exists": True, "data": {"v": v}} if v is not None else {"exists": False})
        self.static(path)

    def do_PUT(self):
        path = unquote(urlparse(self.path).path)
        if not path.startswith("/api/doc/labme/"): return self.send_json(404, {"error": "unknown"})
        k = path.rsplit("/", 1)[1]
        if k not in KEYS: return self.send_json(404, {"error": "unknown"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > MAX_BODY: raise ValueError
            obj = json.loads(self.rfile.read(n).decode("utf-8"))
            v = obj["v"]
            if not isinstance(v, str) or not isinstance(json.loads(v), list): raise ValueError
        except Exception:
            return self.send_json(400, {"error": "invalid data"})
        db_put(k, v)
        broadcast(k, v)
        self.send_json(200, {})

    def events(self):
        q = queue.Queue(maxsize=200)
        with listeners_lock: listeners.add(q)
        self.close_connection = True
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(b"retry: 2000\n\n"); self.wfile.flush()
            while True:
                try: self.wfile.write(q.get(timeout=15))
                except queue.Empty: self.wfile.write(b": keepalive\n\n")
                self.wfile.flush()
        except OSError:
            pass
        finally:
            with listeners_lock: listeners.discard(q)

    def static(self, path):
        rel = path.lstrip("/") or "index.html"
        full = os.path.realpath(os.path.join(STATIC, rel))
        if not (full == STATIC or full.startswith(STATIC + os.sep)) or not os.path.isfile(full):
            self.send_response(404); self.send_header("Content-Length", "0"); self.end_headers(); return
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype == "application/javascript": ctype += "; charset=utf-8"
        with open(full, "rb") as f: data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 64
    use_tls = True
    def get_request(self):
        sock, addr = self.socket.accept()
        if CTX and self.use_tls: sock = CTX.wrap_socket(sock, server_side=True, do_handshake_on_connect=False)
        return sock, addr
    def handle_error(self, request, client_address): pass   # browsers abort the first handshake on untrusted certs; ignore

class Redirect(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        host = (self.headers.get("Host") or "").split(":")[0] or (IPS[0] if IPS else "localhost")
        self.send_response(301); self.send_header("Location", "https://%s:%d%s" % (host, PORT, self.path))
        self.send_header("Content-Length", "0"); self.end_headers()
    do_HEAD = do_PUT = do_POST = do_GET

def main():
    global SERVER_URL
    init_db()
    secure = setup_tls()
    SERVER_URL = ("https://%s:%d" % (IPS[0] if IPS else "127.0.0.1", PORT)) if secure else ("http://%s:%d" % (IPS[0] if IPS else "127.0.0.1", HTTP_PORT))
    try:
        httpd = Server((HOST, PORT if secure else HTTP_PORT), Handler)
        if secure:
            redir = Server((HOST, HTTP_PORT), Redirect); redir.use_tls = False
    except OSError:
        print("\n  LABME port is already in use. Close the other LABME window and try again.\n"); sys.exit(1)
    if secure: threading.Thread(target=redir.serve_forever, daemon=True).start()
    print("\n  ==========================================")
    print("   LABME is running")
    print("  ==========================================")
    if IPS:
        print("   Tell everyone to open this address:\n")
        for ip in IPS: print("        %s://%s:%d" % ("https" if secure else "http", ip, PORT if secure else HTTP_PORT))
        if secure:
            print("\n   First time on each device the browser shows a security warning.")
            print("   That is normal (the certificate is made by this PC). Tap:")
            print("     Chrome/Android: Advanced > Proceed anyway")
            print("     iPhone Safari : Show Details > visit this website")
            print("   Typing http://%s:%d also works (it switches to https)." % (IPS[0], HTTP_PORT))
    else:
        print("   No Wi-Fi/network address found. Connect this PC to the school Wi-Fi, then restart.")
    print("\n   Keep this window open. Close it to stop LABME.")
    print("   Data is saved in: %s\n" % DB_PATH)
    try: httpd.serve_forever()
    except KeyboardInterrupt: pass

if __name__ == "__main__":
    main()
