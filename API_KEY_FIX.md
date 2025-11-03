# 🔑 API Key Detection Fix

## Problem

The system was looking for API keys using `org_id`, but they're actually stored by `user_id`. This caused the "No API key configured" error even when you had an OpenAI API key set up.

## What Was Fixed

### Before (Broken)
```python
# ❌ Looking for settings by org_id
settings = await db.user_settings.find_one({"org_id": org_id}, {"_id": 0})
api_key = settings.get('openai_api_key')  # Not decrypted!
```

### After (Fixed)
```python
# ✅ Get user_id from organization
org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
user_id = org.get('created_by')

# ✅ Look for settings by user_id
settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})

# ✅ Decrypt all API keys and try each one
from ..routes.settings import decrypt_value
api_key = (
    decrypt_value(settings.get('openrouter_api_key', '')) or 
    decrypt_value(settings.get('openai_api_key', '')) or 
    decrypt_value(settings.get('google_ai_api_key', ''))
)
```

## What Changed

1. **Correct Lookup**: Now looks up settings by `user_id` (not `org_id`)
2. **Decryption**: Properly decrypts encrypted API keys
3. **Multiple Providers**: Tries OpenRouter, OpenAI, and Google AI keys
4. **Better Error**: Shows clearer error message if no key found

## Files Modified

- `backend/linkedpilot/routes/organization_materials.py`
  - Fixed `/analyze` endpoint
  - Fixed `/generate-campaign` endpoint

## How It Works Now

```
1. User clicks "Analyze"
   ↓
2. System gets org_id from request
   ↓
3. Looks up organization in database
   ↓
4. Gets user_id from organization.created_by
   ↓
5. Looks up user_settings by user_id
   ↓
6. Decrypts API keys (they're encrypted in DB)
   ↓
7. Tries OpenRouter → OpenAI → Google AI
   ↓
8. Uses first available key
   ↓
9. Analysis proceeds! ✅
```

## Why It Failed Before

1. **Wrong Lookup Key**: Used `org_id` instead of `user_id`
2. **No Decryption**: API keys are encrypted in database
3. **Single Provider**: Only checked one provider

## Testing

After restarting the backend, your OpenAI API key should now be detected automatically!

### Test Steps

1. **Restart Backend**
   ```bash
   # Stop backend (Ctrl+C)
   cd backend
   python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Refresh Browser**
   ```
   Press Ctrl+R or Cmd+R
   ```

3. **Try Analysis**
   - Go to Organizations tab
   - Click "Materials" button
   - Click "Add Website" (if shown)
   - Click "Analyze & Generate Insights"
   - Should work now! ✅

## Expected Behavior

### Before Fix
```
❌ Analysis failed: 400: No API key configured
```

### After Fix
```
✅ Analysis complete!
   Brand Voice: professional
   Content Pillars: 6
   Suggested Campaigns: 5
```

## Supported API Keys

The system now properly detects:

1. **OpenRouter** (`openrouter_api_key`)
   - Starts with `sk-or-`
   - Access to multiple models

2. **OpenAI** (`openai_api_key`)
   - Starts with `sk-`
   - GPT-4, GPT-4o, etc.

3. **Google AI** (`google_ai_api_key`)
   - Gemini models
   - Free tier available

## Priority Order

If you have multiple keys configured, the system uses them in this order:

1. OpenRouter (first choice)
2. OpenAI (second choice)
3. Google AI (third choice)

## Verification

To verify your API key is configured:

1. **Check Settings**
   - Go to Settings tab
   - Look for API Providers section
   - Your OpenAI key should be there (masked)

2. **Check Backend Logs**
   After clicking "Analyze", you should see:
   ```
   🔍 Analyzing Organization Materials
      Organization: your-org-id
   📚 Found X materials to analyze
   ```
   
   NOT:
   ```
   ❌ Analysis failed: No API key configured
   ```

## Troubleshooting

### Still Getting "No API key configured"?

1. **Check Settings**
   - Go to Settings > API Providers
   - Make sure OpenAI API Key field has a value
   - Click Save if you just added it

2. **Restart Backend**
   - The fix requires a backend restart
   - Stop and start the backend server

3. **Check Organization**
   - Make sure the organization has a `created_by` field
   - This should be your user ID

4. **Check Database**
   ```javascript
   // In MongoDB
   db.user_settings.findOne({ user_id: "your-user-id" })
   // Should show encrypted API keys
   ```

### API Key Not Decrypting?

If the key exists but won't decrypt:

1. **Check JWT_SECRET_KEY**
   - Must be the same as when key was encrypted
   - Set in environment variables

2. **Re-save API Key**
   - Go to Settings
   - Re-enter your API key
   - Click Save

## Security Note

API keys are:
- ✅ Encrypted in database
- ✅ Decrypted only when needed
- ✅ Never sent to frontend
- ✅ Never logged in plain text

## Next Steps

After restarting the backend:

1. ✅ Your OpenAI API key will be detected
2. ✅ Analysis will work
3. ✅ Campaign generation will work
4. ✅ You can start generating campaigns!

---

**The API key detection is now fixed and will properly find your OpenAI API key!** 🎉
