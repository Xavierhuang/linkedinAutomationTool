# Start All Services Locally - LinkedIn Pilot
# This script starts Backend, Frontend, and Admin Dashboard in separate windows

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "LINKEDIN PILOT - STARTING ALL SERVICES" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Check if MongoDB is running (optional check)
Write-Host "[INFO] Checking MongoDB connection..." -ForegroundColor Yellow
try {
    $mongoCheck = Test-NetConnection -ComputerName localhost -Port 27017 -WarningAction SilentlyContinue
    if ($mongoCheck.TcpTestSucceeded) {
        Write-Host "[OK] MongoDB is running on port 27017" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] MongoDB is NOT running on port 27017" -ForegroundColor Yellow
        Write-Host "         The backend will start but scheduler jobs will fail" -ForegroundColor Yellow
        Write-Host "         To start MongoDB:" -ForegroundColor Yellow
        Write-Host "         1. Install MongoDB Community Edition" -ForegroundColor White
        Write-Host "         2. Run: mongod (in a separate terminal)" -ForegroundColor White
        Write-Host "         OR use MongoDB as a service: net start MongoDB" -ForegroundColor White
        Write-Host ""
    }
} catch {
    Write-Host "[WARNING] Could not check MongoDB connection" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[1/3] Starting Backend Server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\backend'; Write-Host 'LinkedIn Pilot Backend Server' -ForegroundColor Green; Write-Host 'Port: http://localhost:8000' -ForegroundColor Cyan; Write-Host 'API Docs: http://localhost:8000/docs' -ForegroundColor Cyan; Write-Host ''; python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000"

# Wait a bit for backend to start
Start-Sleep -Seconds 3

Write-Host "[2/3] Starting Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\frontend'; Write-Host 'LinkedIn Pilot Frontend' -ForegroundColor Green; Write-Host 'URL: http://localhost:3000' -ForegroundColor Cyan; Write-Host ''; npm start"

# Wait a bit for frontend to start
Start-Sleep -Seconds 2

Write-Host "[3/3] Starting Admin Dashboard..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptPath\admin-dashboard'; Write-Host 'LinkedIn Pilot Admin Dashboard' -ForegroundColor Green; Write-Host 'URL: http://localhost:4001' -ForegroundColor Cyan; Write-Host ''; npm start"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "ALL SERVICES STARTING..." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services will open in separate windows:" -ForegroundColor Yellow
Write-Host "  Backend:     http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend:    http://localhost:3000" -ForegroundColor White
Write-Host "  Admin:       http://localhost:4001" -ForegroundColor White
Write-Host ""
Write-Host "Wait 10-15 seconds for all services to start, then:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "  2. Or open http://localhost:4001 for admin dashboard" -ForegroundColor White
Write-Host ""
Write-Host "API Documentation: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

