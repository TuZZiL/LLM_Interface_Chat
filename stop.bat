@echo off
chcp 65001 >nul 2>&1

echo Stopping MiMo Chat servers...
taskkill /FI "WindowTitle eq MiMo Backend*" /F >nul 2>&1
taskkill /FI "WindowTitle eq MiMo Frontend*" /F >nul 2>&1
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" ^| findstr /i "node"') do taskkill /PID %%a /F >nul 2>&1
echo Done.
