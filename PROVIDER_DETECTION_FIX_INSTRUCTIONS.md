# Provider Detection Fix - Manual Instructions

## The Issue

The system is trying to use OpenRouter even though you have an OpenAI key. This happens because:
1. You might have an empty/invalid OpenRouter key saved
2. The detection logic checks OpenRouter first
3. Empty strings after decryption are still "truthy" in Python

## Quick Fix

You have two options:

### Option 1: Remove OpenRouter Key (Easiest)

1. Go to **Settings** > **API Providers**
2. Find the **OpenRouter** tab
3. **Clear/delete** the OpenRouter API Key field (make it completely empty)
4. Click **Save**
5. Go back and try analysis again

This will make the system skip OpenRouter and use your OpenAI key.

### Option 2: Use OpenRouter Instead

If you want to use OpenRouter (recommended for better model access):

1. Go to https://openrouter.ai/
2. Sign up (free)
3. Go to Keys section
4. Create a new API key
5. **Add credits** (minimum $5): https://openrouter.ai/settings/credits
6. Copy the key
7. Go to Settings > API Providers > OpenRouter tab
8. Paste the key
9. Save

OpenRouter gives you access to Claude, GPT-4, Gemini, and more models.

## Why This Happens

The current code checks keys in this order:
```python
1. OpenRouter (first)
2. OpenAI (second)  
3. Google AI (third)
```

If you have an empty or invalid OpenRouter key saved, it tries to use it first and fails.

## Temporary Workaround

Until the backend is updated with the fix, you can:

1. **Clear OpenRouter key** in Settings
2. **Keep only OpenAI key** configured
3. **Save settings**
4. **Try analysis again**

## Permanent Fix (Already Implemented)

I've created a helper function that properly skips empty keys, but it requires:
1. Backend restart
2. The new code to be deployed

The fix checks if keys are actually valid (non-empty after decryption) before using them.

## Testing After Fix

After clearing the OpenRouter key:

1. Go to Organizations
2. Click Materials
3. Click "Add Website"
4. Click "Analyze & Generate Insights"
5. Should work with your OpenAI key! ✅

## Backend Logs to Check

After trying analysis, check backend logs for:

```
Using provider: openai  ← Should say "openai" not "openrouter"
API key starts with: sk-proj-... ← Should start with "sk-proj-" or "sk-"
```

If it says "openrouter", the OpenRouter key is still being picked up.

## Summary

**Immediate Action:**
1. Settings > API Providers > OpenRouter tab
2. Clear the OpenRouter API Key field
3. Save
4. Try analysis again

This will make it use your OpenAI key correctly!
