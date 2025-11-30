# API Errors Fix Documentation

## Errors Encountered

### 1. `/api/brand/discover` - 404 Not Found
**Error:** `Failed to load resource: the server responded with a status of 404 (Not Found)`

**Root Cause:** 
- The endpoint exists at `POST /api/brand/discover` (defined in `linkedpilot/routes/brand_assistant.py`)
- Frontend might be calling it as `GET` instead of `POST`
- Or the route might not be properly registered

**Solution:**
- Verify frontend is using `POST` method
- Ensure backend server has been restarted after route changes
- Check that `brand_router` is included in `api_router` (it is, at line 347 of `server.py`)

### 2. `/api/organization-materials/analyze` - CORS Error
**Error:** `Access to XMLHttpRequest at 'http://localhost:8000/api/organization-materials/analyze?org_id=...' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`

**Root Cause:**
- CORS middleware is configured correctly in `server.py` (lines 90-107)
- `http://localhost:3000` is in the `allow_origins` list
- Backend might need restart to apply CORS changes
- Or there might be a preflight OPTIONS request failing

**Solution:**
1. **Restart the backend server** to ensure CORS middleware is active:
   ```bash
   cd backend
   python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Verify CORS configuration** in `server.py`:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=[
           "http://localhost:3000",  # Frontend
           # ... other origins
       ],
       allow_credentials=True,
       allow_methods=["*"],  # Allows all HTTP methods including OPTIONS
       allow_headers=["*"],
       expose_headers=["*"]
   )
   ```

3. **Check browser Network tab:**
   - Look for OPTIONS preflight request
   - Verify it returns 200 with CORS headers
   - Check if POST request includes proper headers

## Current CORS Configuration

The CORS middleware is correctly configured in `backend/server.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # Main frontend
        "http://localhost:3001",
        "http://localhost:3002",      # Admin dashboard
        "http://localhost:4001",     # Admin dashboard alt port
        "http://192.168.0.101:3000",
        "https://mandi.media",
        "http://mandi.media",
        "https://admin.mandi.media",
        "http://admin.mandi.media",
    ],
    allow_credentials=True,
    allow_methods=["*"],              # All HTTP methods
    allow_headers=["*"],              # All headers
    expose_headers=["*"]              # Expose all headers
)
```

## API Endpoints Status

### ✅ Registered Endpoints

1. **Brand Discovery:**
   - `POST /api/brand/discover` - Defined in `linkedpilot/routes/brand_assistant.py:702`
   - Router prefix: `/brand`
   - Registered in `server.py:347`

2. **Organization Materials:**
   - `POST /api/organization-materials/analyze` - Defined in `linkedpilot/routes/organization_materials.py:206`
   - Router prefix: `/organization-materials`
   - Registered in `server.py:352`

## Troubleshooting Steps

1. **Verify Backend is Running:**
   ```powershell
   Get-NetTCPConnection -LocalPort 8000
   ```
   Should show `Listen` state

2. **Check Backend Logs:**
   - Look for route registration messages
   - Check for CORS-related errors
   - Verify MongoDB connection

3. **Test Endpoints Directly:**
   ```bash
   # Test brand discover (POST)
   curl -X POST http://localhost:8000/api/brand/discover \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com"}'
   
   # Test organization materials analyze (POST)
   curl -X POST "http://localhost:8000/api/organization-materials/analyze?org_id=YOUR_ORG_ID" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. **Check Frontend API Calls:**
   - Verify request method (POST vs GET)
   - Check request headers
   - Verify API base URL is `http://localhost:8000`

## Quick Fix

**Most likely solution:** Restart the backend server to ensure:
- CORS middleware is active
- All routes are properly registered
- Configuration changes are applied

```bash
cd backend
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

## Date
November 20, 2025

