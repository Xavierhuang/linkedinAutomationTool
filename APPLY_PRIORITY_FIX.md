# Apply API Provider Priority Fix

## What This Does

Changes the API provider priority order to:
1. **OpenAI** (1st priority - your key!)
2. **Google AI / Gemini** (2nd priority)
3. **Anthropic / Claude** (3rd priority)
4. **OpenRouter** (4th priority - fallback)

This way your OpenAI key will always be used first, even if you have other keys configured.

## Files Already Updated

✅ `backend/linkedpilot/utils/api_key_helper.py` - Helper function with new priority order

## Manual Fix Needed

Since the string appears twice in `organization_materials.py`, here's what to change:

### In `backend/linkedpilot/routes/organization_materials.py`

**Find this code block (appears TWICE - once in `analyze_materials` and once in `generate_campaign_config`):**

```python
# Get settings by user_id (not org_id)
settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
api_key = None
if settings:
    # Decrypt the API keys
    from ..routes.settings import decrypt_value
    encrypted_openrouter = settings.get('openrouter_api_key', '')
    encrypted_openai = settings.get('openai_api_key', '')
    encrypted_google = settings.get('google_ai_api_key', '')
    
    api_key = (
        decrypt_value(encrypted_openrouter) or 
        decrypt_value(encrypted_openai) or 
        decrypt_value(encrypted_google)
    )

if not api_key:
    raise HTTPException(status_code=400, detail="No API key configured. Please add an OpenAI, OpenRouter, or Google AI key in Settings.")

# Determine which provider to use based on which key is actually available
provider = "openai"  # default
if settings:
    from ..routes.settings import decrypt_value
    openrouter_key = decrypt_value(settings.get('openrouter_api_key', ''))
    openai_key = decrypt_value(settings.get('openai_api_key', ''))
    google_key = decrypt_value(settings.get('google_ai_api_key', ''))
    
    # Check which key matches the api_key we're using
    if api_key == openrouter_key and openrouter_key:
        provider = "openrouter"
    elif api_key == openai_key and openai_key:
        provider = "openai"
    elif api_key == google_key and google_key:
        provider = "google_ai_studio"

print(f"   Using provider: {provider}")
print(f"   API key starts with: {api_key[:10] if api_key else 'None'}...")
```

**Replace with:**

```python
# Get settings by user_id (not org_id)
settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})

# Get API key and provider using helper (priority: OpenAI → Gemini → Anthropic → OpenRouter)
from ..utils.api_key_helper import get_api_key_and_provider
api_key, provider = get_api_key_and_provider(settings, decrypt_value)

if not api_key:
    raise HTTPException(status_code=400, detail="No API key configured. Please add an OpenAI, Google AI, Anthropic, or OpenRouter key in Settings.")

print(f"   ✅ Using provider: {provider}")
print(f"   🔑 API key starts with: {api_key[:15] if api_key else 'None'}...")
```

**Do this replacement TWICE:**
1. Once around line 217 (in `analyze_materials` function)
2. Once around line 460 (in `generate_campaign_config` function)

## After Making Changes

1. **Save the file**
2. **Restart the backend:**
   ```bash
   # Stop backend (Ctrl+C)
   cd backend
   python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Test it:**
   - Refresh browser
   - Go to Organizations → Materials
   - Click "Analyze & Generate Insights"
   - Check backend logs - should say "Using provider: openai"

## Expected Output

After the fix, backend logs should show:
```
🔍 Analyzing Organization Materials
   Organization: your-org-id
📚 Found 1 materials to analyze
   ✅ Using provider: openai  ← OpenAI is now first!
   🔑 API key starts with: sk-proj-...
```

## Why This Works

The helper function now checks keys in this order:
1. OpenAI first
2. Google AI second
3. Anthropic third
4. OpenRouter last (fallback)

So even if you have multiple keys, it will always use OpenAI first!

## Alternative: Quick Test Without Code Changes

If you want to test immediately without code changes:

1. Go to Settings > API Providers
2. Temporarily remove/clear the OpenRouter key
3. Save
4. Try analysis
5. Should work with OpenAI!

Then you can add the OpenRouter key back later after the code fix is applied.
