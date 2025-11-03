# LinkedIn Pilot - PowerShell Deployment Script
# Run this from PowerShell as Administrator

param(
    [string]$ServerIP = "138.197.35.30",
    [string]$Username = "root",
    [string]$Password = "Hhwj65377068Hhwj"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LinkedIn Pilot - Deployment Script" -ForegroundColor Cyan
Write-Host "Server: $ServerIP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "backend\server.py")) {
    Write-Host "[ERROR] Please run this script from the project root directory" -ForegroundColor Red
    Write-Host "Current directory: $PWD" -ForegroundColor Red
    exit 1
}

Write-Host "[1/5] Creating deployment package..." -ForegroundColor Yellow

# Create temporary deployment directory
$deployDir = "linkedin-pilot-deploy"
if (Test-Path $deployDir) {
    Remove-Item -Recurse -Force $deployDir
}
New-Item -ItemType Directory -Path $deployDir | Out-Null

# Files and folders to exclude
$excludeList = @(
    "node_modules",
    "venv",
    "__pycache__",
    ".git",
    "*.pyc",
    "*.log",
    "backend\uploads",
    "linkedin-pilot-deploy",
    "*.zip"
)

Write-Host "   Copying files (this may take a moment)..." -ForegroundColor Gray

# Copy all files except excluded ones
Get-ChildItem -Path . -Exclude $excludeList | ForEach-Object {
    $target = Join-Path $deployDir $_.Name
    if ($_.PSIsContainer) {
        # Skip excluded directories
        if ($excludeList -notcontains $_.Name) {
            Copy-Item -Path $_.FullName -Destination $target -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        Copy-Item -Path $_.FullName -Destination $target -Force
    }
}

Write-Host "   ✓ Files copied to temporary directory" -ForegroundColor Green
Write-Host ""

Write-Host "[2/5] Creating compressed archive..." -ForegroundColor Yellow
$archiveName = "linkedin-pilot.zip"
if (Test-Path $archiveName) {
    Remove-Item $archiveName -Force
}

Compress-Archive -Path "$deployDir\*" -DestinationPath $archiveName -CompressionLevel Optimal
Write-Host "   ✓ Created $archiveName" -ForegroundColor Green
Write-Host ""

Write-Host "[3/5] Transferring files to server..." -ForegroundColor Yellow
Write-Host "   This may take several minutes depending on your connection..." -ForegroundColor Gray

# Check if scp is available
$scpPath = Get-Command scp -ErrorAction SilentlyContinue
if (-not $scpPath) {
    Write-Host ""
    Write-Host "[WARNING] SCP not found. You'll need to transfer manually." -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual Transfer Options:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1 - Using WinSCP (Recommended):" -ForegroundColor Cyan
    Write-Host "  1. Download WinSCP from https://winscp.net/" -ForegroundColor White
    Write-Host "  2. Connect to: $ServerIP" -ForegroundColor White
    Write-Host "  3. Username: $Username" -ForegroundColor White
    Write-Host "  4. Password: $Password" -ForegroundColor White
    Write-Host "  5. Upload $archiveName to /root/" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2 - Using pscp (from PuTTY):" -ForegroundColor Cyan
    Write-Host "  pscp $archiveName ${Username}@${ServerIP}:/root/" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter when file transfer is complete"
} else {
    # Transfer using scp
    Write-Host "   Password: $Password" -ForegroundColor Gray
    & scp $archiveName "${Username}@${ServerIP}:/root/"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✓ Files transferred successfully" -ForegroundColor Green
    } else {
        Write-Host "   ✗ File transfer failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "[4/5] Connecting to server and running setup..." -ForegroundColor Yellow
Write-Host ""

# Create a temporary script for server setup
$serverScript = @"
#!/bin/bash
set -e

echo "Extracting files..."
cd /root
apt-get install -y unzip
mkdir -p /var/www/linkedin-pilot
unzip -o linkedin-pilot.zip -d /var/www/linkedin-pilot/
cd /var/www/linkedin-pilot

echo "Running setup script..."
if [ -f deploy.sh ]; then
    chmod +x deploy.sh
    ./deploy.sh
else
    echo "Error: deploy.sh not found!"
    exit 1
fi

echo "Setup complete!"
"@

# Save script to temp file
$tempScriptPath = [System.IO.Path]::GetTempFileName()
Set-Content -Path $tempScriptPath -Value $serverScript

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps - Run on Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Connect to your server:" -ForegroundColor Yellow
Write-Host "   ssh ${Username}@${ServerIP}" -ForegroundColor White
Write-Host "   Password: $Password" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Run the setup script:" -ForegroundColor Yellow
Write-Host "   cd /root" -ForegroundColor White
Write-Host "   apt-get install -y unzip" -ForegroundColor White
Write-Host "   unzip -o linkedin-pilot.zip -d /var/www/linkedin-pilot/" -ForegroundColor White
Write-Host "   cd /var/www/linkedin-pilot" -ForegroundColor White
Write-Host "   chmod +x deploy.sh" -ForegroundColor White
Write-Host "   ./deploy.sh" -ForegroundColor White
Write-Host ""
Write-Host "3. Follow the DEPLOYMENT_GUIDE.md for remaining steps" -ForegroundColor Yellow
Write-Host ""
Write-Host "[5/5] Cleaning up..." -ForegroundColor Yellow

# Clean up
Remove-Item -Recurse -Force $deployDir -ErrorAction SilentlyContinue
Remove-Item $tempScriptPath -ErrorAction SilentlyContinue

Write-Host "   ✓ Temporary files removed" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Deployment package ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Archive created: $archiveName" -ForegroundColor White
Write-Host "See: DEPLOYMENT_GUIDE.md or QUICK_DEPLOY.md" -ForegroundColor White
Write-Host ""

# Ask if user wants to open the guide
$response = Read-Host "Open deployment guide? (y/n)"
if ($response -eq "y") {
    Start-Process "QUICK_DEPLOY.md"
}







