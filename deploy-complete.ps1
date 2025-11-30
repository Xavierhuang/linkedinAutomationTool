# Complete Deployment - Following Admin Deployment Guides
# Password: Hhwj65377068Hhwj

$ErrorActionPreference = "Continue"
$server = "root@138.197.35.30"
$password = "Hhwj65377068Hhwj"
$remotePath = "/var/www/linkedin-pilot"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Complete Deployment" -ForegroundColor Cyan
Write-Host "Following ADMIN_DASHBOARD_DEPLOYMENT.md" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = "H:\VIBE\Linkedin App\linkedinAutomationTool-main\linkedinAutomationTool-main"
Set-Location $projectRoot

# Step 1: Ensure directories exist on server
Write-Host "[1/5] Preparing server directories..." -ForegroundColor Yellow
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
ssh $server "mkdir -p ${remotePath}/admin-dashboard/build ; mkdir -p ${remotePath}/frontend/build ; mkdir -p ${remotePath}/backend/linkedpilot/services ; mkdir -p ${remotePath}/backend/linkedpilot/routes"
Write-Host "  Directories ready" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy Admin Dashboard
Write-Host "[2/5] Deploying Admin Dashboard..." -ForegroundColor Yellow
Write-Host "  Path: ${remotePath}/admin-dashboard/build/ (per nginx config)" -ForegroundColor Gray
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
scp -r "admin-dashboard\build\*" "${server}:${remotePath}/admin-dashboard/build/"
Write-Host "  Admin dashboard deployed" -ForegroundColor Green
Write-Host ""

# Step 3: Deploy Backend Files
Write-Host "[3/5] Deploying Backend Files..." -ForegroundColor Yellow
$backendFiles = @(
    @{Source="backend\linkedpilot\services\campaign_generator.py"; Dest="${remotePath}/backend/linkedpilot/services/campaign_generator.py"},
    @{Source="backend\linkedpilot\routes\settings.py"; Dest="${remotePath}/backend/linkedpilot/routes/settings.py"},
    @{Source="backend\linkedpilot\scheduler_service.py"; Dest="${remotePath}/backend/linkedpilot/scheduler_service.py"},
    @{Source="backend\linkedpilot\routes\ai_content.py"; Dest="${remotePath}/backend/linkedpilot/routes/ai_content.py"}
)

foreach ($file in $backendFiles) {
    Write-Host "  Uploading $($file.Source)..." -ForegroundColor Gray
    Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
    scp $file.Source "${server}:$($file.Dest)"
}
Write-Host "  Backend files deployed" -ForegroundColor Green
Write-Host ""

# Step 4: Reload Nginx
Write-Host "[4/5] Reloading Nginx..." -ForegroundColor Yellow
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
ssh $server "nginx -s reload"
Write-Host "  Nginx reloaded" -ForegroundColor Green
Write-Host ""

# Step 5: Restart Backend
Write-Host "[5/5] Restarting Backend..." -ForegroundColor Yellow
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
ssh $server "cd $remotePath/backend ; pm2 restart linkedin-pilot-backend"
Write-Host "  Backend restarted" -ForegroundColor Green
Write-Host ""

Write-Host "==========================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployed to:" -ForegroundColor Cyan
Write-Host "  Admin Dashboard: ${remotePath}/admin-dashboard/build/" -ForegroundColor White
Write-Host "  Backend: ${remotePath}/backend/" -ForegroundColor White
Write-Host "  Nginx: Reloaded" -ForegroundColor White
Write-Host "  Backend: Restarted via PM2" -ForegroundColor White
Write-Host ""








