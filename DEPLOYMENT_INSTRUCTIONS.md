# Deployment Instructions - Text Overlay & UI Updates

## 📋 Summary of Changes

This deployment includes:

1. **Text Overlay Modal Enhancements**:
   - 40% scaled image with zoom controls (50%-200%)
   - Left-click drag to pan canvas
   - Mouse wheel zoom in/out
   - Dynamic Google Fonts loading
   - No default stroke on text (0 instead of 2)
   - Default editor settings state
   - Grab cursor while panning

2. **Backend Updates**:
   - Google AI Studio prioritized for AI text overlay generation
   - Fixed hashtag placement in scheduled posts
   - Admin dashboard port 4001 configuration

3. **AI Improvements**:
   - Multi-provider fallback (Google → OpenAI → Anthropic → OpenRouter)
   - LLM adapter backward compatibility

---

## 🚀 Quick Deployment (Frontend Only)

Since these are primarily frontend changes, you can deploy just the updated files:

### Option 1: Quick Frontend Deployment

```powershell
# 1. Build frontend
cd "H:\VIBE\Linkedin App\Linkedin-Pilot\frontend"
npm run build

# 2. Deploy to server
scp -r build/* root@138.197.35.30:/var/www/linkedin-pilot/frontend/build/

# 3. Reload nginx
ssh root@138.197.35.30 "nginx -s reload"
```

### Option 2: Deploy Specific Files Only

If you want to deploy individual files:

```powershell
# Frontend text overlay modal
scp "frontend/src/pages/linkedpilot/components/TextOverlayModal.js" root@138.197.35.30:/var/www/linkedin-pilot/frontend/src/pages/linkedpilot/components/

# Backend drafts route
scp "backend/linkedpilot/routes/drafts.py" root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/routes/

# Backend LLM adapter
scp "backend/linkedpilot/adapters/llm_adapter.py" root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/adapters/

# Restart backend
ssh root@138.197.35.30 "cd /var/www/linkedin-pilot/backend && pm2 restart linkedin-pilot-backend"
```

---

## 📦 Full Deployment Package

### Create Lightweight Deployment ZIP

Run this PowerShell script:

```powershell
# Create deployment directory
New-Item -ItemType Directory -Force -Path "deployment-package"

# Copy essential files only
Copy-Item -Path "backend\linkedpilot\**\*.py" -Destination "deployment-package\backend\linkedpilot\" -Recurse
Copy-Item -Path "backend\requirements.txt" -Destination "deployment-package\backend\" -Recurse
Copy-Item -Path "backend\server.py" -Destination "deployment-package\backend\" -Recurse

Copy-Item -Path "frontend\src" -Destination "deployment-package\frontend\" -Recurse
Copy-Item -Path "frontend\public" -Destination "deployment-package\frontend\" -Recurse
Copy-Item -Path "frontend\package.json" -Destination "deployment-package\frontend\"
Copy-Item -Path "frontend\package-lock.json" -Destination "deployment-package\frontend\"

Copy-Item -Path "ecosystem.config.js" -Destination "deployment-package\"
Copy-Item -Path "nginx.conf" -Destination "deployment-package\"
Copy-Item -Path "*.md" -Destination "deployment-package\" -Exclude "deployment-package"

# Create ZIP
Compress-Archive -Path "deployment-package\*" -DestinationPath "linkedin-pilot-update.zip" -Force

# Cleanup
Remove-Item -Path "deployment-package" -Recurse -Force

Write-Host "Deployment ZIP created: linkedin-pilot-update.zip" -ForegroundColor Green
```

---

## 🔄 Full Deployment Steps

### Step 1: SSH into Server

```powershell
ssh root@138.197.35.30
# Password: Hhwj65377068Hhwj
```

### Step 2: Backup Current Version

```bash
# Backup frontend
cd /var/www/linkedin-pilot
cp -r frontend/build frontend/build.backup-$(date +%Y%m%d-%H%M%S)

# Backup specific files
cp backend/linkedpilot/routes/drafts.py backend/linkedpilot/routes/drafts.py.backup
cp backend/linkedpilot/adapters/llm_adapter.py backend/linkedpilot/adapters/llm_adapter.py.backup
```

### Step 3: Upload New Files

From your Windows machine:

```powershell
# Upload frontend build
cd frontend
npm run build
scp -r build/* root@138.197.35.30:/var/www/linkedin-pilot/frontend/build/

# Upload backend files
scp backend/linkedpilot/routes/drafts.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/routes/
scp backend/linkedpilot/adapters/llm_adapter.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/adapters/
```

### Step 4: Restart Services

On the server:

```bash
# Restart backend
pm2 restart linkedin-pilot-backend

# Reload nginx
nginx -s reload

# Check status
pm2 status
pm2 logs linkedin-pilot-backend --lines 50
```

### Step 5: Verify Deployment

```bash
# Check backend health
curl http://localhost:8000/api/health

# Check services
pm2 status

# View logs
pm2 logs --lines 200
```

Open browser: **http://138.197.35.30**

---

## ✅ Post-Deployment Testing

### Test Text Overlay Features

1. **Go to drafts page**
2. **Click "Add Image" or edit existing image**
3. **Click "Add Text Overlay"**
4. **Test features**:
   - [x] Left-click drag to pan
   - [x] Mouse wheel to zoom
   - [x] Double-click to add text
   - [x] Text has no stroke by default
   - [x] Google Fonts load properly
   - [x] AI Design button works
   - [x] Zoom controls in bottom right

### Test Backend

```bash
# Test AI text overlay endpoint
curl -X POST http://localhost:8000/api/drafts/generate-text-overlay \
  -H "Content-Type: application/json" \
  -d '{"content":"Test campaign","hashtags":["#test"],"imagePrompt":"business image","imageDescription":"modern office"}'

# Should return array of text elements
```

---

## 🔙 Rollback Instructions

If something goes wrong:

```bash
# Rollback frontend
cd /var/www/linkedin-pilot
rm -rf frontend/build
cp -r frontend/build.backup-YYYYMMDD-HHMMSS frontend/build
nginx -s reload

# Rollback backend
cp backend/linkedpilot/routes/drafts.py.backup backend/linkedpilot/routes/drafts.py
cp backend/linkedpilot/adapters/llm_adapter.py.backup backend/linkedpilot/adapters/llm_adapter.py
pm2 restart linkedin-pilot-backend
```

---

## 📝 Files Changed

### Frontend
- `frontend/src/pages/linkedpilot/components/TextOverlayModal.js` - Major refactor

### Backend
- `backend/linkedpilot/routes/drafts.py` - AI provider prioritization
- `backend/linkedpilot/adapters/llm_adapter.py` - LLM complete method alias

### Admin Dashboard
- `admin-dashboard/package.json` - Port 4001 configuration

---

## 🎯 Quick Deployment Command Summary

**Windows PowerShell**:
```powershell
cd "H:\VIBE\Linkedin App\Linkedin-Pilot"
cd frontend
npm run build
scp -r build/* root@138.197.35.30:/var/www/linkedin-pilot/frontend/build/
scp ..\backend\linkedpilot\routes\drafts.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/routes/
scp ..\backend\linkedpilot\adapters\llm_adapter.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/adapters/
ssh root@138.197.35.30 "pm2 restart linkedin-pilot-backend && nginx -s reload"
```

---

## 📞 Support

If you encounter issues:
1. Check logs: `pm2 logs linkedin-pilot-backend`
2. Check browser console for errors
3. Verify MongoDB is running: `systemctl status mongod`
4. Rollback if needed (see above)

---

**Deployment Date:** ___________  
**Deployed By:** ___________  
**Status:** [ ] Pending [ ] In Progress [ ] Complete ✅


