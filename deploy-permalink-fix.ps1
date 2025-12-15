# Quick Deployment Script - Text Overlay Permalink Fix
# Deploys short permalink system for text editor URLs

$ErrorActionPreference = "Continue"
$server = "root@138.197.35.30"
$password = "Hhwj65377068Hhwj"
$remotePath = "/var/www/linkedin-pilot"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Deploying Text Overlay Permalink Fix" -ForegroundColor Cyan
Write-Host "Short URL system for text editor" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project directory
$projectRoot = "H:\VIBE\Linkedin App\linkedinAutomationTool-main\linkedinAutomationTool-main"
Set-Location $projectRoot

# Step 1: Deploy Backend File
Write-Host "[1/5] Deploying Backend Changes..." -ForegroundColor Yellow
Write-Host "  → text_editor.py (session endpoints)" -ForegroundColor Gray
scp "backend\linkedpilot\routes\text_editor.py" "${server}:${remotePath}/backend/linkedpilot/routes/text_editor.py"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Backend file deployed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend deployment failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Deploy Frontend Files
Write-Host "[2/5] Deploying Frontend Changes..." -ForegroundColor Yellow
$frontendFiles = @(
    @{Source="frontend\src\pages\linkedpilot\components\TextEditorPage.js"; Dest="${remotePath}/frontend/src/pages/linkedpilot/components/TextEditorPage.js"},
    @{Source="frontend\src\pages\linkedpilot\components\BeeBotDraftsView.js"; Dest="${remotePath}/frontend/src/pages/linkedpilot/components/BeeBotDraftsView.js"},
    @{Source="frontend\src\pages\linkedpilot\components\CalendarView.js"; Dest="${remotePath}/frontend/src/pages/linkedpilot/components/CalendarView.js"}
)

foreach ($file in $frontendFiles) {
    Write-Host "  Uploading $($file.Source)..." -ForegroundColor Gray
    scp $file.Source "${server}:$($file.Dest)"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Uploaded" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Upload failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  ✓ Frontend files deployed" -ForegroundColor Green
Write-Host ""

# Step 3: Build Frontend
Write-Host "[3/5] Building Frontend..." -ForegroundColor Yellow
Write-Host "  This will take 2-3 minutes..." -ForegroundColor Gray
ssh $server "cd $remotePath/frontend ; npm install --quiet ; npm run build"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Frontend built" -ForegroundColor Green
} else {
    Write-Host "  ✗ Frontend build failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 4: Restart Backend
Write-Host "[4/5] Restarting Backend..." -ForegroundColor Yellow
ssh $server "cd $remotePath ; pm2 restart linkedin-pilot-backend"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Backend restarted" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend restart failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Reload Nginx
Write-Host "[5/5] Reloading Nginx..." -ForegroundColor Yellow
ssh $server "nginx -s reload"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Nginx reloaded" -ForegroundColor Green
} else {
    Write-Host "  ✗ Nginx reload failed" -ForegroundColor Red
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployed Changes:" -ForegroundColor Cyan
Write-Host "  ✓ Backend: Session endpoints for short permalinks" -ForegroundColor White
Write-Host "  ✓ Frontend: TextEditorPage, BeeBotDraftsView, CalendarView" -ForegroundColor White
Write-Host "  ✓ URLs now use short tokens instead of long query params" -ForegroundColor White
Write-Host ""
Write-Host "Test the changes:" -ForegroundColor Yellow
Write-Host "  1. Open a post with an image in BeeBot or Calendar" -ForegroundColor White
Write-Host "  2. Click 'Edit Image' button" -ForegroundColor White
Write-Host "  3. Verify URL is short: /text-editor?token=AbC123..." -ForegroundColor White
Write-Host ""







