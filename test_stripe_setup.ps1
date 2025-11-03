# Stripe Test Mode Setup Verification Script
# This script helps you verify your Stripe configuration

Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🧪 STRIPE TEST MODE - SETUP VERIFICATION             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Function to check if a service is running
function Test-Service {
    param($url, $name)
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 3 -ErrorAction Stop
        Write-Host "✅ $name is running" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ $name is NOT running" -ForegroundColor Red
        return $false
    }
}

# Check Backend
Write-Host "`n1️⃣  Checking Backend Server..." -ForegroundColor Yellow
$backendRunning = Test-Service "http://localhost:8000/docs" "Backend (Port 8000)"

if (-not $backendRunning) {
    Write-Host "   💡 Start backend with: cd backend; uvicorn server:app --reload" -ForegroundColor Gray
}

# Check Main Frontend
Write-Host "`n2️⃣  Checking Main Frontend..." -ForegroundColor Yellow
$frontendRunning = Test-Service "http://localhost:3000" "User Dashboard (Port 3000)"

if (-not $frontendRunning) {
    Write-Host "   💡 Start frontend with: cd frontend; npm start" -ForegroundColor Gray
}

# Check Admin Dashboard
Write-Host "`n3️⃣  Checking Admin Dashboard..." -ForegroundColor Yellow
$adminRunning = Test-Service "http://localhost:3002" "Admin Dashboard (Port 3002)"

if (-not $adminRunning) {
    Write-Host "   💡 Start admin with: cd admin-dashboard; npm start" -ForegroundColor Gray
}

# Check Stripe CLI
Write-Host "`n4️⃣  Checking Stripe CLI..." -ForegroundColor Yellow
try {
    $stripeVersion = stripe --version 2>&1
    if ($stripeVersion) {
        Write-Host "✅ Stripe CLI is installed" -ForegroundColor Green
        Write-Host "   Version: $stripeVersion" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Stripe CLI is NOT installed" -ForegroundColor Red
    Write-Host "   💡 Download from: https://github.com/stripe/stripe-cli/releases" -ForegroundColor Gray
}

# Check if user has Stripe keys ready
Write-Host "`n5️⃣  Stripe Keys Checklist:" -ForegroundColor Yellow
Write-Host "   Have you collected these from https://dashboard.stripe.com/test/apikeys ?" -ForegroundColor Gray
Write-Host ""
Write-Host "   [ ] Secret Key (sk_test_...)" -ForegroundColor White
Write-Host "   [ ] Publishable Key (pk_test_...)" -ForegroundColor White
Write-Host "   [ ] Created Pro Product" -ForegroundColor White
Write-Host "   [ ] Price ID (price_...)" -ForegroundColor White
Write-Host "   [ ] Webhook Secret (whsec_...) from stripe listen command" -ForegroundColor White

# Quick Test
Write-Host "`n6️⃣  Quick API Test:" -ForegroundColor Yellow

if ($backendRunning) {
    try {
        Write-Host "   Testing admin API keys endpoint..." -ForegroundColor Gray
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/admin/system-keys" `
            -Method GET `
            -TimeoutSec 3 `
            -ErrorAction Stop
        
        if ($response.StatusCode -eq 401 -or $response.StatusCode -eq 403) {
            Write-Host "   ✅ API is protected (requires admin login) - Good!" -ForegroundColor Green
        } elseif ($response.StatusCode -eq 200) {
            Write-Host "   ⚠️  API returned 200 - You can access keys endpoint" -ForegroundColor Yellow
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401 -or $statusCode -eq 403) {
            Write-Host "   ✅ API is protected (requires admin login) - Good!" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  API test inconclusive" -ForegroundColor Yellow
        }
    }
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  📋 NEXT STEPS                                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

if (-not $backendRunning) {
    Write-Host "⚠️  Start your backend first!" -ForegroundColor Yellow
    Write-Host "   cd backend" -ForegroundColor Gray
    Write-Host "   uvicorn server:app --reload`n" -ForegroundColor Gray
}

if (-not $adminRunning) {
    Write-Host "⚠️  Start your admin dashboard!" -ForegroundColor Yellow
    Write-Host "   cd admin-dashboard" -ForegroundColor Gray
    Write-Host "   npm start`n" -ForegroundColor Gray
}

Write-Host "📖 Follow the guide: STRIPE_TEST_MODE_SETUP.md" -ForegroundColor Cyan
Write-Host "⚡ Quick start: STRIPE_QUICK_START.md`n" -ForegroundColor Cyan

Write-Host "🧪 Test Flow:" -ForegroundColor White
Write-Host "   1. Get keys from Stripe Dashboard (test mode)" -ForegroundColor Gray
Write-Host "   2. Add keys in Admin Dashboard - API Keys - Stripe" -ForegroundColor Gray
Write-Host "   3. Go to User Dashboard - Settings - Billing & Usage" -ForegroundColor Gray
Write-Host "   4. Click Upgrade to Pro" -ForegroundColor Gray
Write-Host "   5. Use test card: 4242 4242 4242 4242" -ForegroundColor Gray
Write-Host "   6. Verify in Admin Dashboard (MRR should show dollar 49)`n" -ForegroundColor Gray

Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

