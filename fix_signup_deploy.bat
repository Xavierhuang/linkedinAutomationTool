@echo off
echo ============================================================
echo Deploying Signup CORS Fix
echo ============================================================
echo.

echo [1/2] Uploading fixed server.py to production...
scp backend/server.py root@138.197.35.30:/var/www/linkedin-pilot/backend/
echo.

echo [2/2] Restarting backend service...
ssh root@138.197.35.30 "cd /var/www/linkedin-pilot/backend && pm2 restart linkedin-pilot-backend && pm2 logs linkedin-pilot-backend --lines 20 --nostream"
echo.

echo ============================================================
echo Deployment Complete!
echo ============================================================
echo.
echo Testing signup in 5 seconds...
timeout /t 5 /nobreak
echo.

echo Testing CORS for production domain...
curl -X OPTIONS https://mandi.media/api/auth/signup -H "Origin: https://mandi.media" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" -i 2>&1 | findstr /C:"access-control" /C:"Disallowed"
echo.

echo ============================================================
echo If you see "access-control-allow-origin" above, the fix worked!
echo If you see "Disallowed CORS origin", there may be an issue.
echo ============================================================
pause
