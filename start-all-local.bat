@echo off
echo ============================================================
echo LINKEDIN PILOT - STARTING ALL SERVICES
echo ============================================================
echo.

echo [1/3] Starting Backend Server...
start "LinkedIn Pilot Backend" cmd /k "cd /d %~dp0backend ; echo LinkedIn Pilot Backend Server ; echo Port: http://localhost:8000 ; echo API Docs: http://localhost:8000/docs ; echo. ; python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend...
start "LinkedIn Pilot Frontend" cmd /k "cd /d %~dp0frontend ; echo LinkedIn Pilot Frontend ; echo URL: http://localhost:3000 ; echo. ; npm start"

timeout /t 2 /nobreak >nul

echo [3/3] Starting Admin Dashboard...
start "LinkedIn Pilot Admin" cmd /k "cd /d %~dp0admin-dashboard ; echo LinkedIn Pilot Admin Dashboard ; echo URL: http://localhost:4001 ; echo. ; npm start"

echo.
echo ============================================================
echo ALL SERVICES STARTING...
echo ============================================================
echo.
echo Services will open in separate windows:
echo   Backend:     http://localhost:8000
echo   Frontend:    http://localhost:3000
echo   Admin:       http://localhost:4001
echo.
echo Wait 10-15 seconds for all services to start, then:
echo   1. Open http://localhost:3000 in your browser
echo   2. Or open http://localhost:4001 for admin dashboard
echo.
echo API Documentation: http://localhost:8000/docs
echo.
pause

