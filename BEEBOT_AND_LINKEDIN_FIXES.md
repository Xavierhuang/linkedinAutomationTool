# Beebot API & LinkedIn OAuth Fixes

## Issues Fixed

### Issue 1: Beebot Not Retrieving APIs Correctly ✅

**Problem:**
- Beebot (AI content generation) was trying to retrieve API keys from **user settings** (`user_settings` collection)
- But API keys are now **system-wide** and managed by admin in the admin dashboard (`system_settings` collection with `_id: "api_keys"`)
- This caused content generation to fail with "No API key found" errors

**Root Cause:**
```python
# OLD (WRONG):
user_api_key, provider = await get_user_api_key(request.created_by, provider_name)
```

This was looking in the wrong place for API keys.

**Solution:**
Created new function `get_system_api_key()` that retrieves from admin-managed system settings:

```python
# NEW (CORRECT):
system_api_key, provider = await get_system_api_key(provider_name)
```

**Files Changed:**
1. `backend/linkedpilot/routes/drafts.py`:
   - Added `get_system_api_key()` function
   - Updated `generate_draft_content()` to use system keys
   - Updated `fetch_stock_image()` to use system keys (Unsplash, Pexels, OpenAI)
   - Updated `generate_image_for_draft()` to use system keys (DALL-E)
   - Changed error messages to say "Admin must configure system API keys"

**How It Works Now:**
1. Admin saves API keys in admin dashboard (`/api/admin/system-keys`)
2. Keys are encrypted with `ENCRYPTION_KEY` from `.env`
3. Stored in `system_settings` collection with `_id: "api_keys"`
4. Beebot retrieves from system settings for all users
5. Multi-provider fallback: OpenAI → Google AI → Anthropic → OpenRouter

---

### Issue 2: LinkedIn Connection Shows "Failed" But Works After Reload ✅

**Problem:**
- User clicks "Connect LinkedIn"
- LinkedIn OAuth completes successfully
- Popup closes
- Error message: "❌ LinkedIn connection failed"
- But after page reload, it's actually connected!

**Root Cause:**
1. OAuth popup closes before success message is sent via `postMessage`
2. Message listener catches error or times out
3. Shows failure alert even though OAuth succeeded
4. Connection status only checked on page reload

**Solution:**
Added **automatic connection status check** after popup closes:

```javascript
// OLD (WRONG):
const pollTimer = setInterval(() => {
  if (popup.closed) {
    clearInterval(pollTimer);
    setLinkedinLoading(false); // Just stop loading
  }
}, 500);
```

```javascript
// NEW (CORRECT):
const pollTimer = setInterval(() => {
  if (popup.closed) {
    clearInterval(pollTimer);
    // Check actual connection status (popup may have closed before message sent)
    setTimeout(() => {
      checkLinkedInConnection();
      setLinkedinLoading(false);
    }, 1000);
  }
}, 500);
```

Also updated error handler:
```javascript
} else if (event.data.type === 'linkedin-oauth-error') {
  popup?.close();
  window.removeEventListener('message', messageListener);
  // Even if error message received, check actual connection status
  // Sometimes OAuth succeeds but message fails
  setTimeout(() => {
    checkLinkedInConnection();
    setLinkedinLoading(false);
  }, 1000);
}
```

**Files Changed:**
1. `frontend/src/pages/linkedpilot/components/SettingsView.js`:
   - Added automatic connection check when popup closes
   - Added fallback connection check even on error message
   - Prevents false "failed" messages when OAuth actually succeeded

**How It Works Now:**
1. User clicks "Connect LinkedIn"
2. OAuth popup opens
3. User authorizes on LinkedIn
4. Popup closes (with or without sending message)
5. **Automatically checks actual connection status** after 1 second
6. Updates UI based on real connection state
7. No more false "failed" messages!

---

## Testing

### Test Beebot Fix:
1. **Admin**: Go to http://localhost:3002/api-keys
2. **Admin**: Add OpenAI/OpenRouter/Anthropic API key
3. **User**: Go to http://localhost:3000/dashboard/create
4. **User**: Type "Create a post about AI"
5. ✅ **Should generate content** (no "No API key found" error)

### Test LinkedIn Fix:
1. **User**: Go to http://localhost:3000/dashboard/settings
2. **User**: Click "Connect LinkedIn" button
3. OAuth popup opens
4. Authorize on LinkedIn
5. Popup closes
6. ✅ **Should auto-update** to show "Connected" (no reload needed)
7. ✅ **Should NOT show "failed" message** if OAuth succeeded

---

## Key Improvements

### Beebot API Retrieval:
- ✅ Uses system-wide API keys (admin-managed)
- ✅ Multi-provider fallback for reliability
- ✅ Better error messages for admins
- ✅ Stock images (Unsplash/Pexels) use system keys
- ✅ DALL-E image generation uses system keys
- ✅ Consistent encryption (uses `ENCRYPTION_KEY` from `.env`)

### LinkedIn OAuth:
- ✅ Auto-checks connection status after popup closes
- ✅ No false "failed" messages
- ✅ No manual page reload needed
- ✅ Works even if message event fails
- ✅ Better UX (instant feedback)

---

## Environment Variables Required

**Backend `.env`:**
```env
ENCRYPTION_KEY=your-fernet-key-here  # For encrypting system API keys
MONGO_URL=mongodb://localhost:27017
DB_NAME=linkedpilot
```

**Generate encryption key:**
```python
from cryptography.fernet import Fernet
key = Fernet.generate_key()
print(key.decode())
```

---

## Database Schema

**System Settings Collection:**
```javascript
{
  _id: "api_keys",
  openai_api_key: "encrypted_key_here",
  openrouter_api_key: "encrypted_key_here",
  anthropic_api_key: "encrypted_key_here",
  google_ai_api_key: "encrypted_key_here",
  unsplash_access_key: "encrypted_key_here",
  pexels_api_key: "encrypted_key_here"
}
```

---

## Deployment Notes

1. **Backend Changes**: Restart backend after deployment
2. **Frontend Changes**: Clear browser cache and reload
3. **Admin Action Required**: Save API keys in admin dashboard
4. **User Impact**: Beebot content generation will work for all users

---

**Date:** October 27, 2025  
**Status:** Complete ✅  
**Tested:** Ready for deployment









