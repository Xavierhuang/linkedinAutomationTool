@echo off
echo ============================================================
echo LinkedIn Pilot Server Diagnostics
echo Server: 138.197.35.30
echo ============================================================
echo.

echo [1/5] Checking PM2 Process Status...
echo ============================================================
plink -batch -pw "Hhwj65377068Hhwj" root@138.197.35.30 "pm2 list"
echo.

echo [2/5] Checking Backend Logs...
echo ============================================================
plink -batch -pw "Hhwj65377068Hhwj" root@138.197.35.30 "pm2 logs linkedin-pilot-backend --lines 20 --nostream"
echo.

echo [3/5] Checking Nginx Status...
echo ============================================================
plink -batch -pw "Hhwj65377068Hhwj" root@138.197.35.30 "systemctl status nginx | head -20"
echo.

echo [4/5] Checking Nginx Configuration...
echo ============================================================
plink -batch -pw "Hhwj65377068Hhwj" root@138.197.35.30 "nginx -t"
echo.

echo [5/5] Checking Deployed Files...
echo ============================================================
plink -batch -pw "Hhwj65377068Hhwj" root@138.197.35.30 "ls -la /var/www/linkedin-pilot/frontend/build/ | head -20"
echo.
plink -batch -pw "Hhwj65377068Hhwj" root@138.197.35.30 "ls -la /var/www/linkedin-pilot/backend/ | head -20"
echo.

echo ============================================================
echo Diagnostics Complete
echo ============================================================
pause
