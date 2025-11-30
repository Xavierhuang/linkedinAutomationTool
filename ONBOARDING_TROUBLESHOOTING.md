# Onboarding Flow Troubleshooting Guide

## Current Issues & Solutions

### ❌ **Issue: Can't Get to Brand DNA Display Step**

**Symptoms:**
- Alert shows "Brand analysis failed"
- CORS errors in console
- 500 Internal Server Error on `/api/organization-materials/analyze`

**Root Causes:**
1. Old organization IDs cached in browser state
2. Backend might have crashed or restarted
3. MongoDB connection issues
4. API key configuration missing

---

## 🔧 **Quick Fixes (Try These First)**

### **Fix 1: Hard Refresh Browser** ⚡
This clears cached JavaScript and state:

**Windows/Linux:**
- `Ctrl + Shift + R`
- OR `Ctrl + F5`

**Mac:**
- `Cmd + Shift + R`

**Alternative:**
1. Press `F12` to open DevTools
2. Right-click the refresh button
3. Select **"Empty Cache and Hard Reload"**

---

### **Fix 2: Start Fresh** 🔄
1. **Clear browser local storage:**
   - Open DevTools (F12)
   - Go to Application tab
   - Click "Local Storage" → your site
   - Click "Clear All"
   
2. **Go back to onboarding start**
   - Refresh the page
   - Start from Step 1
   - Enter a **NEW website URL** (not one you tried before)

---

### **Fix 3: Check Backend Status** 🖥️

**Backend should be running at:**
- URL: http://localhost:8000
- Docs: http://localhost:8000/docs

**To verify:**
1. Open http://localhost:8000/docs in a new tab
2. If you see FastAPI docs → Backend is running ✅
3. If connection refused → Backend is down ❌

**If backend is down:**
```bash
cd backend
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

---

## 📋 **Step-by-Step Debugging**

### **Step 1: Verify Services Running**

**Check Backend:**
```bash
# Should see Python processes
Get-Process | Where-Object { $_.ProcessName -like "*python*" }
```

**Check Frontend:**
```bash
# Should see Node processes
Get-Process | Where-Object { $_.ProcessName -like "*node*" }
```

**Check MongoDB:**
- Open MongoDB Compass
- Or check if `mongod` process is running
- Default connection: `mongodb://localhost:27017`

---

### **Step 2: Check Console Errors**

Open Browser DevTools (F12) and look for:

**Good Signs:** ✅
- `Brand discovered: {...}` in console
- `Organization created with ID: ...` in console
- No red errors

**Bad Signs:** ❌
- `405 Method Not Allowed` → Old cached code
- `500 Internal Server Error` → Backend issue
- `CORS policy` errors → Backend not responding properly
- `Brand analysis failed` → Multiple possible causes

---

### **Step 3: Test Individual Endpoints**

Use browser or Postman to test:

**1. Health Check:**
```
GET http://localhost:8000/health
```
Should return: `{"status":"healthy"}`

**2. Brand Discovery:**
```
POST http://localhost:8000/api/brand/discover
Body: {"url": "https://stripe.com"}
```
Should return color palette, fonts, images

**3. Organizations List:**
```
GET http://localhost:8000/api/organizations?user_id=YOUR_USER_ID
```
Should return array of organizations

---

## 🐛 **Common Errors & Fixes**

### **Error: "405 Method Not Allowed"**

**Cause:** Browser cached old code trying to PUT to organizations

**Fix:**
1. Hard refresh browser (Ctrl + Shift + R)
2. Clear browser cache
3. Restart frontend server

---

### **Error: "CORS policy: No 'Access-Control-Allow-Origin'"**

**Cause:** This is usually a **misleading error**. The real issue is a 500 error on backend.

**What it actually means:**
- Backend endpoint crashed/errored (500)
- When server errors, CORS headers aren't sent
- Browser reports this as CORS error

**Fix:**
1. Check backend console for actual error
2. Restart backend server
3. Check MongoDB is running
4. Verify API keys configured

---

### **Error: "500 Internal Server Error" on /analyze**

**Possible Causes:**
1. **No materials uploaded** → Add website URL or files first
2. **MongoDB connection failed** → Check MongoDB is running
3. **API key missing** → Configure OpenAI/Gemini/Anthropic key
4. **Invalid organization ID** → Create new org

**Fix:**
1. **Check backend console output** for detailed error
2. **Verify MongoDB running:**
   ```bash
   # Windows
   net start MongoDB
   ```
3. **Check API keys configured:**
   - Go to Settings
   - Add OpenAI API key OR
   - Configure system API key in Admin Dashboard

---

## 🎯 **Recommended Testing Flow**

To test the new onboarding properly:

### **1. Fresh Start** 🆕
```bash
# Stop all servers
Get-Process | Where-Object { $_.ProcessName -like "*python*" -or $_.ProcessName -like "*node*" } | Stop-Process -Force

# Start backend
cd backend
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Start frontend (new terminal)
cd frontend
npm start
```

### **2. Clear Browser State** 🧹
- Hard refresh (Ctrl + Shift + R)
- OR clear local storage
- OR open incognito window

### **3. Test with Known-Good URL** 🌐
Use websites that work well:
- ✅ `stripe.com`
- ✅ `shopify.com`
- ✅ `openai.com`
- ✅ `github.com`

### **4. Watch Console Logs** 👀
Expected log flow:
```
1. Brand discovered: {title: "Stripe", colors: [...], ...}
2. Organization created with ID: uuid-here
3. Material added: {id: ...}
4. Content extracted successfully
5. Analysis complete: {brand_tone: [...], ...}
```

---

## ✅ **Expected Behavior (Working Flow)**

### **Step 1: LinkedIn Connection**
- Skip or connect
- No errors

### **Step 2: Tell Us About Your Business**
- Enter: `stripe.com`
- Click "Analyze & Build DNA"
- Loading messages appear:
  - "Discovering your brand identity..."
  - "Extracting brand identity from website..."
  - "Creating organization from brand..."
  - "Adding website materials..."
  - "Extracting content from website..."
  - "Analyzing brand with AI..."

### **Step 3: Your Business DNA** ✨
**You should see:**

1. **Organization Badge:**
   ```
   🌐 ORGANIZATION CREATED
      Stripe              ✓
      stripe.com
   ```

2. **BrandIdentityCard:**
   - Website screenshot
   - Color palette (hex circles)
   - Typography/fonts
   - Image gallery
   - Tone keywords
   - Keyword summary

3. **Analysis Cards:**
   - Brand Voice & Identity
   - Target Audience
   - Content Pillars

4. **Button:**
   - "Approve & Generate Campaigns"

### **Step 4: Choose a Campaign**
- 3 campaign cards
- Each shows: Tone, Schedule, Pillars
- Click to view details

### **Step 5 & 6: Complete**
- Review topics
- Generate posts
- Done!

---

## 🚨 **If Nothing Works**

### **Nuclear Option: Complete Reset**

```bash
# 1. Stop everything
Get-Process | Where-Object { $_.ProcessName -like "*python*" -or $_.ProcessName -like "*node*" } | Stop-Process -Force

# 2. Clear MongoDB (optional - only if desperate)
# Open MongoDB Compass
# Drop collections: organizations, organization_materials, brand_analysis

# 3. Restart backend
cd backend
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000

# 4. Restart frontend
cd frontend
npm start

# 5. Browser: Open incognito window
# Go to http://localhost:3000
# Start onboarding fresh
```

---

## 📞 **Getting More Help**

If still stuck:

1. **Check backend console** - Copy error messages
2. **Check browser console** - Copy error stack traces
3. **Test endpoints** - Use http://localhost:8000/docs
4. **Verify MongoDB** - Check connection in Compass
5. **Check API keys** - Settings page

**Include this info when asking for help:**
- Backend error messages
- Browser console errors
- MongoDB status
- API key configured (yes/no)
- What step you're stuck on






