"""
Image Generation Adapter
Supports: Google AI Studio (Gemini 3 Pro Image Preview)
Note: DALL-E is deprecated - use Google AI Studio (Gemini 3 Pro Image Preview) instead
"""

import os
import asyncio
from typing import Optional, List
import httpx

class ImageAdapter:
    """Adapter for image generation using Google AI Studio (Gemini 3 Pro Image Preview)"""
    
    def __init__(self, api_key: Optional[str] = None, provider: str = "google_ai_studio", model: Optional[str] = None):
        self.provider = provider
        
        # Check if it's a mock model first
        if model and model.startswith('mock-'):
            self.provider = "mock"
            self.model = model
            self.api_key = None
            self.mock_mode = True
            print(f"[IMAGE] ImageAdapter initialized:")
            print(f"   Provider: {self.provider}")
            print(f"   Model: {self.model}")
            print(f"   Mock mode: {self.mock_mode}")
            return
        
        # Determine provider based on model if not explicitly set
        if model and not provider:
            if model.startswith('gemini-') or model.startswith('google/'):
                self.provider = "google_ai_studio"
            else:
                self.provider = provider
        
        # Configure based on provider
        if self.provider == "google_ai_studio":
            self.api_key = api_key or os.getenv('GOOGLE_AI_API_KEY')
            self.base_url = "https://generativelanguage.googleapis.com/v1beta"
            # Use provided model or default to Gemini 3 Pro Image Preview (Nano Banana Pro Preview)
            # This is the advanced model for professional asset production
            self.model = model or "gemini-3-pro-image-preview"
        else:
            # Unknown provider - default to Google AI Studio
            print(f"[WARNING] Unknown provider '{self.provider}', defaulting to Google AI Studio")
            self.provider = "google_ai_studio"
            self.api_key = api_key or os.getenv('GOOGLE_AI_API_KEY')
            self.base_url = "https://generativelanguage.googleapis.com/v1beta"
            self.model = "gemini-3-pro-image-preview"
        
        self.mock_mode = not self.api_key or os.getenv('MOCK_IMAGE', 'false').lower() == 'true'
        
        print(f"[IMAGE] ImageAdapter initialized:")
        print(f"   Provider: {self.provider}")
        print(f"   Model: {self.model}")
        print(f"   API key present: {bool(self.api_key)}")
        print(f"   Mock mode: {self.mock_mode}")
        print(f"   Base URL: {self.base_url}")
        
        # Safety check: If provider was set to openai, raise error (DALL-E is deprecated)
        if self.provider == "openai":
            print(f"[ERROR] OpenAI/DALL-E provider detected - DALL-E is deprecated!")
            print(f"[ERROR] Use 'google_ai_studio' provider for Gemini 2.5 Flash Image instead")
            raise ValueError("DALL-E is deprecated. Use 'google_ai_studio' provider for Gemini 2.5 Flash Image.")
    
    async def generate_image(self, prompt: str, style: str = "professional", size: str = "1024x1024") -> dict:
        """
        Generate an image from a text prompt
        
        Args:
            prompt: Text description of the image
            style: Style descriptor (e.g., "professional", "creative", "minimalist")
            size: Image dimensions (e.g., "1024x1024", "1792x1024", "1024x1792")
        
        Returns:
            Dict with 'url', 'prompt', 'size'
        """
        # Handle mock models (free, no API key required)
        if self.provider == "mock" or (hasattr(self, 'model') and self.model and self.model.startswith('mock-')):
            return self._generate_mock_image(prompt, style, size)
        
        if self.mock_mode or not self.api_key:
            error_msg = "No API key configured. Please add your API key in Settings."
            print(f"[ERROR] {error_msg}")
            raise Exception(error_msg)
        
        print(f"[IMAGE] Generating image with {self.provider} ({self.model})...")
        print(f"   Prompt: {prompt[:100]}...")
        print(f"   Style: {style}")
        print(f"   Size: {size}")
        
        try:
            # We only use Gemini 3 Pro Image Preview - optimize prompts for it
            # Remove conflicting instructions and simplify for better results
            # Check if prompt already has detailed instructions (from AI optimizer)
            if "Shot on DSLR" in prompt or "Photojournalistic style" in prompt or "National Geographic" in prompt:
                # Prompt already optimized by AI - use as-is but clean up any conflicting instructions
                # Remove "ABSOLUTELY NO TEXT" if present (Gemini 3 Pro supports text)
                full_prompt = prompt.replace("ABSOLUTELY NO TEXT", "").replace("NO TEXT", "").replace("NO WORDS", "").replace("NO LETTERS", "").strip()
                # Remove repetitive conflicting instructions
                full_prompt = full_prompt.replace("NOT AI art, NOT digital illustration, NOT stylized artwork. Real camera, real lens, real photo. ", "")
                full_prompt = full_prompt.replace("Real photo - NOT illustration, NOT digital art, NOT cartoon.", "")
                print(f"   Using optimized prompt (cleaned)")
            else:
                # Simple prompt - enhance it for LinkedIn post with text
                # Extract a key phrase from the prompt for text overlay
                key_phrase = prompt[:80] if len(prompt) > 80 else prompt
                full_prompt = f"""A professional LinkedIn post image. {prompt}. 
Shot on DSLR, 35mm f/1.8, shallow depth of field. Photojournalistic style, National Geographic quality, hyper-realistic, 4K, natural lighting. 
Include bold, readable text overlay with a key message from the content. Text should be prominently displayed, well-positioned, and easy to read.
Square format (1080x1080 pixels), optimized for mobile viewing."""
            
            async with httpx.AsyncClient(timeout=180.0) as client:  # Increased timeout for Gemini 3 Pro
                if self.provider == "google_ai_studio":
                    # Google AI Studio direct API - Using Gemini 3 Pro Image Preview only
                    # Documentation: https://ai.google.dev/gemini-api/docs/image-generation
                    # Model: gemini-3-pro-image-preview (advanced, supports 1K/2K/4K, text rendering)
                    # Endpoint: POST /v1beta/models/{model_name}:generateContent
                    model_name = self.model  # Always gemini-3-pro-image-preview
                    endpoint = f"{self.base_url}/models/{model_name}:generateContent"
                    
                    # Request format per Google docs:
                    # {
                    #   "contents": [{
                    #     "parts": [{"text": "prompt"}]
                    #   }]
                    # }
                    request_body = {
                        "contents": [{
                            "parts": [{
                                "text": full_prompt
                            }]
                        }]
                    }
                    
                    # Add image config for Gemini 3 Pro Image Preview (supports aspect ratios, resolutions, and text)
                    # Documentation: https://ai.google.dev/gemini-api/docs/image-generation
                    # We only use gemini-3-pro-image-preview - always add generationConfig
                    # Gemini 3 Pro Image Preview REQUIRES responseModalities in generationConfig
                    # Use LinkedIn-optimized 1:1 aspect ratio (1080x1080) for square posts
                    # Text is allowed in Gemini 3 Pro Image Preview
                    request_body["generationConfig"] = {
                        "responseModalities": ["TEXT", "IMAGE"],  # REQUIRED for Gemini 3 Pro Image Preview
                        "imageConfig": {
                            "aspectRatio": "1:1",  # LinkedIn square format (1080x1080)
                            "imageSize": "1K"  # 1K resolution (1024x1024) - use uppercase K as per docs
                        }
                    }
                    
                    print(f"[IMAGE] Calling Gemini API: {endpoint}")
                    print(f"[IMAGE] Model: {model_name}")
                    print(f"[IMAGE] Request body keys: {list(request_body.keys())}")
                    import json
                    print(f"[IMAGE] Full request body: {json.dumps(request_body, indent=2)[:1000]}...")  # Log first 1000 chars
                    
                    response = await client.post(
                        endpoint,
                        headers={
                            "x-goog-api-key": self.api_key,
                            "Content-Type": "application/json"
                        },
                        json=request_body
                    )
                    
                    # Log response status and error details if not successful
                    if response.status_code != 200:
                        print(f"[ERROR] API returned status {response.status_code}")
                        try:
                            error_body = response.json()
                            print(f"[ERROR] Error response: {error_body}")
                        except:
                            print(f"[ERROR] Error response text: {response.text[:500]}")
                elif self.provider == "openai":
                    # OpenAI image generation (DALL-E 2/3 or GPT Image 1) - ONLY if explicitly using OpenAI provider
                    # Note: DALL-E is deprecated - use Google AI Studio (Gemini) instead
                    print(f"[ERROR] ⚠️⚠️⚠️ DALL-E PROVIDER DETECTED - THIS SHOULD NOT HAPPEN! ⚠️⚠️⚠️")
                    print(f"[ERROR] Provider: {self.provider}, Model: {self.model}")
                    print(f"[ERROR] Stack trace:")
                    import traceback
                    traceback.print_stack()
                    print(f"[WARNING] OpenAI/DALL-E provider detected - DALL-E is deprecated. Use Google AI Studio instead.")
                    raise ValueError("DALL-E is deprecated and should not be used. This code path should not be reached. Please use 'google_ai_studio' provider.")
                    
                    # Try GPT Image 1 first if selected, with automatic fallback to DALL-E 3
                    if self.model == "gpt-image-1":
                        try:
                            print(f"[IMAGE] Attempting GPT Image 1 (most photorealistic)...")
                            
                            # GPT Image 1 supports: 1024x1024, 1024x1536, 1536x1024
                            gpt_size = "1024x1024"
                            if "1536" in size:
                                gpt_size = "1024x1536" if "x1536" in size else "1536x1024"
                            
                            response = await client.post(
                                f"{self.base_url}/images/generations",
                                headers={
                                    "Authorization": f"Bearer {self.api_key}",
                                    "Content-Type": "application/json"
                                },
                                json={
                                    "model": "gpt-image-1",
                                    "prompt": full_prompt,
                                    "n": 1,
                                    "size": gpt_size,
                                    "quality": "high",  # low, medium, or high
                                    "response_format": "b64_json"  # GPT Image 1 ONLY supports b64_json
                                }
                            )
                            response.raise_for_status()
                            result = response.json()
                            
                            # Process GPT Image 1 response (b64_json format)
                            if result.get('data') and len(result['data']) > 0:
                                image_data = result['data'][0]
                                image_base64 = image_data.get('b64_json')
                                
                                if image_base64:
                                    image_url = f"data:image/png;base64,{image_base64}"
                                    print(f"[SUCCESS] GPT Image 1 generated successfully!")
                                    
                                    return {
                                        "url": image_url,
                                        "image_base64": image_base64,
                                        "prompt": full_prompt,
                                        "revised_prompt": image_data.get('revised_prompt', full_prompt),
                                        "size": size,
                                        "model": "gpt-image-1"
                                    }
                        
                        except httpx.HTTPStatusError as e:
                            if e.response.status_code == 400:
                                print(f"[WARNING] GPT Image 1 not available (account not verified or no access)")
                                print(f"[FALLBACK] Switching to DALL-E 3 HD...")
                                # Fall through to DALL-E 3 below
                            else:
                                raise
                        except Exception as e:
                            print(f"[WARNING] GPT Image 1 failed: {e}")
                            print(f"[FALLBACK] Switching to DALL-E 3 HD...")
                            # Fall through to DALL-E 3 below
                    
                    # DALL-E 2/3 generation (or fallback from GPT Image 1)
                    actual_model = "dall-e-3" if self.model == "gpt-image-1" else self.model
                    print(f"[IMAGE] Using {actual_model} with HD quality...")
                    
                    # Map size to DALL-E supported sizes
                    dalle_size = "1024x1024"
                    if "1792" in size and actual_model == "dall-e-3":
                        # DALL-E 3 supports 1792 sizes
                        dalle_size = "1024x1792" if "x1792" in size else "1792x1024"
                    elif "512" in size and actual_model == "dall-e-2":
                        # DALL-E 2 supports 256, 512, 1024
                        dalle_size = "512x512"
                    
                    # Build request JSON based on model
                    request_json = {
                        "model": actual_model,
                        "prompt": full_prompt,
                        "n": 1,
                        "size": dalle_size,
                        "response_format": "url"
                    }
                    
                    # DALL-E 3 specific params for maximum photorealism
                    if actual_model == "dall-e-3":
                        request_json["quality"] = "hd"  # HD quality for 4K-like results
                        request_json["style"] = "natural"  # Natural/photographic style (NOT vivid/illustration)
                    
                    response = await client.post(
                        f"{self.base_url}/images/generations",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json"
                        },
                        json=request_json
                    )
                
                response.raise_for_status()
                result = response.json()
                
                # Handle different response formats
                if self.provider == "google_ai_studio":
                    # Google AI Studio direct API response
                    if result.get('candidates') and len(result['candidates']) > 0:
                        candidate = result['candidates'][0]
                        content = candidate.get('content', {})
                        parts = content.get('parts', [])
                        
                        # Find image content in parts
                        image_base64 = None
                        image_url = None
                        
                        for part in parts:
                            # Check for inlineData (per Google docs: part.inline_data.data)
                            # Handle both camelCase (JSON) and snake_case (Python SDK) formats
                            inline_data = part.get('inlineData') or part.get('inline_data')
                            if inline_data:
                                # Extract base64 image data from inline_data.data
                                image_base64 = inline_data.get('data')
                                if image_base64:
                                    # Get MIME type (default to image/png per docs)
                                    mime_type = inline_data.get('mimeType') or inline_data.get('mime_type', 'image/png')
                                    # Create data URL as per Google's documentation pattern
                                    image_url = f"data:{mime_type};base64,{image_base64}"
                                    print(f"   [IMAGE] Found image in inline_data.data (MIME: {mime_type})")
                                    break
                            # Also check for text that might contain base64 (fallback)
                            elif part.get('text'):
                                text_content = part.get('text')
                                # Skip descriptive text, only look for base64 patterns
                                if text_content and len(text_content) > 100 and any(char in text_content for char in ['+', '/', '=']):
                                    import re
                                    base64_match = re.search(r'[A-Za-z0-9+/]{100,}={0,2}', text_content)
                                    if base64_match:
                                        image_base64 = base64_match.group()
                                        image_url = f"data:image/png;base64,{image_base64}"
                                        print(f"   [IMAGE] Found image in text part (base64 pattern match)")
                                        break
                        
                        if image_base64 or image_url:
                            print(f"[SUCCESS] Image generated successfully with Google AI Studio!")
                            if image_url:
                                print(f"   Data URL length: {len(image_url)}")
                            
                            return {
                                "url": image_url,
                                "image_base64": image_base64,
                                "prompt": full_prompt,
                                "revised_prompt": full_prompt,
                                "size": size
                            }
                        else:
                            print(f"[WARNING] Could not extract image from Google AI Studio response")
                            print(f"   Response structure: {list(result.keys())}")
                            if result.get('candidates'):
                                print(f"   Candidates: {len(result['candidates'])}")
                                if len(result['candidates']) > 0:
                                    candidate = result['candidates'][0]
                                    print(f"   Candidate keys: {list(candidate.keys())}")
                                    if candidate.get('content'):
                                        content = candidate['content']
                                        print(f"   Content keys: {list(content.keys())}")
                                        if content.get('parts'):
                                            print(f"   Parts count: {len(content['parts'])}")
                                            for i, part in enumerate(content['parts']):
                                                print(f"   Part {i} keys: {list(part.keys())}")
                            raise Exception("No image data found in Google AI Studio response. Response structure logged above.")
                
                elif result.get('data') and len(result['data']) > 0:
                    # Standard OpenAI image response (only for OpenAI provider)
                    if self.provider != "openai":
                        raise Exception(f"Unexpected response format for provider {self.provider}")
                    image_url = result['data'][0]['url']
                    print(f"[SUCCESS] Image generated successfully!")
                    print(f"   URL: {image_url[:50]}...")
                    
                    return {
                        "url": image_url,
                        "prompt": full_prompt,
                        "revised_prompt": result['data'][0].get('revised_prompt'),
                        "size": size
                    }
                else:
                    # Unknown provider or response format
                    print(f"[ERROR] Unexpected response format: {result}")
                    raise Exception(f"Unsupported provider or response format: {self.provider}. Use 'google_ai_studio' for Gemini 2.5 Flash Image.")
                
        except Exception as e:
            print(f"[ERROR] Error generating image: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    async def generate_carousel_images(self, slides: List[dict], style: str = "professional") -> List[dict]:
        """Generate multiple images for carousel"""
        images = []
        for i, slide in enumerate(slides):
            # Generate cinematic carousel prompt
            from linkedpilot.utils.cinematic_image_prompts import generate_carousel_slide_prompt
            enhanced_prompt = generate_carousel_slide_prompt(
                slide.get('title', ''), 
                slide.get('content', ''), 
                i + 1, 
                len(slides)
            )
            image = await self.generate_image(enhanced_prompt, style, "1024x1024")
            images.append({
                "slide_number": i + 1,
                **image
            })
        return images
    
    def _generate_mock_image(self, prompt: str, style: str, size: str) -> dict:
        """Generate a professional mock image based on the model type"""
        import base64
        import io
        import random
        
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            # Fallback SVG if PIL not available
            return self._generate_svg_fallback(prompt, style, size)
        
        width, height = map(int, size.split('x'))
        model_name = getattr(self, 'model', 'mock-gemini-3-pro-image-preview')
        
        print(f"[IMAGE] Generating mock image with {model_name}")
        print(f"   Prompt: {prompt[:50]}...")
        print(f"   Style: {style}")
        print(f"   Size: {size}")
        
        # Different styles based on mock model
        if 'gemini' in model_name.lower():
            # Gemini style: Professional blue gradients
            colors = [(0, 119, 181), (40, 103, 178), (10, 102, 194)]  # LinkedIn blue
            model_display = "Mock Gemini 2.5 Flash Image"
        elif 'dalle' in model_name.lower():
            # DALL-E style: Vibrant and artistic
            colors = [(255, 107, 107), (255, 159, 67), (255, 206, 84)]  # Warm gradient
            model_display = "Mock DALL-E 3"
        elif 'flux' in model_name.lower():
            # Flux style: Modern and sleek
            colors = [(138, 43, 226), (75, 0, 130), (148, 0, 211)]  # Purple gradient
            model_display = "Mock Flux Pro"
        else:
            # Default professional style
            colors = [(65, 105, 225), (30, 144, 255), (135, 206, 235)]  # Professional blue
            model_display = "Mock Professional"
        
        # Create gradient background
        img = Image.new('RGB', (width, height))
        draw = ImageDraw.Draw(img)
        
        # Create gradient
        for y in range(height):
            ratio = y / height
            color1 = colors[0]
            color2 = colors[1] if len(colors) > 1 else colors[0]
            
            r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
            g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
            b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
            
            draw.line([(0, y), (width, y)], fill=(r, g, b))
        
        # Add geometric elements for professional look
        if "professional" in style.lower() or "business" in prompt.lower():
            overlay = Image.new('RGBA', (width, height), (255, 255, 255, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            
            # Add subtle circles
            for i in range(3):
                x = random.randint(100, width-200)
                y = random.randint(100, height-200)
                size_circle = random.randint(80, 180)
                overlay_draw.ellipse([x, y, x+size_circle, y+size_circle], fill=(255, 255, 255, 25))
            
            # Add some lines for modern look
            for i in range(2):
                x1 = random.randint(0, width//2)
                y1 = random.randint(0, height)
                x2 = random.randint(width//2, width)
                y2 = random.randint(0, height)
                overlay_draw.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, 30), width=2)
            
            # Composite overlay
            img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG', quality=95)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print(f"[SUCCESS] Mock image generated successfully!")
        print(f"   Model: {model_display}")
        print(f"   Size: {len(img_base64)} bytes")
        
        return {
            "url": f"data:image/png;base64,{img_base64}",
            "image_base64": img_base64,
            "prompt": prompt,
            "revised_prompt": f"{model_display}: {prompt}",
            "size": size,
            "mock": True,
            "model": model_display
        }
    
    def _generate_svg_fallback(self, prompt: str, style: str, size: str) -> dict:
        """Generate SVG fallback when PIL is not available"""
        import base64
        
        width, height = map(int, size.split('x'))
        
        # Simple SVG gradient
        svg = f'''<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="paint0_linear_0_1" x1="{width//2}" y1="0" x2="{width//2}" y2="{height}" gradientUnits="userSpaceOnUse">
<stop stop-color="#0075B5"/>
<stop offset="1" stop-color="#00598B"/>
</linearGradient>
</defs>
<rect width="{width}" height="{height}" fill="url(#paint0_linear_0_1)"/>
</svg>'''
        
        svg_base64 = base64.b64encode(svg.encode()).decode()
        
        return {
            "url": f"data:image/svg+xml;base64,{svg_base64}",
            "image_base64": svg_base64,
            "prompt": prompt,
            "revised_prompt": f"Mock SVG: {prompt}",
            "size": size,
            "mock": True
        }
