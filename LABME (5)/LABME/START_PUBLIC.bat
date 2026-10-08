@echo off
title LABME Public Link
cd /d "%~dp0"
echo ==============================================================
echo  LABME public link  (needs internet on this PC)
echo  1. START_LABME.bat must already be running in its own window.
echo  2. Look below for a line like  https://something.trycloudflare.com
echo  3. Open that link on any phone, anywhere. Same data as the school Wi-Fi.
echo  The link changes every time you run this. Close this window to turn it off.
echo ==============================================================
if not exist cloudflared.exe powershell -NoProfile -Command "try{Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'}catch{}" >nul 2>nul
if not exist cloudflared.exe (
  echo Could not download cloudflared.exe. Connect this PC to the internet and run again.
  pause
  exit /b 1
)
cloudflared.exe tunnel --url https://localhost:8443 --no-tls-verify
pause
