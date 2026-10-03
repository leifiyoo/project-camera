@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_node

echo Preparing Interface Studio...
call npm ci
if errorlevel 1 goto failed
echo Open the Local URL shown below in your browser. Stop the studio with Ctrl+C.
call npm run dev -- %*
if errorlevel 1 goto failed
exit /b 0

:missing_node
echo Install Node.js 24 LTS including npm from https://nodejs.org/en/download and try again.
:failed
pause
exit /b 1
