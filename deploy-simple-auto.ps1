# Automated Deployment for LinkedIn Pilot to mandi.media
$ErrorActionPreference = "Continue"
$server = "root@138.197.35.30"
$remotePath = "/var/www/linkedin-pilot"

Write-Host "==========================================`n" -ForegroundColor Cyan
Write-Host "Automated Deployment to mandi.media`n" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# Step 1: Setup Server
Write-Host "[1/8] Setting up server environment...`n" -ForegroundColor Yellow
Write-Host "Installing Node.js, Python, MongoDB, Nginx, PM2...`n" -ForegroundColor Gray
Write-Host "This will take 5-10 minutes...`n" -ForegroundColor Gray

ssh -o StrictHostKeyChecking=accept-new $server @"
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y curl wget gnupg2 software-properties-common unzip git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs python3.11 python3.11-venv python3-pip nginx
npm install -g pm2
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo 'deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse' | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -qq
apt-get install -y mongodb-org
systemctl start mongod
systemctl enable mongod
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
mkdir -p $remotePath
"@

Write-Host "Server environment ready`n" -ForegroundColor Green

# Step 2: Transfer Files  
Write-Host "[2/8] Transferring files to server...`n" -ForegroundColor Yellow
Write-Host "This may take 3-5 minutes...`n" -ForegroundColor Gray

scp -o StrictHostKeyChecking=no deploy.sh nginx.conf ecosystem.config.js production.env.backend production.env.frontend "${server}:${remotePath}/"
scp -r -o StrictHostKeyChecking=no backend "${server}:${remotePath}/"
scp -r -o StrictHostKeyChecking=no frontend "${server}:${remotePath}/"

Write-Host "Files transferred`n" -ForegroundColor Green

# Step 3: Configure Environment
Write-Host "[3/8] Configuring environment...`n" -ForegroundColor Yellow

ssh $server @"
cd $remotePath
cp production.env.backend backend/.env
cp production.env.frontend frontend/.env
JWT_SECRET=\`$(openssl rand -hex 32)
sed -i \"s/JWT_SECRET_KEY=CHANGE_THIS_TO_A_VERY_LONG_RANDOM_STRING_FOR_PRODUCTION/JWT_SECRET_KEY=\$JWT_SECRET/\" backend/.env
chmod +x deploy.sh
mkdir -p logs backend/uploads
"@

Write-Host "Environment configured`n" -ForegroundColor Green

# Step 4: Install Backend Dependencies
Write-Host "[4/8] Installing backend dependencies...`n" -ForegroundColor Yellow
Write-Host "This will take 2-3 minutes...`n" -ForegroundColor Gray

ssh $server @"
cd $remotePath/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
deactivate
"@

Write-Host "Backend ready`n" -ForegroundColor Green

# Step 5: Build Frontend
Write-Host "[5/8] Building frontend...`n" -ForegroundColor Yellow
Write-Host "This will take 2-4 minutes...`n" -ForegroundColor Gray

ssh $server @"
cd $remotePath/frontend
npm install
npm run build
"@

Write-Host "Frontend ready`n" -ForegroundColor Green

# Step 6: Start PM2
Write-Host "[6/8] Starting backend with PM2...`n" -ForegroundColor Yellow

ssh $server @"
cd $remotePath
pm2 delete linkedin-pilot-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
"@

Write-Host "Backend started`n" -ForegroundColor Green

# Step 7: Configure Nginx
Write-Host "[7/8] Configuring Nginx...`n" -ForegroundColor Yellow

ssh $server @"
cp $remotePath/nginx.conf /etc/nginx/sites-available/linkedin-pilot
ln -sf /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
"@

Write-Host "Nginx configured`n" -ForegroundColor Green

# Step 8: Verify
Write-Host "[8/8] Verifying deployment...`n" -ForegroundColor Yellow

ssh $server @"
systemctl is-active mongod
systemctl is-active nginx
pm2 list
sleep 2
curl -s http://localhost:8000/api/health
"@

Write-Host "`n==========================================`n" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE!`n" -ForegroundColor Green
Write-Host "==========================================`n" -ForegroundColor Green
Write-Host "Your LinkedIn Pilot is now live at:`n" -ForegroundColor Cyan
Write-Host "  http://138.197.35.30`n" -ForegroundColor White
Write-Host "  http://mandi.media (once DNS is configured)`n" -ForegroundColor White  
Write-Host "`nNext Steps:`n" -ForegroundColor Yellow
Write-Host "1. Configure DNS A record: mandi.media to 138.197.35.30`n" -ForegroundColor White
Write-Host "2. Visit your site and create an admin account`n" -ForegroundColor White
Write-Host "3. Add API keys in Settings`n" -ForegroundColor White
Write-Host "4. Start creating LinkedIn campaigns!`n" -ForegroundColor White
Write-Host "==========================================`n" -ForegroundColor Cyan







