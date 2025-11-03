@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo Automated Deployment to mandi.media
echo ==========================================
echo.

set SERVER=138.197.35.30
set USER=root
set PASS=Hhwj65377068Hhwj
set REMOTE_PATH=/var/www/linkedin-pilot

echo [1/8] Checking for required tools...
echo.

REM Check if plink is available
where plink >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PuTTY/plink not found!
    echo.
    echo Please install PuTTY from: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
    echo Or run: winget install -e --id PuTTY.PuTTY
    echo.
    echo After installing, run this script again.
    pause
    exit /b 1
)

echo [OK] PuTTY tools found
echo.

echo [2/8] Setting up server environment...
echo This will take 3-5 minutes...
echo.

plink -batch -pw %PASS% %USER%@%SERVER% "apt-get update -qq && apt-get install -y curl wget gnupg2 software-properties-common unzip && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs python3.11 python3.11-venv python3-pip nginx && npm install -g pm2 && curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg && echo 'deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse' | tee /etc/apt/sources.list.d/mongodb-org-7.0.list && apt-get update -qq && apt-get install -y mongodb-org && systemctl start mongod && systemctl enable mongod && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable && mkdir -p %REMOTE_PATH% && echo 'Server setup complete'"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Server setup failed!
    pause
    exit /b 1
)

echo.
echo [OK] Server environment ready
echo.

echo [3/8] Transferring configuration files...

pscp -batch -pw %PASS% deploy.sh %USER%@%SERVER%:%REMOTE_PATH%/
pscp -batch -pw %PASS% nginx.conf %USER%@%SERVER%:%REMOTE_PATH%/
pscp -batch -pw %PASS% ecosystem.config.js %USER%@%SERVER%:%REMOTE_PATH%/
pscp -batch -pw %PASS% production.env.backend %USER%@%SERVER%:%REMOTE_PATH%/backend.env
pscp -batch -pw %PASS% production.env.frontend %USER%@%SERVER%:%REMOTE_PATH%/frontend.env

echo.
echo [4/8] Transferring backend...
echo This may take 2-3 minutes...
pscp -batch -r -pw %PASS% backend %USER%@%SERVER%:%REMOTE_PATH%/

echo.
echo [5/8] Transferring frontend...
echo This may take 2-3 minutes...
pscp -batch -r -pw %PASS% frontend %USER%@%SERVER%:%REMOTE_PATH%/

echo.
echo [OK] Files transferred
echo.

echo [6/8] Configuring environment and installing dependencies...

plink -batch -pw %PASS% %USER%@%SERVER% "cd %REMOTE_PATH% && mv backend.env backend/.env && mv frontend.env frontend/.env && JWT_SECRET=$(openssl rand -hex 32) && sed -i \"s/JWT_SECRET_KEY=CHANGE_THIS_TO_A_VERY_LONG_RANDOM_STRING_FOR_PRODUCTION/JWT_SECRET_KEY=$JWT_SECRET/\" backend/.env && mkdir -p logs backend/uploads && cd backend && python3 -m venv venv && source venv/bin/activate && pip install --upgrade pip -q && pip install -r requirements.txt -q && deactivate && echo 'Backend setup complete'"

echo.
echo [7/8] Building frontend...
echo This will take 2-3 minutes...

plink -batch -pw %PASS% %USER%@%SERVER% "cd %REMOTE_PATH%/frontend && npm install && npm run build"

echo.
echo [8/8] Starting services...

plink -batch -pw %PASS% %USER%@%SERVER% "cd %REMOTE_PATH% && pm2 delete linkedin-pilot-backend 2>/dev/null ; pm2 start ecosystem.config.js && pm2 save && cp nginx.conf /etc/nginx/sites-available/linkedin-pilot && ln -sf /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx && echo 'Services started'"

echo.
echo ==========================================
echo.
echo [SUCCESS] Deployment Complete!
echo.
echo ==========================================
echo Your app is now live at:
echo   - http://138.197.35.30
echo   - http://mandi.media (once DNS is configured)
echo.
echo Next steps:
echo 1. Configure DNS: Point mandi.media A record to 138.197.35.30
echo 2. Visit your site and create an account
echo 3. Configure API keys in Settings
echo.
echo To enable auto-start on reboot, run:
echo   ssh %USER%@%SERVER%
echo   pm2 startup
echo ==========================================
echo.

pause







