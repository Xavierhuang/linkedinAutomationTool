# Create Lightweight Deployment ZIP for LinkedIn Pilot

Write-Host "Creating Deployment ZIP Package..." -ForegroundColor Cyan

# Create temp directory
$deployDir = "deployment-package"
if (Test-Path $deployDir) { Remove-Item -Path $deployDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $deployDir | Out-Null

Write-Host "  Copying backend files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "$deployDir\backend\linkedpilot" | Out-Null
Copy-Item -Path "backend\linkedpilot\routes" -Destination "$deployDir\backend\linkedpilot\" -Recurse -Force
Copy-Item -Path "backend\linkedpilot\adapters" -Destination "$deployDir\backend\linkedpilot\" -Recurse -Force
Copy-Item -Path "backend\linkedpilot\utils" -Destination "$deployDir\backend\linkedpilot\" -Recurse -Force
Copy-Item -Path "backend\linkedpilot\db.py" -Destination "$deployDir\backend\linkedpilot\" -Force
Copy-Item -Path "backend\linkedpilot\models.py" -Destination "$deployDir\backend\linkedpilot\" -Force
Copy-Item -Path "backend\requirements.txt" -Destination "$deployDir\backend\" -Force
Copy-Item -Path "backend\server.py" -Destination "$deployDir\backend\" -Force

Write-Host "  Copying frontend files..." -ForegroundColor Yellow
Copy-Item -Path "frontend\src" -Destination "$deployDir\frontend\" -Recurse -Force
Copy-Item -Path "frontend\public" -Destination "$deployDir\frontend\" -Recurse -Force
Copy-Item -Path "frontend\package.json" -Destination "$deployDir\frontend\" -Force

Write-Host "  Copying admin dashboard..." -ForegroundColor Yellow
Copy-Item -Path "admin-dashboard\src" -Destination "$deployDir\admin-dashboard\" -Recurse -Force
Copy-Item -Path "admin-dashboard\public" -Destination "$deployDir\admin-dashboard\" -Recurse -Force
Copy-Item -Path "admin-dashboard\package.json" -Destination "$deployDir\admin-dashboard\" -Force

Write-Host "  Copying config files..." -ForegroundColor Yellow
Copy-Item -Path "ecosystem.config.js" -Destination "$deployDir\" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "nginx.conf" -Destination "$deployDir\" -Force -ErrorAction SilentlyContinue
Copy-Item -Path "DEPLOYMENT_INSTRUCTIONS.md" -Destination "$deployDir\" -Force -ErrorAction SilentlyContinue

$zipFile = "linkedin-pilot-deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Write-Host "  Creating ZIP..." -ForegroundColor Yellow
Compress-Archive -Path "$deployDir\*" -DestinationPath $zipFile -Force
Remove-Item -Path $deployDir -Recurse -Force

$zipSize = (Get-Item $zipFile).Length / 1MB
Write-Host ""
Write-Host "SUCCESS: Deployment ZIP created!" -ForegroundColor Green
Write-Host "  File: $zipFile" -ForegroundColor White
Write-Host "  Size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor White
Write-Host ""
Write-Host "Next: scp $zipFile root@138.197.35.30:/root/" -ForegroundColor Yellow
