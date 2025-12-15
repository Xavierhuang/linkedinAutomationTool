@echo off
echo ============================================================
echo SSL Certificate Diagnostic Tool
echo Server: 138.197.35.30
echo Domain: mandi.media
echo ============================================================
echo.

set SERVER=138.197.35.30
set USER=root
set PASSWORD=Hhwj65377068Hhwj

echo [1] Testing basic connectivity...
echo ============================================================
ping -n 4 %SERVER%
echo.

echo [2] Testing HTTP connectivity...
echo ============================================================
curl -I http://%SERVER% 2>&1 | findstr /C:"HTTP"
echo.

echo [3] Testing HTTPS connectivity...
echo ============================================================
curl -I -k https://mandi.media 2>&1 | findstr /C:"HTTP"
echo.

echo [4] Testing SSH connectivity on port 22...
echo ============================================================
plink -batch -ssh -pw "%PASSWORD%" -hostkey "*" -P 22 %USER%@%SERVER% "echo 'SSH connection successful'" 2>&1
if errorlevel 1 (
    echo SSH connection failed on port 22
    echo.
    echo Trying alternative SSH ports...
    for %%p in (2222 2200 22022) do (
        echo Trying port %%p...
        plink -batch -ssh -pw "%PASSWORD%" -hostkey "*" -P %%p %USER%@%SERVER% "echo 'SSH connection successful on port %%p'" 2>&1
    )
)
echo.

echo [5] Checking if plink is available...
echo ============================================================
where plink >nul 2>&1
if errorlevel 1 (
    echo ERROR: plink.exe not found in PATH
    echo Please ensure PuTTY is installed and plink.exe is accessible
) else (
    echo plink.exe found
    plink -V
)
echo.

echo ============================================================
echo Diagnostic Complete
echo ============================================================
echo.
echo If SSH connection fails, you may need to:
echo 1. Access the server via web console (DigitalOcean/AWS/etc)
echo 2. Check firewall rules to allow SSH
echo 3. Verify SSH service is running on the server
echo.
pause






