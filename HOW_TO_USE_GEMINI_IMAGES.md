# How to Use Google Gemini 2.5 Flash Image (Nano Banana)

## Quick Start

Your app now uses **Google Gemini 2.5 Flash Image** (Nano Banana) as the default image generation model! 🎨

## Setup (One-Time)

1. **Get an OpenRouter API Key:**
   - Go to https://openrouter.ai/
   - Sign up or log in
   - Get your API key

2. **Add Key to Your App:**
   - Open Settings in LinkedIn Pilot
   - Go to API Keys section
   - Paste your OpenRouter API key
   - Save (it will be encrypted)

## Usage

### Generate Images in BeeBOT Chat

Simply ask BeeBOT to create an image:

```
"Create an image about AI in business"
"Generate a professional image for a LinkedIn post about marketing"
"Make an image showing team collaboration"
```

BeeBOT will automatically use Gemini 2.5 Flash Image!

### Generate Carousel Images

When creating a carousel post:

```
"Create a 5-slide carousel about digital marketing"
```

All carousel images will be generated using Gemini 2.5 Flash Image.

### Custom Image Styles

You can specify different styles:

```
"Create a professional image about..." 
"Create a creative image about..."
"Create a minimalist image about..."
```

## Model Details

- **Model:** `google/gemini-2.5-flash-image`
- **Provider:** OpenRouter
- **Nickname:** Nano Banana 🍌
- **Quality:** High (1024x1024 by default)
- **Speed:** Fast (~3-5 seconds)
- **Cost:** Affordable

## Benefits

✅ **High Quality:** Professional images suitable for LinkedIn  
✅ **Fast:** Quick generation times  
✅ **Cost-Effective:** More affordable than DALL-E 3  
✅ **Reliable:** Google's production-ready model  
✅ **Flexible:** Works with various prompt styles  

## Troubleshooting

### "API key required" Error
- Make sure you've added your OpenRouter API key in Settings
- The key must be valid and have credits

### Image Not Generating
- Check your internet connection
- Verify your OpenRouter account has credits
- Check backend logs for detailed error messages

### CORS Errors
- Already fixed! CORS is configured correctly in server.py
- If you still see CORS errors, restart the backend server

### 500 Internal Server Error
- This has been fixed in the latest update
- Make sure you're using the updated code
- Check that your API key is correct

## Technical Details

The image generation flow:

1. **Frontend** → Sends prompt to `/api/drafts/generate-image`
2. **Backend** → Retrieves your encrypted API key
3. **ImageAdapter** → Calls OpenRouter with Gemini model
4. **Gemini 2.5 Flash** → Generates image
5. **Backend** → Returns image URL
6. **Frontend** → Displays image

## API Endpoint

```http
POST /api/drafts/generate-image
Content-Type: application/json

{
  "prompt": "A professional image about business growth",
  "style": "professional",
  "user_id": "your-user-id"
}
```

Response:
```json
{
  "url": "https://...",
  "prompt": "...",
  "image_base64": null
}
```

## Environment Variables (Optional)

You can set these in your `.env` file:

```env
# Default image model (already set)
IMAGE_MODEL=google/gemini-2.5-flash-image

# OpenRouter API key (or set in Settings UI)
OPENROUTER_API_KEY=your-key-here

# Or use OpenAI API key (fallback)
OPENAI_API_KEY=your-openai-key
```

## Switching Models (Advanced)

If you want to use a different model, you can edit:

**File:** `backend/linkedpilot/routes/drafts.py`

**Line 182:** Change the model:

```python
image_adapter = ImageAdapter(
    api_key=user_api_key,
    provider="openrouter",
    model="google/gemini-2.5-flash-image"  # Change this
)
```

**Available Models on OpenRouter:**
- `google/gemini-2.5-flash-image` (current, recommended)
- `black-forest-labs/flux-1.1-pro` (alternative)
- `stability-ai/stable-diffusion-xl` (alternative)
- `dall-e-3` (OpenAI, requires OpenAI API key)

## Support

If you encounter issues:
1. Check backend logs (they're very detailed)
2. Verify your API key is correct
3. Check OpenRouter status: https://status.openrouter.ai/
4. Review this guide

---

**Last Updated:** October 14, 2025  
**Model:** Google Gemini 2.5 Flash Image (Nano Banana) 🍌  
**Status:** ✅ Production Ready

