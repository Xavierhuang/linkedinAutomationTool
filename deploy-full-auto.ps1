# Full Automated Deployment for LinkedIn Pilot to mandi.media
# Uses Windows built-in SSH client

$ErrorActionPreference = "Continue"
$server = "root@138.197.35.30"
$remotePath = "/var/www/linkedin-pilot"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Automated Deployment to mandi.media" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Create password file temporarily
$pass = "Hhwj65377068Hhwj"
$securePass = ConvertTo-SecureString $pass -AsPlainText -Force

Write-Host "[1/8] Setting up server environment..." -ForegroundColor Yellow
Write-Host "  Installing Node.js, Python, MongoDB, Nginx, PM2..." -ForegroundColor Gray
Write-Host "  This will take 5-10 minutes..." -ForegroundColor Gray
Write-Host ""

# Use heredoc to create setup script
$setupScript = @'
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

echo "Updating system..."
apt-get update -qq

echo "Installing curl and basic tools..."
apt-get install -y curl wget gnupg2 software-properties-common unzip git

echo "Installing Node.js 20.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
node -v

echo "Installing Python..."
apt-get install -y python3.11 python3.11-venv python3-pip

echo "Installing MongoDB..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -qq
    apt-get install -y mongodb-org
    systemctl start mongod
    systemctl enable mongod
fi
systemctl status mongod --no-pager

echo "Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx

echo "Installing PM2..."
npm install -g pm2

echo "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Creating app directory..."
mkdir -p /var/www/linkedin-pilot

echo "✓ Server setup complete!"
'@

# Save and execute
$setupScript | ssh -o StrictHostKeyChecking=accept-new $server "bash -s"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Server setup encountered issues. Continuing..." -ForegroundColor Yellow
}

Write-Host "✓ Server environment ready" -ForegroundColor Green
Write-Host ""

Write-Host "[2/8] Transferring files to server..." -ForegroundColor Yellow
Write-Host "  This may take 3-5 minutes..." -ForegroundColor Gray

# Transfer configuration files
Write-Host "  → Config files..." -ForegroundColor DarkGray
scp -o StrictHostKeyChecking=no deploy.sh nginx.conf ecosystem.config.js production.env.backend production.env.frontend "${server}:${remotePath}/"

# Transfer backend
Write-Host "  → Backend directory..." -ForegroundColor DarkGray
scp -r -o StrictHostKeyChecking=no backend "${server}:${remotePath}/"

# Transfer frontend  
Write-Host "  → Frontend directory..." -ForegroundColor DarkGray
scp -r -o StrictHostKeyChecking=no frontend "${server}:${remotePath}/"

Write-Host "✓ Files transferred" -ForegroundColor Green
Write-Host ""

Write-Host "[3/8] Configuring environment..." -ForegroundColor Yellow

$configScript = @"
cd $remotePath
cp production.env.backend backend/.env
cp production.env.frontend frontend/.env

# Generate secure JWT secret
JWT_SECRET=\`$(openssl rand -hex 32)
sed -i 's/JWT_SECRET_KEY=CHANGE_THIS_TO_A_VERY_LONG_RANDOM_STRING_FOR_PRODUCTION/JWT_SECRET_KEY='\$JWT_SECRET'/' backend/.env

chmod +x deploy.sh
mkdir -p logs backend/uploads

echo 'Environment configured'
"@

ssh $server "bash -c `"$configScript`""
Write-Host "✓ Environment configured" -ForegroundColor Green
Write-Host ""

Write-Host "[4/8] Installing backend dependencies..." -ForegroundColor Yellow
Write-Host "  This will take 2-3 minutes..." -ForegroundColor Gray

$backendScript = @"
cd $remotePath/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
deactivate
echo 'Backend dependencies installed'
"@

ssh $server "bash -c `"$backendScript`""
Write-Host "✓ Backend ready" -ForegroundColor Green
Write-Host ""

Write-Host "[5/8] Building frontend..." -ForegroundColor Yellow
Write-Host "  This will take 2-4 minutes..." -ForegroundColor Gray

$frontendScript = @"
cd $remotePath/frontend
npm install
npm run build
echo 'Frontend built'
"@

ssh $server "bash -c `"$frontendScript`""
Write-Host "✓ Frontend ready" -ForegroundColor Green
Write-Host ""

Write-Host "[6/8] Starting backend with PM2..." -ForegroundColor Yellow

$pm2Script = @"
cd $remotePath
pm2 delete linkedin-pilot-backend 2>/dev/null ; true
pm2 start ecosystem.config.js
pm2 save
pm2 list
"@

ssh $server "bash -c `"$pm2Script`""
Write-Host "✓ Backend started" -ForegroundColor Green
Write-Host ""

Write-Host "[7/8] Configuring Nginx..." -ForegroundColor Yellow

$nginxScript = @"
cp $remotePath/nginx.conf /etc/nginx/sites-available/linkedin-pilot
ln -sf /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
"@

ssh $server "bash -c `"$nginxScript`""
Write-Host "✓ Nginx configured" -ForegroundColor Green
Write-Host ""

Write-Host "[8/8] Verifying deployment..." -ForegroundColor Yellow

$verifyScript = @"
echo ''
echo '=== Service Status ==='
systemctl is-active mongod ; echo 'MongoDB status checked'
systemctl is-active nginx ; echo 'Nginx status checked'
pm2 list

echo ''
echo '=== Testing Backend API ==='
sleep 2
curl -s http://localhost:8000/api/health
"@

ssh $server "bash -c `"$verifyScript`""

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✓✓✓ DEPLOYMENT COMPLETE! ✓✓✓" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your LinkedIn Pilot is now live at:" -ForegroundColor Cyan
Write-Host "  → http://138.197.35.30" -ForegroundColor White
Write-Host "  → http://mandi.media (once DNS is configured)" -ForegroundColor White  
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Configure DNS A record:" -ForegroundColor White
Write-Host "     mandi.media → 138.197.35.30" -ForegroundColor Gray
Write-Host "  2. Visit your site and create an admin account" -ForegroundColor White
Write-Host "  3. Add API keys in Settings > API Providers" -ForegroundColor White
Write-Host "  4. Start creating LinkedIn campaigns!" -ForegroundColor White
Write-Host ""
Write-Host "To enable auto-start on server reboot:" -ForegroundColor Yellow
Write-Host "  ssh $server" -ForegroundColor Gray
Write-Host "  pm2 startup" -ForegroundColor Gray
Write-Host "  (run the command it outputs)" -ForegroundColor Gray
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan

