@echo off
echo ============================================================
echo Deploying Signup CORS Fix to Production
echo ============================================================
echo.

echo [Step 1/3] Uploading fixed server.py...
echo.
pscp -pw "Hhwj65377068Hhwj" backend\server.py root@138.197.35.30:/var/www/linkedin-pilot/backend/server.py
if errorlevel 1 (
    echo Trying with scp...
    scp backend\server.py root@138.197.35.30:/var/www/linkedin-pilot/backend/server.py
)
echo.

echo [Step 2/3] Restarting backend service...
echo.
plink -batch -pw "Hhwj65377068Hhwj" root@138.197.35.30 "cd /var/www/linkedin-pilot/backend && pm2 restart linkedin-pilot-backend"
if errorlevel 1 (
    echo Trying with ssh...
    ssh root@138.197.35.30 "cd /var/www/linkedin-pilot/backend && pm2 restart linkedin-pilot-backend"
)
echo.

echo [Step 3/3] Waiting for service to restart...
timeout /t 5 /nobreak
echo.

echo ============================================================
echo Testing CORS Fix...
echo ============================================================
curl -X OPTIONS https://mandi.media/api/auth/signup -H "Origin: https://mandi.media" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" -v 2>&1 | findstr /C:"access-control-allow-origin"

echo.
echo ============================================================
echo Deployment Complete!
echo ============================================================
echo.
echo Your friend can now try signing up at: https://mandi.media
echo.
pause
