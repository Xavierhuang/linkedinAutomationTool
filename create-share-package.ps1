# PowerShell script to create shareable package without node_modules
# Run: .\create-share-package.ps1

Write-Host "Creating shareable package..." -ForegroundColor Green

# Get current directory name
$projectName = Split-Path -Leaf (Get-Location)
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$zipName = "$projectName-share-$timestamp.zip"

# Create temporary directory
$tempDir = "temp-share-$timestamp"
Write-Host "Creating temporary copy..." -ForegroundColor Yellow

# Copy everything except excluded folders
robocopy . $tempDir /E /XD node_modules venv __pycache__ .git .vscode temp-share-* temp-check /XF *.zip *.log /NFL /NDL /NJH /NJS

# Create ZIP from the contents (not the temp folder itself)
Write-Host "Creating ZIP file..." -ForegroundColor Yellow
$files = Get-ChildItem -Path $tempDir -Recurse
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -Force

# Cleanup
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $tempDir

Write-Host "`nDone! Created: $zipName" -ForegroundColor Green
Write-Host "Size: $((Get-Item $zipName).Length / 1MB) MB" -ForegroundColor Cyan
Write-Host "`nYour original node_modules folder is still intact!" -ForegroundColor Green
