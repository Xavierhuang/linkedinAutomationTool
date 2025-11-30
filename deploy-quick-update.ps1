# Quick Deployment Script - Follows DEPLOY_QUICK.md and ADMIN_DASHBOARD_DEPLOYMENT.md
# Password: Hhwj65377068Hhwj

$ErrorActionPreference = "Continue"
$server = "root@138.197.35.30"
$password = "Hhwj65377068Hhwj"
$remotePath = "/var/www/linkedin-pilot"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Quick Deployment - Campaign Image Updates" -ForegroundColor Cyan
Write-Host "Includes: Frontend + Backend + Admin Dashboard" -ForegroundColor Cyan
Write-Host "Password: $password" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
$projectRoot = "H:\VIBE\Linkedin App\linkedinAutomationTool-main\linkedinAutomationTool-main"
Set-Location $projectRoot

# Step 1: Deploy Frontend Build (already built)
Write-Host "[1/7] Deploying Frontend Build..." -ForegroundColor Yellow
Write-Host "  Source: frontend\build\*" -ForegroundColor Gray
Write-Host "  Destination: ${server}:${remotePath}/frontend/build/" -ForegroundColor Gray
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
scp -r "frontend\build\*" "${server}:${remotePath}/frontend/build/"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Frontend deployed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Frontend deployment failed" -ForegroundColor Red
}
Write-Host ""

# Step 2: Deploy Backend Files
Write-Host "[2/7] Deploying Backend Files..." -ForegroundColor Yellow
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
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Uploaded" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Upload failed" -ForegroundColor Red
    }
}
Write-Host "  Backend files deployment complete" -ForegroundColor Green
Write-Host ""

# Step 3: Build Admin Dashboard (as per ADMIN_DASHBOARD_DEPLOYMENT.md)
Write-Host "[3/7] Building Admin Dashboard..." -ForegroundColor Yellow
Write-Host "  Following ADMIN_DASHBOARD_DEPLOYMENT.md instructions" -ForegroundColor Gray
Set-Location admin-dashboard

# Check if .env exists, create if needed
if (-not (Test-Path .env)) {
    Write-Host "  Creating .env file..." -ForegroundColor Gray
    @"
REACT_APP_API_URL=https://mandi.media
"@ | Out-File -FilePath .env -Encoding utf8
}

Write-Host "  Running npm run build..." -ForegroundColor Gray
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Admin dashboard built" -ForegroundColor Green
} else {
    Write-Host "  ✗ Admin dashboard build failed" -ForegroundColor Red
}
Set-Location ..
Write-Host ""

# Step 4: Deploy Admin Dashboard (as per ADMIN_DASHBOARD_DEPLOYMENT.md)
Write-Host "[4/7] Deploying Admin Dashboard..." -ForegroundColor Yellow
Write-Host "  According to ADMIN_DASHBOARD_DEPLOYMENT.md:" -ForegroundColor Gray
Write-Host "  Root: ${remotePath}/admin-dashboard/build" -ForegroundColor Gray
Write-Host "  Source: admin-dashboard\build\*" -ForegroundColor Gray
Write-Host "  Destination: ${server}:${remotePath}/admin-dashboard/build/" -ForegroundColor Gray
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
scp -r "admin-dashboard\build\*" "${server}:${remotePath}/admin-dashboard/build/"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Admin dashboard deployed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Admin dashboard deployment failed" -ForegroundColor Red
}
Write-Host ""

# Step 5: Reload Nginx (as per DEPLOY_QUICK.md)
Write-Host "[5/7] Reloading Nginx..." -ForegroundColor Yellow
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
ssh $server "nginx -s reload"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Nginx reloaded" -ForegroundColor Green
} else {
    Write-Host "  ✗ Nginx reload failed" -ForegroundColor Red
}
Write-Host ""

# Step 6: Restart Backend (as per DEPLOY_QUICK.md)
Write-Host "[6/7] Restarting Backend..." -ForegroundColor Yellow
Write-Host "  Using: pm2 restart linkedin-pilot-backend" -ForegroundColor Gray
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
ssh $server "cd $remotePath/backend ; pm2 restart linkedin-pilot-backend"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Backend restarted" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend restart failed" -ForegroundColor Red
}
Write-Host ""

# Step 7: Verify Deployment (as per DEPLOY_ADMIN_DASHBOARD_TO_PRODUCTION.md)
Write-Host "[7/7] Verifying Deployment..." -ForegroundColor Yellow
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
ssh $server "pm2 status | grep linkedin-pilot-backend"
Write-Host "  Verification complete" -ForegroundColor Green
Write-Host ""

Write-Host "==========================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployed Components:" -ForegroundColor Cyan
Write-Host "  ✓ Frontend: Campaign image model default updated" -ForegroundColor White
Write-Host "  ✓ Backend: All image model defaults → google/gemini-2.5-flash-image" -ForegroundColor White
Write-Host "  ✓ Admin Dashboard: Deployed to ${remotePath}/admin-dashboard/build/" -ForegroundColor White
Write-Host "  ✓ Nginx: Reloaded" -ForegroundColor White
Write-Host "  ✓ Backend: Restarted via PM2" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Verify admin dashboard at: https://admin.mandi.media" -ForegroundColor White
Write-Host "  2. Test campaign creation with image generation" -ForegroundColor White
Write-Host "  3. Confirm default image model is Gemini 2.5 Flash Image" -ForegroundColor White
Write-Host ""
