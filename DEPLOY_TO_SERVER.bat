@echo off
REM LinkedIn Pilot - Windows Deployment Script
REM This script helps deploy from Windows to Linux server

echo ==========================================
echo LinkedIn Pilot - Deployment to Production
echo Server: 138.197.35.30
echo ==========================================
echo.

REM Check if we need to install dependencies first
if not exist "frontend\node_modules" (
    echo [WARNING] Frontend dependencies not installed locally
    echo This will be fine - they'll be installed on the server
    echo.
)

if not exist "backend\venv" (
    echo [WARNING] Backend virtual environment not found locally
    echo This will be fine - it'll be created on the server
    echo.
)

echo Step 1: Creating deployment package...
echo This excludes node_modules, venv, and other large folders
echo.

REM Create a temporary directory for deployment files
if exist linkedin-pilot-deploy rmdir /s /q linkedin-pilot-deploy
mkdir linkedin-pilot-deploy

REM Copy necessary files (excluding large directories)
echo Copying application files...
xcopy /E /I /Y /EXCLUDE:deploy-exclude.txt . linkedin-pilot-deploy

echo.
echo Step 2: Transferring files to server...
echo You'll need to enter the password: Hhwj65377068Hhwj
echo.

REM Note: This requires scp to be available (Git Bash or WSL)
REM If you don't have scp, you can use WinSCP or FileZilla

echo [INFO] You can transfer files using one of these methods:
echo.
echo Method 1 - Using Git Bash or WSL (recommended):
echo    cd linkedin-pilot-deploy
echo    scp -r * root@138.197.35.30:/var/www/linkedin-pilot/
echo.
echo Method 2 - Using WinSCP:
echo    1. Download WinSCP from https://winscp.net/
echo    2. Connect to: 138.197.35.30
echo    3. Username: root
echo    4. Password: Hhwj65377068Hhwj
echo    5. Upload all files from linkedin-pilot-deploy to /var/www/linkedin-pilot/
echo.
echo Method 3 - Using FileZilla:
echo    1. Download FileZilla from https://filezilla-project.org/
echo    2. Protocol: SFTP
echo    3. Host: 138.197.35.30
echo    4. Username: root
echo    5. Password: Hhwj65377068Hhwj
echo    6. Port: 22
echo    7. Upload all files to /var/www/linkedin-pilot/
echo.
echo.
echo After transferring files, run these commands on the server:
echo.
echo ssh root@138.197.35.30
echo cd /var/www/linkedin-pilot
echo chmod +x deploy.sh
echo ./deploy.sh
echo.
echo Then follow the DEPLOYMENT_GUIDE.md for the remaining steps.
echo.
echo Press any key to open DEPLOYMENT_GUIDE.md...
pause > nul
start DEPLOYMENT_GUIDE.md

exit /b 0







