@echo off
echo ============================================================
echo SSL Certificate Fix for mandi.media
echo Server: 138.197.35.30
echo ============================================================
echo.

set SERVER=138.197.35.30
set USER=root
set PASSWORD=Hhwj65377068Hhwj

echo [Step 0] Testing server connectivity...
echo ============================================================
ping -n 2 %SERVER% >nul 2>&1
if errorlevel 1 (
    echo ERROR: Cannot reach server %SERVER%
    echo The server may be down or unreachable.
    echo.
    echo Please check:
    echo 1. Is the server running?
    echo 2. Is SSH service active on the server?
    echo 3. Is port 22 open in the firewall?
    echo.
    pause
    exit /b 1
) else (
    echo Server is reachable.
)
echo.

echo [Step 1/6] Checking current certificate status...
echo ============================================================
plink -batch -ssh -pw "%PASSWORD%" -hostkey "*" %USER%@%SERVER% "sudo certbot certificates"
if errorlevel 1 (
    echo.
    echo WARNING: Connection failed. Trying alternative method...
    plink -batch -ssh -pw "%PASSWORD%" %USER%@%SERVER% -P 22 "sudo certbot certificates"
)
echo.

echo [Step 2/6] Checking certificate expiration...
echo ============================================================
plink -batch -ssh -pw "%PASSWORD%" -hostkey "*" %USER%@%SERVER% "sudo openssl x509 -in /etc/letsencrypt/live/mandi.media/fullchain.pem -noout -dates 2>&1 || echo Certificate file not found or invalid"
echo.

echo [Step 3/6] Checking if certificate files exist...
echo ============================================================
plink -batch -ssh -pw "%PASSWORD%" -hostkey "*" %USER%@%SERVER% "ls -la /etc/letsencrypt/live/mandi.media/ 2>&1 || echo Certificate directory not found"
echo.

echo [Step 4/6] Attempting to renew certificate...
echo ============================================================
plink -batch -ssh -pw "%PASSWORD%" -hostkey "*" %USER%@%SERVER% "sudo certbot renew --force-renewal --non-interactive"
echo.

echo [Step 5/6] Testing nginx configuration...
echo ============================================================
plink -batch -ssh -pw "%PASSWORD%" -hostkey "*" %USER%@%SERVER% "sudo nginx -t"
echo.

echo [Step 6/6] Reloading nginx...
echo ============================================================
plink -batch -ssh -pw "%PASSWORD%" -hostkey "*" %USER%@%SERVER% "sudo systemctl reload nginx"
echo.

echo [Verification] Checking certificate status again...
echo ============================================================
plink -batch -ssh -pw "%PASSWORD%" -hostkey "*" %USER%@%SERVER% "sudo certbot certificates"
echo.

echo ============================================================
echo SSL Certificate Fix Complete
echo ============================================================
echo.
echo Please test your site at: https://mandi.media
echo If issues persist, you may need to obtain a new certificate.
echo.
pause

