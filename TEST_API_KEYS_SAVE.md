# Test API Keys Save

## Steps to Test:

1. **Open Admin Dashboard**: http://localhost:3002/api-keys

2. **Open Browser Console** (F12)

3. **Add ONE API key** (e.g., OpenAI key)

4. **Click "Save Keys" button**

5. **Check Console for:**
   - Network request to `/api/admin/system-keys`
   - Response status (should be 200)
   - Any error messages

## Common Issues:

### Issue 1: 401 Unauthorized
- **Problem**: Not logged into admin dashboard
- **Fix**: Go to http://localhost:3002 and log in with admin account

### Issue 2: Network Error
- **Problem**: Backend not running
- **Fix**: Check backend PowerShell window

### Issue 3: 500 Internal Server Error
- **Problem**: ENCRYPTION_KEY not set
- **Fix**: Check backend `.env` file has `ENCRYPTION_KEY`

## After Saving:

Run this command to verify keys were saved:

```powershell
cd "H:\VIBE\Linkedin App\Linkedin-Pilot\backend"
python check_api_keys.py
```

Should show: `[OK] openai_api_key: sk-xxxxx...xxxx`

---

**If keys are NOT saving, please:**
1. Copy the **full error** from browser console
2. Copy the **network request details** (headers, payload, response)
3. Share with me so I can fix it









