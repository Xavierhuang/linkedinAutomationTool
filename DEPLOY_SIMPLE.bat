@echo off
echo ==========================================
echo LinkedIn Pilot - Deploy to mandi.media
echo ==========================================
echo.
echo Server: 138.197.35.30
echo Domain: mandi.media
echo.
echo Step 1: Connect to server and run these commands:
echo.
echo ssh root@138.197.35.30
echo Password: Hhwj65377068Hhwj
echo.
echo ==========================================
echo PASTE THESE COMMANDS ON THE SERVER:
echo ==========================================
echo.
echo # Update system
echo apt-get update ; apt-get upgrade -y
echo.
echo # Install Node.js 20.x
echo curl -fsSL https://deb.nodesource.com/setup_20.x ^| bash -
echo apt-get install -y nodejs
echo.
echo # Install Python and dependencies
echo apt-get install -y python3.11 python3.11-venv python3-pip
echo.
echo # Install MongoDB
echo wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc ^| apt-key add -
echo echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" ^| tee /etc/apt/sources.list.d/mongodb-org-7.0.list
echo apt-get update
echo apt-get install -y mongodb-org
echo systemctl start mongod
echo systemctl enable mongod
echo.
echo # Install Nginx and PM2
echo apt-get install -y nginx
echo npm install -g pm2
echo.
echo # Configure firewall
echo ufw allow 22/tcp
echo ufw allow 80/tcp
echo ufw allow 443/tcp
echo ufw --force enable
echo.
echo # Create app directory
echo mkdir -p /var/www/linkedin-pilot
echo cd /var/www/linkedin-pilot
echo.
echo ==========================================
echo.
echo Press any key after running the above commands...
pause
echo.
echo Now I'll help you transfer the files.
echo Opening file transfer instructions...
start MANUAL_DEPLOY.md







