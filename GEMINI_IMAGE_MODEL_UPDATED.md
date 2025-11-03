# Google Gemini 2.5 Flash Image (Nano Banana) Integration

## Summary
Updated the LinkedIn Pilot app to use **Google Gemini 2.5 Flash Image** (also known as "Nano Banana") from OpenRouter as the default image generation model.

## Changes Made

### 1. **Image Adapter (`backend/linkedpilot/adapters/image_adapter.py`)**

#### Default Provider & Model
- Changed default provider from `"openai"` to `"openrouter"`
- Changed default model from `"black-forest-labs/flux-1.1-pro"` to `"google/gemini-2.5-flash-image"`
- API key now falls back: OpenRouter API Key → OpenAI API Key (for flexibility)

#### API Implementation
- Added special handling for Gemini 2.5 Flash Image model
- Gemini uses the **`chat/completions`** endpoint (not `images/generations`)
- Request format:
  ```json
  {
    "model": "google/gemini-2.5-flash-image",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Generate an image: [prompt]"
          }
        ]
      }
    ]
  }
  ```

#### Response Parsing
- Added custom response parser for Gemini's format
- Gemini returns images in `choices[0].message.content[]` with `type: 'image_url'`
- Falls back to standard OpenAI format for other models (Flux, DALL-E, etc.)

### 2. **LLM Adapter (`backend/linkedpilot/adapters/llm_adapter.py`)**

#### Default Provider
- Changed default provider from `"openai"` to `"openrouter"`
- Allows access to Claude, Gemini, and other models through OpenRouter
- API key fallback: OpenRouter → OpenAI

### 3. **Drafts Route (`backend/linkedpilot/routes/drafts.py`)**

#### `/api/drafts/generate-image` Endpoint
- Now explicitly uses `provider="openrouter"` and `model="google/gemini-2.5-flash-image"`
- Added better error handling with HTTPException when API key is missing
- Better logging for debugging

#### Carousel Generation
- Updated to use Gemini 2.5 Flash Image for all carousel images
- Ensures consistent image quality across all slides

## Model Details

**Model Name:** `google/gemini-2.5-flash-image`
**Provider:** OpenRouter
**Nickname:** "Nano Banana"
**Documentation:** https://openrouter.ai/google/gemini-2.5-flash-image

### Features:
- Fast image generation
- High quality output
- Cost-effective
- Native multimodal support
- Professional LinkedIn post images

## API Key Setup

Users need to add their **OpenRouter API key** in Settings:
1. Go to Settings → API Keys
2. Add OpenRouter API key (it will also work with OpenAI API key)
3. The key is encrypted and stored securely

## Testing

To test the integration:
1. Make sure backend is running
2. Go to BeeBOT Drafts view
3. Ask BeeBOT to generate an image
4. Should use Gemini 2.5 Flash Image automatically

## Error Handling

- **No API Key:** Returns 400 error with clear message
- **Gemini API Error:** Logs full error with traceback
- **Unexpected Response:** Logs response format for debugging
- **CORS Issues:** Already handled in server.py

## Benefits

1. **Better Quality:** Gemini 2.5 Flash Image produces high-quality images
2. **Cost-Effective:** More affordable than DALL-E 3
3. **Fast:** Quick generation times
4. **Flexible:** OpenRouter gives access to multiple models
5. **Future-Proof:** Easy to switch models in the future

## Files Modified

- `backend/linkedpilot/adapters/image_adapter.py` - Main image generation logic
- `backend/linkedpilot/adapters/llm_adapter.py` - LLM provider defaults
- `backend/linkedpilot/routes/drafts.py` - Image generation endpoints

---

**Status:** ✅ Ready to use
**Date:** October 14, 2025
**Model:** Google Gemini 2.5 Flash Image (Nano Banana)

