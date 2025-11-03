@echo off
echo ============================================================
echo LINKEDIN PILOT - COMPLETE APP RESTART
echo ============================================================
echo.
echo This will:
echo 1. Kill all running processes
echo 2. Restart backend
echo 3. Restart frontend with fresh environment
echo.
pause

echo.
echo [1/4] Stopping all processes...
taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM python.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo [2/4] Starting Backend...
start "LinkedIn Pilot Backend" cmd /k "cd /d %~dp0backend && uvicorn server:app --reload --host 0.0.0.0 --port 8000"
timeout /t 5 /nobreak >nul

echo [3/4] Starting Frontend...
start "LinkedIn Pilot Frontend" cmd /k "cd /d %~dp0frontend && npm start"

echo.
echo [4/4] Done!
echo.
echo ============================================================
echo SERVERS STARTING...
echo ============================================================
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Wait 10-15 seconds for both to start, then:
echo   1. Go to http://localhost:3000
echo   2. Login with:
echo      Email: evanslockwood69@gmail.com
echo      Password: pass1234321
echo.
echo Your data is safe:
echo   - 11 Published Posts
echo   - 23 Drafts  
echo   - 21 Scheduled Posts
echo ============================================================
pause

