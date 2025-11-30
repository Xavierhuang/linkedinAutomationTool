# Continue Deployment - Complete Remaining Steps
# Password: Hhwj65377068Hhwj

$ErrorActionPreference = "Continue"
$server = "root@138.197.35.30"
$password = "Hhwj65377068Hhwj"
$remotePath = "/var/www/linkedin-pilot"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Completing Deployment..." -ForegroundColor Cyan
Write-Host "Password: $password" -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Complete Admin Dashboard Deployment
Write-Host "[1/3] Completing Admin Dashboard Deployment..." -ForegroundColor Yellow
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
scp -r "admin-dashboard\build\*" "${server}:${remotePath}/admin-dashboard/build/"
Write-Host "  Admin dashboard deployment complete" -ForegroundColor Green
Write-Host ""

# Step 2: Reload Nginx
Write-Host "[2/3] Reloading Nginx..." -ForegroundColor Yellow
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
ssh $server "nginx -s reload"
Write-Host "  Nginx reloaded" -ForegroundColor Green
Write-Host ""

# Step 3: Restart Backend
Write-Host "[3/3] Restarting Backend..." -ForegroundColor Yellow
Write-Host "  Enter password when prompted: $password" -ForegroundColor Yellow
ssh $server "cd $remotePath/backend ; pm2 restart linkedin-pilot-backend"
Write-Host "  Backend restarted" -ForegroundColor Green
Write-Host ""

Write-Host "==========================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "All services updated and restarted:" -ForegroundColor Cyan
Write-Host "  - Frontend: Deployed" -ForegroundColor White
Write-Host "  - Backend: Files deployed and restarted" -ForegroundColor White
Write-Host "  - Admin Dashboard: Deployed" -ForegroundColor White
Write-Host "  - Nginx: Reloaded" -ForegroundColor White
Write-Host "  - Backend: Restarted via PM2" -ForegroundColor White
Write-Host ""








