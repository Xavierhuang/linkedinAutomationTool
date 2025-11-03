"""
Image Text Overlay Utility
Supports manual text overlay editing and auto-detection using Pillow
"""

import os
import base64
import io
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import httpx


async def add_text_overlay_to_image(
    image_base64: str,
    text: str,
    position: Tuple[int, int],
    font_name: str = "Arial",
    font_size: int = 48,
    font_weight: int = 400,
    font_style: str = "normal",
    text_decoration: str = "none",
    text_align: str = "left",
    color: str = "#FFFFFF",
    stroke_width: int = 0,
    stroke_color: str = "#000000",
    shadow_enabled: bool = False,
    shadow_color: str = "#000000",
    shadow_blur: int = 10,
    shadow_offset_x: int = 0,
    shadow_offset_y: int = 0,
    background_color: str = "transparent",
    opacity: int = 100,
    letter_spacing: int = 0,
    line_height: float = 1.2,
    rotation: int = 0,
    width: int = 300,
    height: int = 100,
    auto_detect_best_position: bool = False
) -> str:
    """
    Add text overlay to image using Pillow
    
    Args:
        image_base64: Base64 encoded image data
        text: Text to overlay
        position: (x, y) tuple for text position
        font_name: Font name (Arial, Times, etc.)
        font_size: Font size in pixels
        color: Text color in hex format
        stroke_width: Outline width (0 = no outline)
        stroke_color: Outline color in hex format
        auto_detect_best_position: If True, AI will suggest best position
    
    Returns:
        Base64 encoded image with text overlay
    """
    print(f"[TEXT_OVERLAY] Adding text overlay to image")
    print(f"   Text: {text[:50]}...")
    print(f"   Position: {position}")
    print(f"   Font: {font_name} {font_size}px")
    print(f"   Color: {color}")
    
    try:
        # Decode base64 image
        img_data = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(img_data))
        
        # Convert to RGBA if not already
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Create drawing context
        draw = ImageDraw.Draw(img)
        
        # Load font
        font_obj = None
        try:
            # First check if it's a Google Font
            font_path = None
            
            # Check in fonts_cache directory for Google Fonts
            cache_dir = Path(__file__).parent / "fonts_cache"
            if cache_dir.exists():
                # Look for font file in cache
                for cached_font in cache_dir.glob(f"{font_name.replace(' ', '_')}_*.ttf"):
                    font_path = cached_font
                    print(f"   [FONT] Found cached Google Font: {font_path}")
                    break
            
            # If not found, try to download from Google Fonts
            if not font_path:
                # Check if font_name looks like a Google Font (contains space or common Google Font name)
                google_font = await get_google_font(font_name, "regular")
                if google_font:
                    font_path = google_font
            
            # If still not found, try system fonts
            if not font_path:
                font_paths = [
                    f"/System/Library/Fonts/{font_name}.ttf",
                    f"/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                    f"C:/Windows/Fonts/{font_name}.ttf",
                    f"C:/Windows/Fonts/arial.ttf",
                ]
                
                for path in font_paths:
                    if os.path.exists(path):
                        font_path = path
                        break
            
            # Load the font
            if font_path:
                font_obj = ImageFont.truetype(font_path, font_size)
                print(f"   [FONT] Loaded font: {font_path}")
        except Exception as e:
            print(f"   [WARNING] Could not load custom font: {e}")
        
        # Fallback to default font
        if not font_obj:
            try:
                font_obj = ImageFont.load_default()
                print(f"   [FONT] Using default font")
            except:
                font_obj = ImageFont.load_default()
        
        # Convert hex color to RGB
        def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
            hex_color = hex_color.lstrip('#')
            return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        
        text_color = hex_to_rgb(color)
        stroke_col = hex_to_rgb(stroke_color) if stroke_width > 0 else None
        
        # Handle opacity
        if opacity < 100:
            # Create RGBA color with opacity
            text_color = text_color + (int(255 * opacity / 100),)
            if stroke_col:
                stroke_col = stroke_col + (int(255 * opacity / 100),)
        
        # Get text bounding box for background and positioning
        bbox = draw.textbbox((0, 0), text, font=font_obj)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Adjust position based on text alignment
        x, y = position
        if text_align == 'center':
            x = x - text_width // 2
        elif text_align == 'right':
            x = x - text_width
        
        # Create a temporary image for text with shadow/background if needed
        # This allows us to apply effects before rotating
        text_img = None
        if shadow_enabled or background_color != 'transparent' or rotation != 0:
            # Create a larger canvas for effects
            padding = max(shadow_blur, abs(shadow_offset_x), abs(shadow_offset_y), 50)
            text_canvas = Image.new('RGBA', (text_width + padding * 2, text_height + padding * 2), (0, 0, 0, 0))
            text_draw = ImageDraw.Draw(text_canvas)
            text_x, text_y = padding, padding
            
            # Draw background if needed
            if background_color != 'transparent':
                bg_color = hex_to_rgb(background_color)
                bg_alpha = int(255 * opacity / 100) if opacity < 100 else 255
                text_draw.rectangle(
                    [(text_x - 5, text_y - 5), (text_x + text_width + 5, text_y + text_height + 5)],
                    fill=bg_color + (bg_alpha,)
                )
            
            # Draw shadow if enabled
            if shadow_enabled:
                shadow_col = hex_to_rgb(shadow_color)
                shadow_alpha = int(255 * opacity / 100) if opacity < 100 else 255
                shadow_x = text_x + shadow_offset_x
                shadow_y = text_y + shadow_offset_y
                
                # Draw blurred shadow
                shadow_img = Image.new('RGBA', (text_width + shadow_blur * 2, text_height + shadow_blur * 2), (0, 0, 0, 0))
                shadow_draw = ImageDraw.Draw(shadow_img)
                shadow_draw.text((shadow_blur, shadow_blur), text, font=font_obj, fill=shadow_col + (shadow_alpha,))
                shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(radius=shadow_blur / 2))
                text_canvas.paste(shadow_img, (int(shadow_x - shadow_blur), int(shadow_y - shadow_blur)), shadow_img)
            
            # Draw stroke if needed
            if stroke_width > 0 and stroke_col:
                for adj in range(-stroke_width, stroke_width + 1):
                    for adj2 in range(-stroke_width, stroke_width + 1):
                        text_draw.text(
                            (text_x + adj, text_y + adj2),
                            text,
                            font=font_obj,
                            fill=stroke_col if isinstance(stroke_col, tuple) and len(stroke_col) == 4 else stroke_col + (255,)
                        )
            
            # Draw main text
            text_draw.text((text_x, text_y), text, font=font_obj, fill=text_color if isinstance(text_color, tuple) and len(text_color) == 4 else text_color + (255,))
            
            # Rotate if needed
            if rotation != 0:
                text_canvas = text_canvas.rotate(rotation, expand=True, fillcolor=(0, 0, 0, 0))
            
            # Paste onto main image
            paste_x = x - padding + (text_canvas.width - text_width - padding * 2) // 2
            paste_y = y - padding + (text_canvas.height - text_height - padding * 2) // 2
            img.paste(text_canvas, (int(paste_x), int(paste_y)), text_canvas)
        else:
            # Simple text drawing without effects
            if stroke_width > 0 and stroke_col:
                # Draw outline first
                for adj in range(-stroke_width, stroke_width + 1):
                    for adj2 in range(-stroke_width, stroke_width + 1):
                        draw.text(
                            (x + adj, y + adj2),
                            text,
                            font=font_obj,
                            fill=stroke_col if isinstance(stroke_col, tuple) and len(stroke_col) == 4 else stroke_col + (255,)
                        )
            
            # Draw main text
            draw.text((x, y), text, font=font_obj, fill=text_color if isinstance(text_color, tuple) and len(text_color) == 4 else text_color + (255,))
        
        # Convert back to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG', quality=95)
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        print(f"[SUCCESS] Text overlay added successfully!")
        print(f"   Final image size: {len(img_base64)} bytes")
        
        return img_base64
        
    except Exception as e:
        print(f"[ERROR] Failed to add text overlay: {e}")
        import traceback
        traceback.print_exc()
        raise


async def detect_text_in_image_ai(image_url: str, api_key: str) -> Optional[Dict]:
    """
    Use AI vision to detect existing text in image and suggest overlay positions
    
    Args:
        image_url: URL or base64 data URL of image
        api_key: OpenAI or similar API key for vision model
    
    Returns:
        Dictionary with detected text, fonts, positions, or None
    """
    print(f"[TEXT_OVERLAY] Detecting text in image using AI vision")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Determine if it's a data URL or regular URL
            if image_url.startswith('data:image'):
                # Extract base64 from data URL
                header, encoded = image_url.split(',', 1)
                image_base64 = encoded
            else:
                # Fetch image and convert to base64
                response = await client.get(image_url)
                image_base64 = base64.b64encode(response.content).decode()
            
            # Call OpenAI Vision API
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Analyze this image and identify all text elements. For each text element, provide: the text content, approximate font size, color (hex), and position (x, y coordinates). Also suggest the best areas for adding new text overlays. Return JSON format."
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{image_base64}"
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 500
                }
            )
            
            result = response.json()
            content = result['choices'][0]['message']['content']
            
            print(f"[SUCCESS] AI analysis complete")
            
            return {
                "ai_analysis": content,
                "has_text": True
            }
            
    except Exception as e:
        print(f"[WARNING] AI text detection failed: {e}")
        return None


async def auto_determine_best_position(
    image_base64: str,
    text: str,
    similar_images: Optional[List[str]] = None
) -> Dict:
    """
    AI determines optimal position, font, size, and color for text overlay
    
    Args:
        image_base64: Base64 encoded image
        text: Text to overlay
        similar_images: Optional list of similar image URLs for reference
    
    Returns:
        Dictionary with optimal settings
    """
    print(f"[TEXT_OVERLAY] Auto-determining best position for text overlay")
    
    try:
        # Get system OpenAI key
        from ..routes.drafts import get_system_api_key
        api_key, _ = await get_system_api_key("openai")
        
        if not api_key:
            # Fallback to basic heuristics
            return _get_default_text_settings()
        
        # Use AI to analyze image and suggest placement
        img_data = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(img_data))
        
        width, height = img.size
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"""Analyze this image and suggest the best position and styling for adding text overlay: "{text}".
                                    
Consider best practices from professional social media campaigns:
- LinkedIn posts: Bold, readable text, often bottom-center or top areas with good contrast
- Instagram/Facebook: Center-focused, eye-catching fonts, strong outlines for readability
- Marketing images: Strategic placement avoiding important visual elements

Provide:
1. x, y coordinates (0 to {width}, 0 to {height})
2. Font size (24 to 96) - larger for impact
3. Font style (bold, regular)
4. Color (hex code) - high contrast with background
5. Stroke/outline width (0-5) and color for readability

Focus on: maximum readability, professional appearance, and visual impact.

Return ONLY valid JSON:
{{"x": 10, "y": 30, "font_size": 48, "font_style": "bold", "color": "#FFFFFF", "stroke_width": 2, "stroke_color": "#000000"}}
"""
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{image_base64}"
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 300
                }
            )
            
            result = response.json()
            ai_suggestion = result['choices'][0]['message']['content']
            
            print(f"[SUCCESS] AI suggested settings")
            print(f"   Suggestion: {ai_suggestion[:100]}...")
            
            # Parse AI response (basic parsing)
            return _parse_ai_suggestion(ai_suggestion, width, height)
            
    except Exception as e:
        print(f"[WARNING] AI positioning failed: {e}, using defaults")
        return _get_default_text_settings()


def _get_default_text_settings() -> Dict:
    """Get sensible default text settings"""
    return {
        "position": (50, 50),
        "font_size": 48,
        "font_name": "Arial Bold",
        "color": "#FFFFFF",
        "stroke_width": 2,
        "stroke_color": "#000000"
    }


def _parse_ai_suggestion(ai_text: str, img_width: int, img_height: int) -> Dict:
    """Parse AI suggestion into structured format"""
    # Basic extraction (can be improved with better parsing)
    settings = _get_default_text_settings()
    
    try:
        import json
        import re
        
        # Try to extract JSON
        json_match = re.search(r'\{.*\}', ai_text, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            settings.update(parsed)
        else:
            # Try to extract values with regex
            x_match = re.search(r'"x":\s*(\d+)', ai_text)
            y_match = re.search(r'"y":\s*(\d+)', ai_text)
            size_match = re.search(r'"size":\s*(\d+)', ai_text)
            color_match = re.search(r'"color":\s*["\']#([0-9A-Fa-f]{6})["\']', ai_text)
            
            if x_match and y_match:
                settings["position"] = (int(x_match.group(1)), int(y_match.group(1)))
            if size_match:
                settings["font_size"] = int(size_match.group(1))
            if color_match:
                settings["color"] = f"#{color_match.group(1)}"
                
    except Exception as e:
        print(f"   [WARNING] Failed to parse AI suggestion: {e}")
    
    return settings


async def apply_multiple_overlays(
    image_base64: str,
    overlays: List[Dict]
) -> str:
    """
    Apply multiple text overlays to an image
    
    Args:
        image_base64: Base64 encoded image
        overlays: List of overlay dictionaries with text, position, font, etc.
    
    Returns:
        Base64 encoded image with all overlays applied
    """
    print(f"[TEXT_OVERLAY] Applying {len(overlays)} text overlays")
    
    current_image = image_base64
    
    for i, overlay in enumerate(overlays):
        print(f"   Overlay {i+1}/{len(overlays)}: {overlay.get('text', 'N/A')[:30]}...")
        current_image = await add_text_overlay_to_image(
            image_base64=current_image,
            text=overlay.get('text', ''),
            position=overlay.get('position', (50, 50)),
            font_name=overlay.get('font_name', 'Arial'),
            font_size=overlay.get('font_size', 48),
            color=overlay.get('color', '#FFFFFF'),
            stroke_width=overlay.get('stroke_width', 0),
            stroke_color=overlay.get('stroke_color', '#000000')
        )
    
    print(f"[SUCCESS] All overlays applied!")
    return current_image


async def get_google_font(font_family: str, variant: str = "regular") -> Optional[str]:
    """
    Download and cache a Google Font for use with Pillow
    
    Args:
        font_family: Font family name (e.g., "Roboto", "Open Sans")
        variant: Font variant (e.g., "regular", "bold", "italic", "700", etc.)
    
    Returns:
        Path to downloaded font file, or None if download fails
    """
    # Create cache directory
    cache_dir = Path(__file__).parent / "fonts_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    # Convert font family name to Google Fonts URL format
    font_family_normalized = font_family.replace(" ", "+")
    
    # Map common variants to API values
    variant_map = {
        "regular": "400",
        "bold": "700",
        "italic": "400",
        "bold-italic": "700"
    }
    variant_key = variant_map.get(variant.lower(), variant)
    
    # Cache file path
    cache_file = cache_dir / f"{font_family}_{variant}.ttf"
    
    # Check if already cached
    if cache_file.exists():
        print(f"[FONT] Using cached font: {cache_file}")
        return str(cache_file)
    
    # Download from Google Fonts API
    print(f"[FONT] Downloading Google Font: {font_family} ({variant})")
    
    try:
        # Google Fonts CSS API
        font_url = f"https://fonts.googleapis.com/css2?family={font_family_normalized}:wght@{variant_key}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get CSS that contains font URL
            css_response = await client.get(font_url)
            
            if css_response.status_code != 200:
                print(f"[WARNING] Failed to fetch font CSS: {css_response.status_code}")
                return None
            
            # Extract font file URL from CSS
            css_content = css_response.text
            
            # Parse CSS to find .ttf or .woff2 URL
            import re
            font_url_match = re.search(r'url\((https://[^)]+(\.ttf|\.woff2))\)', css_content)
            
            if not font_url_match:
                print(f"[WARNING] Could not find font file URL in CSS")
                return None
            
            font_file_url = font_url_match.group(1)
            print(f"[FONT] Found font file URL: {font_file_url}")
            
            # Download the font file
            font_response = await client.get(font_file_url)
            
            if font_response.status_code != 200:
                print(f"[WARNING] Failed to download font file: {font_response.status_code}")
                return None
            
            # Save to cache
            cache_file.write_bytes(font_response.content)
            print(f"[SUCCESS] Font cached: {cache_file}")
            
            return str(cache_file)
            
    except Exception as e:
        print(f"[WARNING] Error downloading Google Font: {e}")
        return None


def get_google_fonts_list() -> List[Dict[str, str]]:
    """
    Get list of popular Google Fonts
    Returns a curated list of commonly used Google Fonts
    """
    return [
        {"family": "Roboto", "display": "Roboto"},
        {"family": "Open Sans", "display": "Open Sans"},
        {"family": "Lato", "display": "Lato"},
        {"family": "Montserrat", "display": "Montserrat"},
        {"family": "Raleway", "display": "Raleway"},
        {"family": "Poppins", "display": "Poppins"},
        {"family": "Source Sans Pro", "display": "Source Sans Pro"},
        {"family": "Oswald", "display": "Oswald"},
        {"family": "Playfair Display", "display": "Playfair Display"},
        {"family": "Merriweather", "display": "Merriweather"},
        {"family": "PT Sans", "display": "PT Sans"},
        {"family": "Lora", "display": "Lora"},
        {"family": "Inter", "display": "Inter"},
        {"family": "Ubuntu", "display": "Ubuntu"},
        {"family": "Crimson Text", "display": "Crimson Text"},
        {"family": "Dancing Script", "display": "Dancing Script"},
        {"family": "Bebas Neue", "display": "Bebas Neue"},
        {"family": "Pacifico", "display": "Pacifico"},
        {"family": "Righteous", "display": "Righteous"},
        {"family": "Abril Fatface", "display": "Abril Fatface"},
        {"family": "Josefin Sans", "display": "Josefin Sans"},
        {"family": "Fjalla One", "display": "Fjalla One"},
        {"family": "Anton", "display": "Anton"},
        {"family": "Barlow", "display": "Barlow"},
        {"family": "Comfortaa", "display": "Comfortaa"},
        {"family": "Karla", "display": "Karla"},
        {"family": "Libre Franklin", "display": "Libre Franklin"},
        {"family": "PT Serif", "display": "PT Serif"},
        {"family": "Domine", "display": "Domine"},
        {"family": "Arvo", "display": "Arvo"}
    ]

