# Quick deployment script for mandi.media
$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying LinkedIn Pilot to mandi.media" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$server = "root@138.197.35.30"
$password = "Hhwj65377068Hhwj"

# Step 1: Create deployment package with only essential files
Write-Host "`n[1/6] Creating minimal deployment package..." -ForegroundColor Yellow

$tempDir = "deploy-temp"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy only essential files
Write-Host "   Copying backend files..." -ForegroundColor Gray
Copy-Item -Path "backend\*.py" -Destination "$tempDir\backend\" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path "backend\linkedpilot" -Destination "$tempDir\backend\linkedpilot\" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path "backend\requirements.txt" -Destination "$tempDir\backend\" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "backend\package.json" -Destination "$tempDir\backend\" -Force -ErrorAction SilentlyContinue

Write-Host "   Copying frontend source..." -ForegroundColor Gray
Copy-Item -Path "frontend\src" -Destination "$tempDir\frontend\src\" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\public" -Destination "$tempDir\frontend\public\" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\package.json" -Destination "$tempDir\frontend\" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\*.js" -Destination "$tempDir\frontend\" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "frontend\*.json" -Destination "$tempDir\frontend\" -Force -ErrorAction SilentlyContinue

Write-Host "   Copying config files..." -ForegroundColor Gray
Copy-Item -Path "deploy.sh" -Destination "$tempDir\" -Force
Copy-Item -Path "nginx.conf" -Destination "$tempDir\" -Force
Copy-Item -Path "ecosystem.config.js" -Destination "$tempDir\" -Force
Copy-Item -Path "production.env.backend" -Destination "$tempDir\" -Force
Copy-Item -Path "production.env.frontend" -Destination "$tempDir\" -Force

Write-Host "   Creating archive..." -ForegroundColor Gray
Compress-Archive -Path "$tempDir\*" -DestinationPath "linkedin-pilot-deploy.zip" -Force

Write-Host "   ✓ Package created" -ForegroundColor Green

# Step 2: Transfer to server
Write-Host "`n[2/6] Transferring to server..." -ForegroundColor Yellow
Write-Host "   Password: $password" -ForegroundColor Gray

# Use pscp if available, otherwise show manual instructions
$pscpPath = Get-Command pscp -ErrorAction SilentlyContinue
if ($pscpPath) {
    echo y | pscp -pw $password linkedin-pilot-deploy.zip ${server}:/root/
} else {
    Write-Host "   Run this command:" -ForegroundColor Cyan
    Write-Host "   scp linkedin-pilot-deploy.zip $server:/root/" -ForegroundColor White
    Write-Host ""
    Read-Host "   Press Enter when transfer is complete"
}

Write-Host "   ✓ Files transferred" -ForegroundColor Green

# Step 3: Run deployment on server
Write-Host "`n[3/6] Running deployment on server..." -ForegroundColor Yellow

$deployScript = @"
cd /root
apt-get update -qq
apt-get install -y unzip wget curl gnupg2 software-properties-common

# Extract files
mkdir -p /var/www/linkedin-pilot
unzip -o linkedin-pilot-deploy.zip -d /var/www/linkedin-pilot/
cd /var/www/linkedin-pilot

# Run main setup
chmod +x deploy.sh
./deploy.sh

echo "Server setup complete!"
"@

# Save to temp file and execute
$deployScript | Out-File -FilePath "remote-deploy.sh" -Encoding ASCII
Write-Host "   Run these commands on the server:" -ForegroundColor Cyan
Write-Host ""
Write-Host "ssh $server" -ForegroundColor White
Write-Host "$deployScript" -ForegroundColor White
Write-Host ""

# Cleanup
Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
Write-Host "`n✓ Deployment package ready: linkedin-pilot-deploy.zip" -ForegroundColor Green
Write-Host "✓ Updated for mandi.media domain" -ForegroundColor Green







