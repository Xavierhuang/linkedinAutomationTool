# Create Essential Package for WhatsApp Share
$ErrorActionPreference = "Stop"

Write-Host "Creating essential package..." -ForegroundColor Green

# Create temp directory
$tempDir = "temp-essential-files"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy essential frontend files
Write-Host "Copying frontend files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$tempDir\frontend\src\pages\linkedpilot\components" -Force | Out-Null
Copy-Item "frontend\src\pages\linkedpilot\components\*.js" -Destination "$tempDir\frontend\src\pages\linkedpilot\components\" -Exclude "*.backup.js"
Copy-Item "frontend\package.json" -Destination "$tempDir\frontend\"
Copy-Item "frontend\craco.config.js" -Destination "$tempDir\frontend\" -ErrorAction SilentlyContinue

# Copy essential backend files
Write-Host "Copying backend files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$tempDir\backend\linkedpilot" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\linkedpilot\adapters" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\linkedpilot\routes" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\linkedpilot\models" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\linkedpilot\utils" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\linkedpilot\middleware" -Force | Out-Null

Copy-Item "backend\linkedpilot\adapters\*.py" -Destination "$tempDir\backend\linkedpilot\adapters\" -ErrorAction SilentlyContinue
Copy-Item "backend\linkedpilot\routes\*.py" -Destination "$tempDir\backend\linkedpilot\routes\" -ErrorAction SilentlyContinue
Copy-Item "backend\linkedpilot\models\*.py" -Destination "$tempDir\backend\linkedpilot\models\" -ErrorAction SilentlyContinue
Copy-Item "backend\linkedpilot\utils\*.py" -Destination "$tempDir\backend\linkedpilot\utils\" -ErrorAction SilentlyContinue
Copy-Item "backend\linkedpilot\middleware\*.py" -Destination "$tempDir\backend\linkedpilot\middleware\" -ErrorAction SilentlyContinue
Copy-Item "backend\linkedpilot\__init__.py" -Destination "$tempDir\backend\linkedpilot\" -ErrorAction SilentlyContinue
Copy-Item "backend\linkedpilot\scheduler_service.py" -Destination "$tempDir\backend\linkedpilot\" -ErrorAction SilentlyContinue

Copy-Item "backend\requirements.txt" -Destination "$tempDir\backend\"
Copy-Item "backend\server.py" -Destination "$tempDir\backend\"

# Copy essential admin dashboard files
Write-Host "Copying admin dashboard files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$tempDir\admin-dashboard\src\pages" -Force | Out-Null
Copy-Item "admin-dashboard\src\pages\*.js" -Destination "$tempDir\admin-dashboard\src\pages\" -ErrorAction SilentlyContinue
Copy-Item "admin-dashboard\src\App.js" -Destination "$tempDir\admin-dashboard\src\" -ErrorAction SilentlyContinue
Copy-Item "admin-dashboard\src\index.js" -Destination "$tempDir\admin-dashboard\src\" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "$tempDir\admin-dashboard\src\components" -Force | Out-Null
Copy-Item "admin-dashboard\src\components\*.js" -Destination "$tempDir\admin-dashboard\src\components\" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "$tempDir\admin-dashboard\src\contexts" -Force | Out-Null
Copy-Item "admin-dashboard\src\contexts\*.js" -Destination "$tempDir\admin-dashboard\src\contexts\" -ErrorAction SilentlyContinue
Copy-Item "admin-dashboard\package.json" -Destination "$tempDir\admin-dashboard\" -ErrorAction SilentlyContinue
Copy-Item "admin-dashboard\tailwind.config.js" -Destination "$tempDir\admin-dashboard\" -ErrorAction SilentlyContinue

# Copy documentation
Write-Host "Copying documentation..." -ForegroundColor Yellow
Copy-Item "README.md" -Destination "$tempDir\" -ErrorAction SilentlyContinue
Copy-Item "temp-essential-files\*.md" -Destination "$tempDir\" -ErrorAction SilentlyContinue
Copy-Item "ESSENTIAL_PACKAGE_INFO.txt" -Destination "$tempDir\" -ErrorAction SilentlyContinue

# Create zip file
Write-Host "Creating ZIP file..." -ForegroundColor Yellow
$zipName = "LinkedIn-Pilot-Essential-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
}
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -CompressionLevel Optimal

# Clean up
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item $tempDir -Recurse -Force

Write-Host "`n✅ Package created: $zipName" -ForegroundColor Green
Write-Host "File size: $([math]::Round((Get-Item $zipName).Length / 1MB, 2)) MB" -ForegroundColor Cyan

