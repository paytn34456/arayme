@echo off
title LABME Server
cd /d "%~dp0"
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY where python >nul 2>nul && set "PY=python"
if not defined PY (
  echo Python 3 was not found on this PC.
  echo Install it from python.org and tick "Add python.exe to PATH", then run this file again.
  pause
  exit /b 1
)
if not exist "static\lib" mkdir "static\lib"
rem One-time download of the optional QR camera-scanner libraries (skipped when offline or already present).
if not exist "static\lib\jsQR.min.js" powershell -NoProfile -Command "try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 -Uri 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js' -OutFile 'static\lib\jsQR.min.js'}catch{}" >nul 2>nul
if not exist "static\lib\html5-qrcode.min.js" powershell -NoProfile -Command "try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 -Uri 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js' -OutFile 'static\lib\html5-qrcode.min.js'}catch{}" >nul 2>nul
rem Allow other devices through Windows Firewall (works when run as administrator; harmless otherwise).
netsh advfirewall firewall show rule name="LABME" >nul 2>nul || netsh advfirewall firewall add rule name="LABME" dir=in action=allow protocol=TCP localport=8080,8443 profile=private,public >nul 2>nul
%PY% app.py
echo.
pause
