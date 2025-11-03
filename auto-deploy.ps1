# Automated Deployment Script for mandi.media
$server = "138.197.35.30"
$user = "root"
$pass = "Hhwj65377068Hhwj"
$remotePath = "/var/www/linkedin-pilot"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Automated Deployment to mandi.media" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Setup server environment
Write-Host "[1/8] Setting up server environment..." -ForegroundColor Yellow

$setupCommands = @"
set -e
export DEBIAN_FRONTEND=noninteractive

echo '=== Updating system ==='
apt-get update -qq

echo '=== Installing basic tools ==='
apt-get install -y curl wget gnupg2 software-properties-common unzip git

echo '=== Installing Node.js 20.x ==='
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo '=== Installing Python 3.11 ==='
apt-get install -y python3.11 python3.11-venv python3-pip

echo '=== Installing MongoDB ==='
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -qq
    apt-get install -y mongodb-org
    systemctl start mongod
    systemctl enable mongod
fi

echo '=== Installing Nginx ==='
apt-get install -y nginx
systemctl enable nginx

echo '=== Installing PM2 ==='
npm install -g pm2

echo '=== Configuring firewall ==='
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo '=== Creating app directory ==='
mkdir -p $remotePath
cd $remotePath

echo '=== Server setup complete ==='
"@

# Save commands to temp file
$setupScript = "$env:TEMP\setup-server.sh"
$setupCommands | Out-File -FilePath $setupScript -Encoding UTF8 -NoNewline

Write-Host "   Connecting to server..." -ForegroundColor Gray
Write-Host "   This will take 3-5 minutes..." -ForegroundColor Gray
Write-Host ""

# Execute setup on server
cat $setupScript | ssh -o StrictHostKeyChecking=no ${user}@${server} "bash -s"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Server environment ready" -ForegroundColor Green
} else {
    Write-Host "   ✗ Server setup failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/8] Transferring application files..." -ForegroundColor Yellow
Write-Host "   This may take 2-3 minutes..." -ForegroundColor Gray

# Transfer files using scp
$filesToTransfer = @(
    "deploy.sh",
    "nginx.conf",
    "ecosystem.config.js",
    "production.env.backend",
    "production.env.frontend"
)

foreach ($file in $filesToTransfer) {
    scp -o StrictHostKeyChecking=no $file ${user}@${server}:${remotePath}/
}

# Transfer directories
Write-Host "   Transferring backend..." -ForegroundColor Gray
scp -r -o StrictHostKeyChecking=no backend ${user}@${server}:${remotePath}/

Write-Host "   Transferring frontend..." -ForegroundColor Gray
scp -r -o StrictHostKeyChecking=no frontend ${user}@${server}:${remotePath}/

Write-Host "   ✓ Files transferred" -ForegroundColor Green

# Continue with deployment
Write-Host ""
Write-Host "[3/8] Configuring environment..." -ForegroundColor Yellow

$configCommands = @"
cd $remotePath
cp production.env.backend backend/.env
cp production.env.frontend frontend/.env

# Generate secure JWT secret
JWT_SECRET=\$(openssl rand -hex 32)
sed -i "s/JWT_SECRET_KEY=CHANGE_THIS_TO_A_VERY_LONG_RANDOM_STRING_FOR_PRODUCTION/JWT_SECRET_KEY=\$JWT_SECRET/" backend/.env

chmod +x deploy.sh

mkdir -p logs
mkdir -p backend/uploads
"@

ssh ${user}@${server} "$configCommands"
Write-Host "   ✓ Environment configured" -ForegroundColor Green

Write-Host ""
Write-Host "[4/8] Installing backend dependencies..." -ForegroundColor Yellow

$backendCommands = @"
cd $remotePath/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
deactivate
"@

ssh ${user}@${server} "bash -c '$backendCommands'"
Write-Host "   ✓ Backend dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "[5/8] Building frontend..." -ForegroundColor Yellow
Write-Host "   This will take 2-3 minutes..." -ForegroundColor Gray

$frontendCommands = @"
cd $remotePath/frontend
npm install --quiet
npm run build
"@

ssh ${user}@${server} "bash -c '$frontendCommands'"
Write-Host "   ✓ Frontend built" -ForegroundColor Green

Write-Host ""
Write-Host "[6/8] Starting backend with PM2..." -ForegroundColor Yellow

$pm2Commands = @"
cd $remotePath
pm2 delete linkedin-pilot-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
"@

ssh ${user}@${server} "$pm2Commands"
Write-Host "   ✓ Backend started" -ForegroundColor Green

Write-Host ""
Write-Host "[7/8] Configuring Nginx..." -ForegroundColor Yellow

$nginxCommands = @"
cp $remotePath/nginx.conf /etc/nginx/sites-available/linkedin-pilot
ln -sf /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
"@

ssh ${user}@${server} "$nginxCommands"
Write-Host "   ✓ Nginx configured" -ForegroundColor Green

Write-Host ""
Write-Host "[8/8] Verifying deployment..." -ForegroundColor Yellow

$verifyCommands = @"
echo '=== PM2 Status ==='
pm2 status

echo '=== Services Status ==='
systemctl is-active mongod
systemctl is-active nginx

echo '=== Testing Backend ==='
sleep 2
curl -s http://localhost:8000/api/health || echo 'Backend not responding yet'
"@

ssh ${user}@${server} "$verifyCommands"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your app is now live at:" -ForegroundColor Cyan
Write-Host "  → http://138.197.35.30" -ForegroundColor White
Write-Host "  → http://mandi.media (once DNS is configured)" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Configure DNS A record for mandi.media → 138.197.35.30" -ForegroundColor White
Write-Host "  2. Visit your site and create an admin account" -ForegroundColor White
Write-Host "  3. Configure API keys in Settings" -ForegroundColor White
Write-Host ""
Write-Host "To enable auto-start on reboot:" -ForegroundColor Yellow
Write-Host "  ssh $user@$server" -ForegroundColor White
Write-Host "  pm2 startup" -ForegroundColor White
Write-Host "  (then run the command it outputs)" -ForegroundColor White
Write-Host ""

# Cleanup
Remove-Item $setupScript -ErrorAction SilentlyContinue







