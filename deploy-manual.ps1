# Manual Deployment - One command at a time
# Password: Hhwj65377068Hhwj

$server = "root@138.197.35.30"
$password = "Hhwj65377068Hhwj"
$remotePath = "/var/www/linkedin-pilot"

Write-Host "Deploying Admin Dashboard..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
scp -r "admin-dashboard\build\*" "${server}:${remotePath}/admin-dashboard/build/"

Write-Host "`nDeploying campaign_generator.py..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
scp "backend\linkedpilot\services\campaign_generator.py" "${server}:${remotePath}/backend/linkedpilot/services/campaign_generator.py"

Write-Host "`nDeploying settings.py..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
scp "backend\linkedpilot\routes\settings.py" "${server}:${remotePath}/backend/linkedpilot/routes/settings.py"

Write-Host "`nDeploying scheduler_service.py..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
scp "backend\linkedpilot\scheduler_service.py" "${server}:${remotePath}/backend/linkedpilot/scheduler_service.py"

Write-Host "`nDeploying ai_content.py..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
scp "backend\linkedpilot\routes\ai_content.py" "${server}:${remotePath}/backend/linkedpilot/routes/ai_content.py"

Write-Host "`nReloading Nginx..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
ssh $server "nginx -s reload"

Write-Host "`nRestarting Backend..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
ssh $server "cd $remotePath/backend ; pm2 restart linkedin-pilot-backend"

Write-Host "`nDeployment Complete!" -ForegroundColor Green








