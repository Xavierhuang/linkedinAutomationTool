# 🔄 Restart Backend to Enable Organization Materials

## What Changed

The Organization Materials routes have been registered with the FastAPI app. You need to restart the backend server for the changes to take effect.

## How to Restart

### Option 1: Stop and Start (Recommended)

**Windows (PowerShell/CMD):**
```bash
# 1. Stop the current backend (Ctrl+C in the terminal running it)

# 2. Navigate to backend directory
cd backend

# 3. Start the backend again
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

**Mac/Linux:**
```bash
# 1. Stop the current backend (Ctrl+C in the terminal running it)

# 2. Navigate to backend directory
cd backend

# 3. Start the backend again
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Option 2: If Using --reload Flag

If you started the backend with `--reload` flag, it should auto-reload. But if it doesn't:

1. Press `Ctrl+C` to stop
2. Run the start command again

### Option 3: Kill Process (If stuck)

**Windows:**
```powershell
# Find the process
netstat -ano | findstr :8000

# Kill it (replace PID with the actual process ID)
taskkill /PID <PID> /F

# Start again
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

**Mac/Linux:**
```bash
# Find and kill the process
lsof -ti:8000 | xargs kill -9

# Start again
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

## Verify It's Working

After restarting, check the backend logs. You should see:

```
INFO:     Started server process [PID]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

## Test the Routes

Open your browser and test:

1. **List materials endpoint:**
   ```
   http://localhost:8000/api/organization-materials?org_id=YOUR_ORG_ID
   ```
   Should return: `[]` (empty array, not 404)

2. **Check API docs:**
   ```
   http://localhost:8000/docs
   ```
   Look for "organization-materials" section

## Frontend Steps

After backend is running:

1. **Refresh your browser** (Ctrl+R or Cmd+R)
2. **Go to Organizations tab**
3. **Click the blue "Materials" button** on your organization
4. **Try adding a URL** (e.g., https://manditutors.com/)

## Expected Behavior

✅ **Before (404 errors):**
```
Failed to load resource: the server responded with a status of 404 (Not Found)
```

✅ **After (working):**
```
Materials modal opens
Can add URLs
Can upload files
Can analyze materials
```

## Troubleshooting

### Still Getting 404?

1. **Check backend is running:**
   ```bash
   curl http://localhost:8000/api/
   ```
   Should return: `{"message":"Social Media Scheduler API"}`

2. **Check routes are registered:**
   ```bash
   curl http://localhost:8000/docs
   ```
   Look for `/api/organization-materials` endpoints

3. **Check backend logs:**
   Look for any import errors or startup errors

### Import Errors?

If you see import errors related to `organization_materials`:

```bash
# Install missing dependencies
cd backend
pip install beautifulsoup4 aiofiles python-docx pdfplumber
```

### Module Not Found?

If you see "Module not found" errors:

```bash
# Make sure you're in the backend directory
cd backend

# Reinstall requirements
pip install -r requirements.txt
```

## Quick Test Command

After restarting, run this to test:

```bash
curl http://localhost:8000/api/organization-materials?org_id=test
```

**Expected:** `[]` (empty array)
**Not:** 404 error

## Success Checklist

- [ ] Backend restarted successfully
- [ ] No errors in backend logs
- [ ] `/api/organization-materials` endpoints visible in `/docs`
- [ ] Test curl command returns `[]` not 404
- [ ] Frontend refreshed
- [ ] Materials button visible in Organizations tab
- [ ] Can click Materials button without errors

---

**Once all checks pass, you're ready to use the Organization Materials feature!** 🎉
