@echo off
chcp 65001 >nul 2>&1

set ROOT=F:\x_other_mat\AI_project\Mimo_chat
set LOG_DIR=%ROOT%\logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DT=%%I
set TIMESTAMP=%DT:~0,4%-%DT:~4,2%-%DT:~6,2%_%DT:~8,2%-%DT:~10,2%

echo ============================================
echo   MiMo Chat
echo ============================================
echo.

echo Starting backend...
cd /d "%ROOT%\server"
start /min "MiMo Backend" cmd /c "node src/index.js > "%LOG_DIR%\backend_%TIMESTAMP%.log" 2>&1"

timeout /t 3 /nobreak >nul

echo Starting frontend...
cd /d "%ROOT%\client"
start /min "MiMo Frontend" cmd /c "npx vite --port 5173 > "%LOG_DIR%\frontend_%TIMESTAMP%.log" 2>&1"

timeout /t 5 /nobreak >nul

echo.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo   Logs:     %LOG_DIR%
echo.
echo Press any key to stop servers...
pause >nul

taskkill /FI "WindowTitle eq MiMo Backend*" /F >nul 2>&1
taskkill /FI "WindowTitle eq MiMo Frontend*" /F >nul 2>&1
echo Stopped.
