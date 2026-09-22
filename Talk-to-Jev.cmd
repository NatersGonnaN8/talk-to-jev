@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Talk to Jev needs Node.js 20 or newer.
  echo https://nodejs.org
  start "" https://nodejs.org
  pause
  exit /b 1
)
node scripts\open-app.mjs
if errorlevel 1 pause
