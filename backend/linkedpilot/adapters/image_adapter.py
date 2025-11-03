"""
Image Generation Adapter
Supports: OpenAI DALL-E 2/3, AI Horde (free), OpenRouter image models
Priority: DALL-E 2 (user's API key) → AI Horde (free fallback)
"""

import os
import asyncio
from typing import Optional, List
import httpx

class ImageAdapter:
    """Adapter for image generation using OpenAI DALL-E or AI Horde fallback"""
    
    def __init__(self, api_key: Optional[str] = None, provider: str = "openai", model: Optional[str] = None):
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
            if model.startswith('gemini-') and not model.startswith('google/'):
                self.provider = "google_ai_studio"
            elif model.startswith('google/'):
                self.provider = "openrouter"
            else:
                self.provider = provider
        
        # Configure based on provider
        if self.provider == "google_ai_studio":
            self.api_key = api_key or os.getenv('GOOGLE_AI_API_KEY')
            self.base_url = "https://generativelanguage.googleapis.com/v1beta"
            self.model = model or os.getenv('IMAGE_MODEL', 'gemini-2.0-flash-exp')
        elif self.provider == "openrouter":
            self.api_key = api_key or os.getenv('OPENROUTER_API_KEY') or os.getenv('OPENAI_API_KEY')
            self.base_url = "https://openrouter.ai/api/v1"
            # Default to Google Gemini 2.5 Flash Image (Nano Banana)
            self.model = model or os.getenv('IMAGE_MODEL', 'google/gemini-2.5-flash-image')
        elif self.provider == "ai_horde":
            # AI Horde (Stable Horde) - 100% free, crowdsourced
            self.api_key = "0000000000"  # Anonymous key
            self.base_url = "https://stablehorde.net/api/v2"
            self.model = model or "stable_diffusion_xl"
        else:
            # OpenAI DALL-E (default)
            self.api_key = api_key or os.getenv('OPENAI_API_KEY')
            self.base_url = "https://api.openai.com/v1"
            # Default to DALL-E 2 (cheaper, faster than DALL-E 3)
            self.model = model or os.getenv('IMAGE_MODEL', 'dall-e-2')
        
        self.mock_mode = not self.api_key or os.getenv('MOCK_IMAGE', 'false').lower() == 'true'
        
        print(f"[IMAGE] ImageAdapter initialized:")
        print(f"   Provider: {self.provider}")
        print(f"   Model: {self.model}")
        print(f"   API key present: {bool(self.api_key)}")
        print(f"   Mock mode: {self.mock_mode}")
    
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
            # Prepend ultra-strong photorealism instructions for ALL prompts
            # DALL-E 3 needs very explicit instructions to avoid AI art style
            photorealism_prefix = "CRITICAL: This must be an actual PHOTOGRAPH taken with a real camera - NOT AI art, NOT digital illustration, NOT stylized artwork. Real camera, real lens, real photo. "
            
            # Only enhance prompt with style if it doesn't already have detailed instructions
            if "CRITICAL RULES" in prompt or "NO text whatsoever" in prompt or "ABSOLUTELY NO TEXT" in prompt:
                # Prompt already has detailed instructions, prepend photorealism emphasis
                full_prompt = photorealism_prefix + prompt
                print(f"   Using enhanced prompt with photorealism prefix")
            else:
                # Add style enhancement for simple prompts - PROFESSIONAL PHOTOGRAPHY ONLY
                full_prompt = f"{photorealism_prefix}PROFESSIONAL PHOTOGRAPH - PHOTOREALISTIC 4K QUALITY. Shot on DSLR camera, 35mm lens, f/1.8 aperture. {prompt}. {style} lighting. National Geographic quality, documentary photography style, real photo, NOT illustration, NOT digital art, NOT cartoon, NOT anime. ABSOLUTELY NO TEXT OR WORDS - pure visual imagery only."
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                if self.provider == "google_ai_studio":
                    # Google AI Studio direct API
                    response = await client.post(
                        f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}",
                        headers={
                            "Content-Type": "application/json"
                        },
                        json={
                            "contents": [{
                                "parts": [{
                                    "text": f"Generate an image: {full_prompt}"
                                }]
                            }]
                        }
                    )
                elif self.provider == "openrouter":
                    # OpenRouter image generation (supports Gemini, Flux, SDXL, etc.)
                    # Gemini 2.5 Flash Image uses chat/completions endpoint with image generation
                    
                    if "gemini" in self.model.lower():
                        # Gemini 2.5 Flash Image (Nano Banana) uses chat completions with image output
                        response = await client.post(
                            f"{self.base_url}/chat/completions",
                            headers={
                                "Authorization": f"Bearer {self.api_key}",
                                "Content-Type": "application/json",
                                "HTTP-Referer": "https://linkedin-pilot.app",
                                "X-Title": "LinkedIn Pilot"
                            },
                            json={
                                "model": self.model,
                                "messages": [
                                    {
                                        "role": "user",
                                        "content": [
                                            {
                                                "type": "text",
                                                "text": f"Generate an image: {full_prompt}"
                                            }
                                        ]
                                    }
                                ]
                            }
                        )
                    else:
                        # Other OpenRouter image models (Flux, SDXL, etc.)
                        response = await client.post(
                            f"{self.base_url}/images/generations",
                            headers={
                                "Authorization": f"Bearer {self.api_key}",
                                "Content-Type": "application/json",
                                "HTTP-Referer": "https://linkedin-pilot.app",
                                "X-Title": "LinkedIn Pilot"
                            },
                            json={
                                "model": self.model,
                                "prompt": full_prompt,
                                "n": 1,
                                "size": size
                            }
                        )
                elif self.provider == "ai_horde":
                    # AI Horde (Stable Horde) - Free crowdsourced generation
                    return await self._generate_ai_horde(full_prompt, size)
                else:
                    # OpenAI image generation (DALL-E 2/3 or GPT Image 1) with maximum photorealism
                    
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
                            if 'inlineData' in part:
                                # Direct base64 image data
                                inline_data = part['inlineData']
                                image_base64 = inline_data.get('data')
                                mime_type = inline_data.get('mimeType', 'image/png')
                                if image_base64:
                                    image_url = f"data:{mime_type};base64,{image_base64}"
                                    break
                            elif 'text' in part and 'base64' in part['text']:
                                # Base64 in text format
                                text_content = part['text']
                                import re
                                base64_match = re.search(r'[A-Za-z0-9+/]{100,}={0,2}', text_content)
                                if base64_match:
                                    image_base64 = base64_match.group()
                                    image_url = f"data:image/png;base64,{image_base64}"
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
                            raise Exception("No image data found in Google AI Studio response")
                
                elif self.provider == "openrouter" and "gemini" in self.model.lower():
                    # Gemini 2.5 Flash Image returns the image in the message content
                    if result.get('choices') and len(result['choices']) > 0:
                        message = result['choices'][0].get('message', {})
                        content = message.get('content', [])
                        
                        # Find image content - Gemini returns base64 images
                        image_base64 = None
                        image_url = None
                        
                        for item in content if isinstance(content, list) else []:
                            if isinstance(item, dict):
                                # Check for image_url type (data URL with base64)
                                if item.get('type') == 'image_url':
                                    url = item.get('image_url', {}).get('url', '')
                                    if url.startswith('data:image'):
                                        image_base64 = url.split(',')[1] if ',' in url else url
                                        image_url = url
                                        break
                                # Check for direct base64 in other formats
                                elif 'base64' in str(item):
                                    # Extract base64 data from various possible formats
                                    item_str = str(item)
                                    if 'iVBORw0KGgo' in item_str:  # PNG signature in base64
                                        # Find the base64 data
                                        import re
                                        base64_match = re.search(r'[A-Za-z0-9+/]{100,}={0,2}', item_str)
                                        if base64_match:
                                            image_base64 = base64_match.group()
                                            image_url = f"data:image/png;base64,{image_base64}"
                                            break
                        
                        if image_base64 or image_url:
                            print(f"[SUCCESS] Image generated successfully with Gemini 2.5 Flash Image!")
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
                            # Log the actual response for debugging
                            print(f"[WARNING] Could not extract image from Gemini response")
                            print(f"   Response structure: {list(result.keys())}")
                            if result.get('choices'):
                                print(f"   Content type: {type(content)}")
                                print(f"   Content items: {len(content) if isinstance(content, list) else 'not a list'}")
                            raise Exception("No image data found in Gemini response")
                
                elif result.get('data') and len(result['data']) > 0:
                    # Standard OpenAI/OpenRouter image response
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
                    print(f"[ERROR] Unexpected response format: {result}")
                    raise Exception("No image was generated")
                
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
    
    async def _generate_ai_horde(self, prompt: str, size: str) -> dict:
        """
        Generate image using AI Horde (Stable Horde)
        100% free, crowdsourced, slower (30s-5min)
        Anonymous key: 0000000000
        """
        width, height = map(int, size.split('x'))
        
        print(f"[IMAGE] Using AI Horde (free crowdsourced generation)")
        print(f"   This may take 30 seconds to 5 minutes...")
        
        async with httpx.AsyncClient(timeout=300.0) as client:
            # Step 1: Submit async request
            submit_response = await client.post(
                f"{self.base_url}/generate/async",
                json={
                    "prompt": f"{prompt}, photorealistic, professional photography, DSLR quality, 4K, National Geographic style, documentary photo, real photo",
                    "params": {
                        "width": width,
                        "height": height,
                        "steps": 30,
                        "cfg_scale": 7.5,
                        "sampler_name": "k_euler_a",
                        "karras": True,
                        "negative_prompt": "illustration, digital art, cartoon, anime, drawing, painting, 3D render, CGI, text, words, letters, typography, watermark, signature, low quality, blurry"
                    },
                    "models": [self.model],
                    "nsfw": False,
                    "trusted_workers": True,
                    "r2": True  # Use R2 storage for faster retrieval
                },
                headers={
                    "apikey": self.api_key,
                    "Content-Type": "application/json"
                }
            )
            
            if submit_response.status_code != 202:
                raise Exception(f"AI Horde submission failed: {submit_response.status_code} - {submit_response.text}")
            
            job_data = submit_response.json()
            job_id = job_data.get("id")
            
            if not job_id:
                raise Exception("No job ID returned from AI Horde")
            
            print(f"[IMAGE] AI Horde job submitted: {job_id}")
            wait_time = job_data.get("wait_time", 0)
            print(f"[IMAGE] Estimated wait: {wait_time} seconds")
            
            # Step 2: Poll for completion (max 5 minutes)
            for attempt in range(60):  # 60 × 5s = 5 minutes
                await asyncio.sleep(5)
                
                check_response = await client.get(
                    f"{self.base_url}/generate/check/{job_id}",
                    headers={"apikey": self.api_key}
                )
                
                if check_response.status_code != 200:
                    continue
                
                status = check_response.json()
                
                if status.get("done"):
                    # Step 3: Retrieve result
                    status_response = await client.get(
                        f"{self.base_url}/generate/status/{job_id}",
                        headers={"apikey": self.api_key}
                    )
                    
                    if status_response.status_code != 200:
                        raise Exception(f"Failed to retrieve AI Horde result: {status_response.status_code}")
                    
                    result = status_response.json()
                    generations = result.get("generations", [])
                    
                    if not generations:
                        raise Exception("No image generated by AI Horde")
                    
                    image_url = generations[0].get("img")
                    
                    if not image_url:
                        raise Exception("No image URL in AI Horde response")
                    
                    print(f"[SUCCESS] AI Horde image generated!")
                    print(f"   Wait time: {attempt * 5} seconds")
                    print(f"   URL: {image_url[:60]}...")
                    
                    return {
                        "url": image_url,
                        "prompt": prompt,
                        "revised_prompt": f"AI Horde (Stable Diffusion XL): {prompt}",
                        "size": size,
                        "provider": "AI Horde",
                        "model": self.model,
                        "cost": "$0.00",
                        "wait_time": attempt * 5
                    }
                
                # Still waiting
                current_wait = status.get("wait_time", 0)
                queue_pos = status.get("queue_position", "unknown")
                print(f"[IMAGE] AI Horde: waiting... (queue position: {queue_pos}, ~{current_wait}s remaining)")
            
            # Timeout after 5 minutes
            raise TimeoutError("AI Horde generation timeout (>5 min). Try again later.")
    
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
        model_name = getattr(self, 'model', 'mock-gemini-2.5-flash-image')
        
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
