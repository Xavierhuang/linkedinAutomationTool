from __future__ import annotations

import asyncio
import re
import uuid
import sys
import os
from collections import Counter
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

# Fix Windows console encoding
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass
    # Also set environment variable
    os.environ['PYTHONIOENCODING'] = 'utf-8'

import aiohttp
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from ..models.campaign import Campaign
from ..models.organization_materials import BrandAnalysis
from ..routes.settings import decrypt_value
from ..services.campaign_generator import CampaignGenerator
from ..utils.api_key_helper import get_api_key_and_provider

router = APIRouter(prefix="/brand", tags=["brand"])

class GeneratePostRequest(BaseModel):
    """Request model for generating a single post using CampaignGenerator"""
    org_id: Optional[str] = None
    campaign_id: str
    brand_context: Optional[Dict] = None
    excluded_types: Optional[List[str]] = None
    user_id: str

def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]


def _fallback_campaign_previews(
    brand_analysis: BrandAnalysis,
    suggestions: List[CampaignSuggestion],
    count: int,
) -> CampaignPreviewResponse:
    """
    Create brand-DNA-enriched fallback campaigns when AI generation is unavailable.
    Uses all available brand DNA to create meaningful, personalized campaigns.
    """
    safe_count = max(1, min(int(count or 1), 10))

    # Extract all brand DNA elements
    pillars = list(brand_analysis.content_pillars or [])
    if not pillars:
        pillars = ["Industry Insights", "Best Practices", "Case Studies", "Thought Leadership"]

    audience = (
        brand_analysis.target_audience
        if isinstance(brand_analysis.target_audience, dict)
        else brand_analysis.target_audience.model_dump()
        if hasattr(brand_analysis.target_audience, "model_dump")
        else {}
    )
    
    # Get key brand DNA elements
    brand_voice = brand_analysis.brand_voice or "professional"
    brand_story = brand_analysis.brand_story[:200] if brand_analysis.brand_story else ""
    core_values = brand_analysis.core_values[:5] if brand_analysis.core_values else []
    key_messages = brand_analysis.key_messages[:5] if brand_analysis.key_messages else []
    value_props = brand_analysis.value_propositions[:3] if brand_analysis.value_propositions else []
    usps = brand_analysis.unique_selling_points[:3] if brand_analysis.unique_selling_points else []
    personality = brand_analysis.brand_personality[:3] if brand_analysis.brand_personality else []
    
    # Get target audience details
    job_titles = audience.get("job_titles", [])[:3]
    industries = audience.get("industries", [])[:3]
    pain_points = audience.get("pain_points", [])[:3]
    
    p0 = pillars[0] if len(pillars) > 0 else "industry trends"
    p1 = pillars[1] if len(pillars) > 1 else p0
    p2 = pillars[2] if len(pillars) > 2 else p1
    
    # Create brand-specific sample posts
    def create_thought_leadership_posts():
        posts = []
        if core_values:
            posts.append(f"Why {core_values[0]} is the foundation of everything we do - a leadership perspective on {p0}")
        else:
            posts.append(f"The contrarian truth about {p0} that most leaders miss")
        if key_messages:
            posts.append(f"How {key_messages[0][:50]}... - breaking down what this means for your business")
        else:
            posts.append(f"The 3 shifts happening in {p1} that will define the next decade")
        if usps:
            posts.append(f"What makes us different: {usps[0][:60]} - and why it matters for your results")
        else:
            posts.append(f"Behind the scenes: How we approach {p2} differently")
        return posts[:3]
    
    def create_education_posts():
        posts = []
        if pain_points:
            posts.append(f"The 5-step framework to solve {pain_points[0][:50]} (with examples)")
        else:
            posts.append(f"5 proven strategies to excel at {p0} - a complete guide")
        if value_props:
            posts.append(f"How to {value_props[0][:50]} - a practical checklist")
        else:
            posts.append(f"The ultimate checklist for {p1} success")
        posts.append(f"Common mistakes in {p2} and how to avoid them")
        return posts[:3]
    
    def create_engagement_posts():
        posts = []
        if pain_points:
            posts.append(f"Poll: What's your biggest challenge with {pain_points[0][:40]}?")
        else:
            posts.append(f"Poll: What aspect of {p0} needs the most improvement in your organization?")
        if personality:
            posts.append(f"We believe in being {', '.join(personality[:2])}. What values drive your work?")
        else:
            posts.append(f"Question: What would you change about {p1} in your industry?")
        posts.append(f"Share your experience: How do you approach {p2}?")
        return posts[:3]

    fallback: List[CampaignPreview] = []
    if not suggestions:
        # Campaign 1: Thought Leadership - leverage brand story and values
        desc1 = f"Establish authority in {p0} and {p1}."
        if brand_story:
            desc1 = f"Share your unique perspective on {p0}. Leverage your brand story and {len(core_values)} core values to build thought leadership and industry authority."
        
        fallback.append(
            CampaignPreview(
                id="campaign_fallback_1",
                name=f"{p0} Thought Leadership" if p0 else "Thought Leadership Campaign",
                description=desc1,
                focus=p0 if p0 else "Thought Leadership",
                content_pillars=pillars[:4],
                target_audience=audience,
                tone_voice=brand_voice,
                posting_schedule={"frequency": "daily", "time_slots": ["08:00", "12:00", "17:00"]},
                sample_posts=create_thought_leadership_posts(),
            )
        )
        
        # Campaign 2: Educational - address pain points with value props
        desc2 = f"Educate your audience on {p1} with actionable insights."
        if pain_points:
            desc2 = f"Address key challenges like {pain_points[0][:40]}... with practical solutions. Help your audience succeed with actionable guides and best practices."
        elif value_props:
            desc2 = f"Help your audience achieve results through educational content. Focus on {value_props[0][:50]}... and build trust through expertise."
        
        fallback.append(
            CampaignPreview(
                id="campaign_fallback_2",
                name=f"{p1} Education Series" if p1 else "Educational Series Campaign",
                description=desc2,
                focus=p1 if p1 else "Audience Education",
                content_pillars=pillars[:4],
                target_audience=audience,
                tone_voice="informative",
                posting_schedule={"frequency": "daily", "time_slots": ["09:00", "13:00", "18:00"]},
                sample_posts=create_education_posts(),
            )
        )
        
        # Campaign 3: Community Engagement - build relationships
        desc3 = f"Build community around {p2} through conversations and engagement."
        if job_titles:
            desc3 = f"Connect with {', '.join(job_titles[:2])} and other professionals. Spark meaningful conversations around {p2} and build lasting relationships."
        
        fallback.append(
            CampaignPreview(
                id="campaign_fallback_3",
                name=f"{p2} Community Hub" if p2 else "Community Engagement Campaign",
                description=desc3,
                focus=p2 if p2 else "Community Building",
                content_pillars=pillars[:4],
                target_audience=audience,
                tone_voice="conversational",
                posting_schedule={"frequency": "daily", "time_slots": ["10:00", "14:00", "19:00"]},
                sample_posts=create_engagement_posts(),
            )
        )
    else:
        # Use provided suggestions but enrich with brand DNA
        for idx, suggestion in enumerate(suggestions[:safe_count]):
            focus_pillar = pillars[idx % len(pillars)] if pillars else p0
            
            # Create posts specific to the suggestion focus
            sample_posts = []
            if suggestion.focus:
                sample_posts.append(f"Deep dive: The key principles of {suggestion.focus} that drive results")
                if key_messages:
                    sample_posts.append(f"How {key_messages[0][:40]}... relates to {suggestion.focus}")
                else:
                    sample_posts.append(f"3 ways to excel at {suggestion.focus} in today's market")
                sample_posts.append(f"What we've learned about {suggestion.focus} from working with {industries[0] if industries else 'industry leaders'}")
            else:
                sample_posts = [f"Share an insight about {p}" for p in pillars[:3]]
            
            fallback.append(
                CampaignPreview(
                    id=f"campaign_fallback_{len(fallback) + 1}",
                    name=suggestion.name,
                    description=suggestion.description or f"Engage your audience with insights and content focused on {suggestion.focus or focus_pillar}.",
                    focus=suggestion.focus or focus_pillar,
                    content_pillars=pillars[:4],
                    target_audience=audience,
                    tone_voice=brand_voice,
                    posting_schedule={"frequency": "daily", "time_slots": ["08:00", "12:00", "17:00"]},
                    sample_posts=sample_posts[:3],
                )
            )

    return CampaignPreviewResponse(campaigns=fallback[:safe_count])


@router.get("/screenshot")
async def get_website_screenshot(url: str):
    """Proxy website screenshot to avoid CORS issues"""
    import aiohttp
    from fastapi.responses import Response
    from urllib.parse import unquote
    
    try:
        # Decode URL if it's already encoded
        decoded_url = unquote(url)
        
        # Ensure URL has protocol
        if not decoded_url.startswith(('http://', 'https://')):
            decoded_url = f"https://{decoded_url}"
        
        # Use screenshotapi.net or similar service that accepts URLs in query params
        # Alternative: Use a service that accepts URL as query parameter
        # For now, let's use a different approach - use screenshotapi.net format
        # Or use htmlcsstoimage.com, or better yet, use a service that accepts URL in query
        
        # Option 1: Use screenshotapi.net (requires API key, but has free tier)
        # screenshot_url = f"https://api.screenshotmachine.com/?key=DEMO&url={decoded_url}&dimension=1024x768"
        
        # Option 2: Use htmlcsstoimage.com (free tier available)
        # screenshot_url = f"https://hcti.io/v1/image?url={decoded_url}"
        
        # Use screenshotapi.net with API key (correct service per docs)
        # Get API key from environment or use default
        import os
        screenshot_api_key = os.environ.get('SCREENSHOT_API_KEY', 'DXSW552-EQWMT4Y-P3NARMH-8GHBZEP')
        
        # URL should be properly encoded in query parameter
        # According to docs: https://www.screenshotapi.net/docs/getStarted
        # Endpoint: https://shot.screenshotapi.net/screenshot
        # Parameters: token (API key), url (encoded), output (image/json), file_type (png/jpeg/webp/pdf)
        from urllib.parse import quote_plus
        encoded_url = quote_plus(decoded_url)
        
        # Construct URL per official docs
        screenshot_url = f"https://shot.screenshotapi.net/screenshot?token={screenshot_api_key}&url={encoded_url}&output=image&file_type=png"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(screenshot_url, timeout=30) as response:
                if response.status == 200:
                    image_data = await response.read()
                    content_type = response.headers.get('Content-Type', 'image/png')
                    
                    # Check if it's actually an image (screenshotapi returns error pages as GIFs sometimes)
                    # Error pages are usually small GIFs (< 10KB) with error messages
                    if content_type == 'image/gif' and len(image_data) < 10000:
                        # Likely an error page - try to read the error message
                        try:
                            error_text = image_data.decode('utf-8', errors='ignore')
                            _safe_print(f"[ERROR] Screenshot API returned GIF (likely error): {len(image_data)} bytes")
                            _safe_print(f"[ERROR] Content preview: {error_text[:500]}")
                            
                            # Check for common error messages
                            if 'invalid' in error_text.lower() or 'api key' in error_text.lower():
                                raise HTTPException(status_code=400, detail="Invalid screenshot API key. Please check your API key in the screenshotapi.net dashboard.")
                            elif 'limit' in error_text.lower() or 'quota' in error_text.lower():
                                raise HTTPException(status_code=429, detail="Screenshot API quota exceeded. Please upgrade your plan.")
                            elif 'error' in error_text.lower():
                                raise HTTPException(status_code=400, detail=f"Screenshot API error: {error_text[:150]}")
                            else:
                                # Unknown error, but it's a small GIF so likely an error
                                raise HTTPException(status_code=400, detail="Screenshot API returned an error. Check your API key and account status.")
                        except HTTPException:
                            raise
                        except Exception as e:
                            _safe_print(f"[ERROR] Could not parse error: {e}")
                            raise HTTPException(status_code=400, detail="Screenshot API returned invalid response. Check your API key.")
                    
                    # Validate it's actually image data (not HTML/error page)
                    if len(image_data) < 1000:
                        _safe_print(f"[WARNING] Screenshot response too small ({len(image_data)} bytes), might be error page")
                        raise HTTPException(status_code=404, detail="Screenshot service unavailable")
                    
                    # Check if it's actually an image by checking magic bytes
                    is_image = (
                        image_data.startswith(b'\x89PNG') or  # PNG
                        image_data.startswith(b'\xff\xd8\xff') or  # JPEG
                        image_data.startswith(b'GIF')  # GIF (but only if large enough)
                    )
                    
                    if not is_image and len(image_data) < 50000:
                        _safe_print(f"[WARNING] Response doesn't appear to be an image")
                        raise HTTPException(status_code=404, detail="Screenshot service returned invalid response")
                    
                    return Response(content=image_data, media_type=content_type)
                else:
                    error_text = await response.text(encoding='utf-8', errors='replace') if response.content_type == 'text/html' else f"HTTP {response.status}"
                    _safe_print(f"[ERROR] Screenshot service returned {response.status}: {error_text[:200]}")
                    raise HTTPException(status_code=404, detail=f"Screenshot not available: {error_text[:100]}")
    except HTTPException:
        raise
    except Exception as e:
        _safe_print(f"[ERROR] Screenshot proxy failed: {e}")
        try:
            safe_error = str(e).encode('utf-8', errors='replace').decode('utf-8')
        except:
            safe_error = "Screenshot generation error"
        raise HTTPException(status_code=500, detail=f"Screenshot generation failed: {safe_error}")


@router.get("/images/{filename}")
async def serve_brand_image(filename: str):
    """Serve stored brand images from local storage"""
    from pathlib import Path
    from fastapi.responses import FileResponse
    import os
    
    try:
        # Security: prevent directory traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        base_dir = Path(__file__).parent.parent.parent.parent
        images_dir = base_dir / "uploads" / "brand-images"
        filepath = images_dir / filename
        
        if not filepath.exists() or not filepath.is_file():
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Determine content type from extension
        ext = filename.split('.')[-1].lower()
        content_type_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        }
        content_type = content_type_map.get(ext, 'image/jpeg')
        
        return FileResponse(
            filepath,
            media_type=content_type,
            headers={
                'Cache-Control': 'public, max-age=31536000',  # Cache for 1 year
                'Access-Control-Allow-Origin': '*'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        _safe_print(f"[ERROR] Failed to serve image {filename}: {e}")
        try:
            safe_error = str(e).encode('utf-8', errors='replace').decode('utf-8')
        except:
            safe_error = "Image serving error"
        raise HTTPException(status_code=500, detail=f"Failed to serve image: {safe_error}")


@router.get("/media-library")
async def get_media_library(org_id: Optional[str] = None, user_id: Optional[str] = None):
    """Get all scraped images for media library"""
    db = get_db()
    
    query = {}
    if org_id:
        query["org_id"] = org_id
    elif user_id:
        # Get all organizations for this user
        orgs = await db.organizations.find(
            {"created_by": user_id},
            {"id": 1, "_id": 0}
        ).to_list(length=100)
        org_ids = [org["id"] for org in orgs]
        query["$or"] = [
            {"org_id": {"$in": org_ids}},
            {"user_id": user_id}
        ]
    else:
        return []
    
    images = await db.user_images.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=500)
    
    # Convert backend URLs to full URLs
    import os
    base_url = os.environ.get("BACKEND_URL", "https://mandi.media")
    if not base_url.startswith("http"):
        base_url = f"https://{base_url}"
    # Remove trailing slash if present
    if base_url.endswith('/'):
        base_url = base_url[:-1]
    
    for img in images:
        if img.get("backend_url") and img["backend_url"].startswith("/api/brand/images/"):
            img["url"] = f"{base_url}{img['backend_url']}"
        elif img.get("original_url"):
            img["url"] = img["original_url"]
        else:
            # Fallback: try to construct URL from filename
            if img.get("filename"):
                img["url"] = f"{base_url}/api/brand/images/{img['filename']}"
    
    return images


@router.get("/proxy-image")
async def proxy_image(image_url: str):
    """Proxy external images to avoid CORS issues (fallback for non-stored images)"""
    import aiohttp
    from fastapi.responses import Response
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(image_url, timeout=15, allow_redirects=True) as response:
                if response.status == 200:
                    image_data = await response.read()
                    content_type = response.headers.get('Content-Type', 'image/jpeg')
                    # Set CORS headers
                    headers = {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET',
                        'Cache-Control': 'public, max-age=3600'
                    }
                    return Response(content=image_data, media_type=content_type, headers=headers)
                else:
                    raise HTTPException(status_code=404, detail="Image not found")
    except Exception as e:
        _safe_print(f"[ERROR] Image proxy failed for {image_url}: {e}")
        try:
            safe_error = str(e).encode('utf-8', errors='replace').decode('utf-8')
        except:
            safe_error = "Image proxy error"
        raise HTTPException(status_code=500, detail=f"Image proxy failed: {safe_error}")

class BrandDiscoveryRequest(BaseModel):
    url: str = Field(..., description="Public website URL for the organization")
    org_id: Optional[str] = Field(None, description="Optional organization ID to use user's API key")


class BrandDiscoveryResponse(BaseModel):
    normalized_url: str
    title: Optional[str] = None
    description: Optional[str] = None
    color_palette: List[str] = Field(default_factory=list)
    font_families: List[str] = Field(default_factory=list)
    imagery: List[str] = Field(default_factory=list)
    tone_keywords: List[str] = Field(default_factory=list)
    keyword_summary: List[str] = Field(default_factory=list)
    content_excerpt: Optional[str] = None
    # Brand DNA analysis fields (from AI analysis)
    brand_story: Optional[str] = None
    brand_personality: List[str] = Field(default_factory=list)
    core_values: List[str] = Field(default_factory=list)
    target_audience_description: Optional[str] = None
    target_audience: Dict = Field(default_factory=lambda: {
        "job_titles": [],
        "industries": [],
        "interests": [],
        "pain_points": []
    })
    unique_selling_points: List[str] = Field(default_factory=list)
    key_messages: List[str] = Field(default_factory=list)


class CampaignSuggestion(BaseModel):
    name: str
    description: Optional[str] = None
    focus: Optional[str] = None


class CampaignPreviewBrandContext(BaseModel):
    """
    Minimal brand context required to generate campaign previews when an organization
    has not been created yet (onboarding flow).
    """
    # Brand Identity
    brand_tone: List[str] = Field(default_factory=list)
    brand_voice: Optional[str] = "professional"
    brand_colors: List[str] = Field(default_factory=list)
    brand_images: List[str] = Field(default_factory=list)
    brand_fonts: List[str] = Field(default_factory=list)
    key_messages: List[str] = Field(default_factory=list)
    value_propositions: List[str] = Field(default_factory=list)

    # Brand DNA (optional)
    brand_story: Optional[str] = None
    brand_personality: List[str] = Field(default_factory=list)
    core_values: List[str] = Field(default_factory=list)
    target_audience_description: Optional[str] = None
    unique_selling_points: List[str] = Field(default_factory=list)

    # Audience & Strategy
    target_audience: Dict = Field(default_factory=dict)
    content_pillars: List[str] = Field(default_factory=list)
    suggested_campaigns: List[Dict] = Field(default_factory=list)

    @field_validator("target_audience", mode="before")
    @classmethod
    def coerce_target_audience(cls, v):
        # Some clients incorrectly send a string description here; coerce it to {} to avoid 422s.
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return {}


class CampaignPreviewRequest(BaseModel):
    org_id: Optional[str] = None
    count: int = 3
    suggestions: Optional[List[CampaignSuggestion]] = None
    brand_context: Optional[CampaignPreviewBrandContext] = None


class CampaignPreview(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    focus: Optional[str] = None
    content_pillars: List[str] = Field(default_factory=list)
    target_audience: Dict = Field(default_factory=dict)  # job_titles, industries, interests
    tone_voice: str
    posting_schedule: Dict = Field(default_factory=dict)
    sample_posts: List[str] = Field(default_factory=list)


class CampaignPreviewResponse(BaseModel):
    campaigns: List[CampaignPreview]


class PostPreviewRequest(BaseModel):
    org_id: str
    campaign_id: str
    count: int = 7


class PostPreviewResponse(BaseModel):
    posts: List[str]


# Enhanced color patterns - matches hex, rgb, rgba, hsl, hsla, and named colors
COLOR_PATTERN = re.compile(
    r"(?:#(?:[0-9a-fA-F]{3}){1,2}|"
    r"rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|"
    r"rgba\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|"
    r"hsl\s*\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)|"
    r"hsla\s*\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)|"
    r"\b(?:red|green|blue|yellow|orange|purple|pink|brown|black|white|gray|grey|cyan|magenta|lime|navy|teal|olive|maroon|silver|gold|indigo|violet|turquoise|aqua|fuchsia|coral|salmon|khaki|plum|tan|beige|ivory|azure|lavender|mint|peach|rose|amber|emerald|ruby|sapphire|topaz|jade|amber|bronze|copper|slate|charcoal|burgundy|mustard|lavender|mauve|periwinkle|cerulean|crimson|forest|ocean|sunset|sunrise|midnight|dawn|dusk)\b)",
    re.IGNORECASE
)

# Enhanced font pattern - matches font-family declarations, @font-face, and Google Fonts
FONT_PATTERN = re.compile(
    r"(?:font-family\s*:\s*([^;\"']+)|"
    r"@font-face\s*\{[^}]*font-family\s*:\s*['\"]?([^;\"']+)['\"]?|"
    r"fonts\.googleapis\.com/css\?family=([^&\"']+))",
    re.IGNORECASE
)
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
WORD_PATTERN = re.compile(r"\b[a-zA-Z]{4,}\b")
STOPWORDS = {
    "with",
    "from",
    "this",
    "that",
    "they",
    "their",
    "have",
    "will",
    "into",
    "about",
    "your",
    "you",
    "them",
    "over",
    "what",
    "when",
    "around",
    "after",
    "because",
    "through",
    "which",
    "while",
    "using",
    "within",
    "where",
    "every",
    "there",
    "other",
    "would",
    "could",
    "should",
    "those",
}


def _safe_print(message: str) -> None:
    """Safely print messages that may contain Unicode characters"""
    try:
        print(message)
    except UnicodeEncodeError:
        # Try to encode and decode to remove problematic characters
        try:
            safe_message = message.encode('utf-8', errors='replace').decode('utf-8')
            print(safe_message)
        except Exception:
            # Last resort: print a generic message
            print("[BRAND] [Message contains Unicode characters that cannot be displayed]")


async def _fetch_text(session: aiohttp.ClientSession, url: str) -> str:
    """Fetch HTML content from a URL with proper headers and error handling"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=30), headers=headers, allow_redirects=True) as response:
            if response.status != 200:
                # Log detailed error information for debugging
                status_code = response.status
                status_reason = getattr(response, 'reason', 'Unknown')
                _safe_print(f"[BRAND] Failed to fetch {url}: HTTP {status_code} {status_reason}")
                
                # Provide more detailed error information
                status_text = f"HTTP {status_code}"
                if status_code == 403:
                    status_text += " (Forbidden - website may be blocking automated requests)"
                elif status_code == 404:
                    status_text += " (Not Found - page may not exist)"
                elif status_code == 429:
                    status_text += " (Too Many Requests - rate limited)"
                elif status_code >= 500:
                    status_text += " (Server Error - website may be temporarily unavailable)"
                
                try:
                    error_body = await response.text(encoding='utf-8', errors='ignore')
                    if len(error_body) > 200:
                        error_body = error_body[:200] + "..."
                    if error_body.strip():
                        status_text += f": {error_body}"
                except:
                    pass
                
                # Ensure status_text is safely encoded
                try:
                    safe_status_text = status_text.encode('utf-8', errors='replace').decode('utf-8')
                except:
                    safe_status_text = f"HTTP {status_code}"
                
                safe_url = url
                try:
                    safe_url = url.encode('utf-8', errors='replace').decode('utf-8')
                except:
                    pass
                
                raise HTTPException(
                    status_code=400, 
                    detail=f"Unable to fetch content from {safe_url}. Server returned {safe_status_text}. Please verify the URL is correct and accessible."
                )
            # Explicitly use UTF-8 encoding to avoid charmap codec errors on Windows
            return await response.text(encoding='utf-8', errors='replace')
    except aiohttp.ClientError as e:
        # Safely get error message
        try:
            error_str = str(e)
            safe_error = error_str.encode('utf-8', errors='replace').decode('utf-8')
        except:
            safe_error = "Network connection error"
        raise HTTPException(
            status_code=400,
            detail=f"Network error while fetching {url}: {safe_error}. Please check if the website is accessible."
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=400,
            detail=f"Request to {url} timed out. The website may be slow or unavailable."
        )


def _deduplicate_preserve_order(items: List[str]) -> List[str]:
    seen = set()
    ordered = []
    for item in items:
        normalized = item.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(normalized)
    return ordered


async def _download_and_store_images(session: aiohttp.ClientSession, image_urls: List[str], source_url: str, org_id: Optional[str] = None, user_id: Optional[str] = None) -> List[str]:
    """Download images and store them locally, save metadata to database, return backend URLs"""
    import os
    import hashlib
    from pathlib import Path
    from urllib.parse import urlparse
    from datetime import datetime
    
    # Create brand-images directory if it doesn't exist
    base_dir = Path(__file__).parent.parent.parent.parent  # Go up to backend/
    images_dir = base_dir / "uploads" / "brand-images"
    images_dir.mkdir(parents=True, exist_ok=True)
    
    stored_urls = []
    domain = urlparse(source_url).netloc.replace('.', '_')
    
    # Get database connection for saving image metadata
    db = None
    if org_id or user_id:
        db = get_db()
        # Get user_id from org if not provided
        if org_id and not user_id:
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
            if org:
                user_id = org.get("created_by")
    
    _safe_print(f"[IMAGE] Starting download of {len(image_urls)} images to {images_dir}")
    if org_id:
        _safe_print(f"[IMAGE] Associating images with org_id: {org_id}, user_id: {user_id}")
    
    for idx, img_url in enumerate(image_urls[:6]):  # Limit to 6 images
        try:
            _safe_print(f"[IMAGE] Processing image {idx + 1}/{min(len(image_urls), 6)}: {img_url[:80]}...")
            
            # Skip data URIs and invalid URLs
            if img_url.startswith("data:") or not img_url.startswith(("http://", "https://")):
                _safe_print(f"[IMAGE] Skipping invalid URL (data URI or not http/https): {img_url[:50]}")
                continue
            
            # Download image
            async with session.get(img_url, timeout=10, allow_redirects=True, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }) as response:
                if response.status != 200:
                    _safe_print(f"[IMAGE] Failed to download {img_url}: HTTP {response.status}")
                    continue
                
                # Read image data first
                image_data = await response.read()
                
                # Check if it's actually an image by content type and magic bytes
                content_type = response.headers.get('Content-Type', '')
                is_image_by_type = content_type.startswith('image/')
                
                # Check magic bytes
                is_image_by_bytes = (
                    image_data.startswith(b'\x89PNG') or  # PNG
                    image_data.startswith(b'\xff\xd8\xff') or  # JPEG
                    image_data.startswith(b'GIF8') or  # GIF
                    image_data.startswith(b'RIFF') or  # WebP
                    image_data.startswith(b'\x00\x00\x01\x00')  # ICO
                )
                
                if not is_image_by_type and not is_image_by_bytes:
                    _safe_print(f"[IMAGE] Not an image: {content_type}, magic bytes: {image_data[:10]}")
                    continue
                
                # Validate it's actually image data (at least 500 bytes to avoid tiny icons)
                if len(image_data) < 500:
                    _safe_print(f"[IMAGE] Image too small: {len(image_data)} bytes")
                    continue
                
                # Generate filename from URL hash + index
                url_hash = hashlib.md5(img_url.encode()).hexdigest()[:8]
                ext = 'jpg'  # Default
                if 'png' in content_type:
                    ext = 'png'
                elif 'gif' in content_type:
                    ext = 'gif'
                elif 'webp' in content_type:
                    ext = 'webp'
                
                filename = f"{domain}_{url_hash}_{idx}.{ext}"
                filepath = images_dir / filename
                
                # Save image
                with open(filepath, 'wb') as f:
                    f.write(image_data)
                
                # Return backend URL
                backend_url = f"/api/brand/images/{filename}"
                stored_urls.append(backend_url)
                _safe_print(f"[IMAGE] SUCCESS: Stored {filename} ({len(image_data)} bytes) -> {backend_url}")
                
                # Save image metadata to database if org_id/user_id available
                if db and (org_id or user_id):
                    image_metadata = {
                        "id": str(uuid.uuid4()),
                        "filename": filename,
                        "file_path": str(filepath),
                        "backend_url": backend_url,
                        "original_url": img_url,
                        "source_url": source_url,
                        "org_id": org_id,
                        "user_id": user_id,
                        "file_size": len(image_data),
                        "content_type": content_type,
                        "created_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                    await db.user_images.insert_one(image_metadata)
                    _safe_print(f"[IMAGE] Saved metadata to database for {filename}")
                
        except Exception as e:
            _safe_print(f"[IMAGE] ERROR downloading {img_url[:80]}: {e}")
            import traceback
            _safe_print(f"[IMAGE] Traceback: {traceback.format_exc()}")
            continue
    
    _safe_print(f"[IMAGE] Download complete: {len(stored_urls)}/{len(image_urls)} images stored successfully")
    return stored_urls


async def _extract_brand_attributes(url: str, org_id: Optional[str] = None) -> BrandDiscoveryResponse:
    """Extract brand attributes from a website URL with comprehensive error handling"""
    parsed = urlparse(url if url.startswith("http") else f"https://{url}")
    normalized_url = parsed.geturl()
    base_url = f"{parsed.scheme}://{parsed.netloc}"

    # Try to fetch website content, but continue even if it fails
    html = None
    soup = None
    fetch_failed = False

    async with aiohttp.ClientSession() as session:
        try:
            html = await _fetch_text(session, normalized_url)
            soup = BeautifulSoup(html, "html.parser")
        except HTTPException as e:
            # Website fetch failed - log but continue with minimal data
            fetch_failed = True
            _safe_print(f"[BRAND] [WARNING] Website fetch failed: {e.detail}")
            _safe_print(f"[BRAND] Continuing with minimal brand analysis using URL and domain only")
            # Create empty soup for safety
            soup = BeautifulSoup("", "html.parser")
        except Exception as e:
            fetch_failed = True
            _safe_print(f"[BRAND] [WARNING] Unexpected error fetching website: {e}")
            soup = BeautifulSoup("", "html.parser")

        # Gather inline colors/fonts from HTML (only if fetch succeeded)
        colors = []
        fonts = []
        if html and not fetch_failed:
            colors = COLOR_PATTERN.findall(html)
            fonts = FONT_PATTERN.findall(html)
            _safe_print(f"[BRAND] Initial extraction: {len(colors)} colors, {len(fonts)} fonts from HTML")
        else:
            _safe_print(f"[BRAND] No HTML content available - using minimal brand analysis")
        
        # CSS variable patterns for color extraction
        css_var_color_pattern = re.compile(r"--(?:color|primary|secondary|accent|background|text|border|brand|theme)[a-zA-Z0-9-]*\s*:\s*([^;]+)", re.IGNORECASE)
        
        # Extract colors from inline style attributes
        inline_styled = soup.find_all(attrs={"style": True})
        for element in inline_styled:
            style_content = element.get("style", "")
            colors.extend(COLOR_PATTERN.findall(style_content))
            fonts.extend(FONT_PATTERN.findall(style_content))
            
            # Extract CSS variables from inline styles (especially color-related ones)
            css_vars = css_var_color_pattern.findall(style_content)
            for var_value in css_vars:
                # Check if the CSS variable value is a color
                colors.extend(COLOR_PATTERN.findall(var_value))

        # Pull inline styles
        style_blocks = soup.find_all("style")
        _safe_print(f"[BRAND] Found {len(style_blocks)} style blocks")
        for block in style_blocks:
            content = block.get_text() or ""
            block_colors = COLOR_PATTERN.findall(content)
            block_fonts = FONT_PATTERN.findall(content)
            colors.extend(block_colors)
            fonts.extend(block_fonts)
            _safe_print(f"[BRAND] Style block: {len(block_colors)} colors, {len(block_fonts)} fonts")
            
            # Extract CSS variables from style blocks (especially color-related ones)
            css_vars = css_var_color_pattern.findall(content)
            for var_value in css_vars:
                colors.extend(COLOR_PATTERN.findall(var_value))
        
        # Extract fonts from Google Fonts links
        for link_tag in soup.find_all("link"):
            href = link_tag.get("href", "")
            if "fonts.googleapis.com" in href or "fonts.gstatic.com" in href:
                # Extract font family from URL
                font_match = re.search(r"family=([^&:]+)", href)
                if font_match:
                    font_name = font_match.group(1).replace("+", " ")
                    fonts.append(font_name)
        
        # Extract fonts from @font-face declarations
        for style_block in style_blocks:
            content = style_block.get_text() or ""
            fontface_matches = re.findall(r"@font-face\s*\{[^}]*font-family\s*:\s*['\"]?([^;\"']+)['\"]?", content, re.IGNORECASE)
            fonts.extend(fontface_matches)

        # Attempt to fetch first two external stylesheets for richer data (only if fetch succeeded)
        stylesheet_links = []
        if html and not fetch_failed:
            for link_tag in soup.find_all("link"):
                rel = link_tag.get("rel") or []
                if any("stylesheet" in rel_value.lower() for rel_value in rel):
                    href = link_tag.get("href")
                    if href:
                        stylesheet_links.append(urljoin(base_url, href))
            stylesheet_links = stylesheet_links[:2]

        async def fetch_stylesheet(sheet_url: str) -> str:
            try:
                return await _fetch_text(session, sheet_url)
            except Exception:
                return ""

        if stylesheet_links:
            _safe_print(f"[BRAND] Fetching {len(stylesheet_links)} external stylesheets")
            stylesheet_contents = await asyncio.gather(
                *[fetch_stylesheet(link) for link in stylesheet_links]
            )
            for i, sheet_content in enumerate(stylesheet_contents):
                if sheet_content:
                    sheet_colors = COLOR_PATTERN.findall(sheet_content)
                    sheet_fonts = FONT_PATTERN.findall(sheet_content)
                    colors.extend(sheet_colors)
                    fonts.extend(sheet_fonts)
                    _safe_print(f"[BRAND] Stylesheet {i+1}: {len(sheet_colors)} colors, {len(sheet_fonts)} fonts")
                    
                    # Extract CSS variables from stylesheets
                    css_vars = css_var_color_pattern.findall(sheet_content)
                    for var_value in css_vars:
                        colors.extend(COLOR_PATTERN.findall(var_value))

        # Normalize colors - convert to hex format when possible
        normalized_colors = []
        for color in colors:
            color = color.strip()
            if not color:
                continue
            
            # Skip transparent/transparent colors
            if color.lower() in ['transparent', 'none', 'inherit', 'initial', 'unset']:
                continue
            
            # Convert named colors to hex (basic set)
            named_to_hex = {
                'red': '#FF0000', 'green': '#008000', 'blue': '#0000FF', 'yellow': '#FFFF00',
                'orange': '#FFA500', 'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A',
                'black': '#000000', 'white': '#FFFFFF', 'gray': '#808080', 'grey': '#808080',
                'cyan': '#00FFFF', 'magenta': '#FF00FF', 'lime': '#00FF00', 'navy': '#000080',
                'teal': '#008080', 'olive': '#808000', 'maroon': '#800000', 'silver': '#C0C0C0',
                'gold': '#FFD700', 'indigo': '#4B0082', 'violet': '#EE82EE', 'turquoise': '#40E0D0',
                'aqua': '#00FFFF', 'fuchsia': '#FF00FF', 'coral': '#FF7F50', 'salmon': '#FA8072',
                'khaki': '#F0E68C', 'plum': '#DDA0DD', 'tan': '#D2B48C', 'beige': '#F5F5DC',
                'ivory': '#FFFFF0', 'azure': '#F0FFFF', 'lavender': '#E6E6FA', 'mint': '#F5FFFA',
                'peach': '#FFE5B4', 'rose': '#FF007F', 'amber': '#FFBF00', 'emerald': '#50C878',
                'ruby': '#E0115F', 'sapphire': '#0F52BA', 'jade': '#00A86B', 'bronze': '#CD7F32',
                'copper': '#B87333', 'slate': '#708090', 'charcoal': '#36454F', 'burgundy': '#800020',
                'mustard': '#FFDB58', 'mauve': '#E0B0FF', 'periwinkle': '#CCCCFF', 'cerulean': '#007BA7',
                'crimson': '#DC143C', 'forest': '#228B22', 'ocean': '#005F6B', 'sunset': '#FD5E53',
                'sunrise': '#FF9500', 'midnight': '#191970', 'dawn': '#F4A460', 'dusk': '#4B0082'
            }
            
            if color.lower() in named_to_hex:
                normalized_colors.append(named_to_hex[color.lower()])
            elif color.startswith('#'):
                # Normalize hex colors
                if len(color) == 4:  # #fff -> #ffffff
                    normalized_colors.append('#' + ''.join([c*2 for c in color[1:]]).upper())
                else:
                    normalized_colors.append(color.upper())
            elif color.startswith('rgb') or color.startswith('hsl'):
                # For now, keep RGB/HSL as-is (could convert to hex later)
                normalized_colors.append(color)
            else:
                # Try to extract hex from the string
                hex_match = re.search(r'#(?:[0-9a-fA-F]{3}){1,2}', color)
                if hex_match:
                    normalized_colors.append(hex_match.group(0).upper())
        
        color_palette = _deduplicate_preserve_order(normalized_colors)[:10]  # Increased to 10

        # Normalize fonts
        font_families = []
        for font_declaration in fonts:
            if not font_declaration:
                continue
            # Handle tuple results from regex (multiple groups)
            if isinstance(font_declaration, tuple):
                font_declaration = ' '.join([f for f in font_declaration if f])
            
            for raw_font in font_declaration.split(","):
                candidate = raw_font.strip().strip('"\''"")
                # Remove common generic font fallbacks
                generic_fonts = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'inherit', 'initial', 'unset']
                if candidate and candidate.lower() not in generic_fonts and len(candidate) > 1:
                    # Clean up font names (remove quotes, extra spaces)
                    candidate = re.sub(r'["\']', '', candidate).strip()
                    if candidate:
                        font_families.append(candidate)
        
        font_families = _deduplicate_preserve_order(font_families)[:8]  # Increased to 8
        
        _safe_print(f"[BRAND] Final extraction: {len(color_palette)} colors, {len(font_families)} fonts")
        if color_palette:
            _safe_print(f"[BRAND] Colors found: {color_palette[:5]}")
        if font_families:
            _safe_print(f"[BRAND] Fonts found: {font_families[:5]}")

        # Imagery: prefer Open Graph image then inline imagery
        imagery = []
        
        # 1. Open Graph image (highest priority)
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            og_url = urljoin(base_url, og_image["content"])
            if og_url not in imagery:
                imagery.append(og_url)
        
        # 2. Twitter Card image
        twitter_image = soup.find("meta", attrs={"name": "twitter:image"})
        if twitter_image and twitter_image.get("content"):
            twitter_url = urljoin(base_url, twitter_image["content"])
            if twitter_url not in imagery:
                imagery.append(twitter_url)
        
        # 3. Find hero images (in header, hero sections, or with hero-related classes)
        hero_selectors = [
            "header img",
            ".hero img",
            ".banner img",
            "[class*='hero'] img",
            "[class*='Hero'] img",
            "[class*='banner'] img",
            "[class*='Banner'] img",
            "[id*='hero'] img",
            "[id*='Hero'] img",
            "section:first-of-type img",
            "main img:first-of-type",
        ]
        
        hero_images = []
        for selector in hero_selectors:
            hero_imgs = soup.select(selector)
            for img_tag in hero_imgs[:2]:  # Limit to first 2 per selector
                # Check multiple src attributes for lazy loading
                src = (
                    img_tag.get("src") or
                    img_tag.get("data-src") or
                    img_tag.get("data-lazy-src") or
                    img_tag.get("data-original") or
                    img_tag.get("data-srcset", "").split(",")[0].strip().split(" ")[0] if img_tag.get("data-srcset") else None
                )
                if src:
                    # Handle srcset
                    if not src.startswith("http") and img_tag.get("srcset"):
                        srcset = img_tag.get("srcset")
                        # Get the largest image from srcset
                        srcset_parts = [s.strip().split() for s in srcset.split(",")]
                        if srcset_parts:
                            # Sort by width descriptor and take largest
                            try:
                                srcset_parts.sort(key=lambda x: int(x[1].replace("w", "")) if len(x) > 1 and x[1].replace("w", "").isdigit() else 0, reverse=True)
                                src = srcset_parts[0][0]
                            except:
                                pass
                    
                    image_url = urljoin(base_url, src)
                    if image_url not in hero_images and image_url not in imagery:
                        hero_images.append(image_url)
        
        # Add hero images first
        imagery.extend(hero_images[:3])
        
        # 4. Find other images, prioritizing larger ones
        all_images = []
        for img_tag in soup.find_all("img"):
            # Check multiple src attributes for lazy loading
            src = (
                img_tag.get("src") or
                img_tag.get("data-src") or
                img_tag.get("data-lazy-src") or
                img_tag.get("data-original") or
                img_tag.get("data-srcset", "").split(",")[0].strip().split(" ")[0] if img_tag.get("data-srcset") else None
            )
            
            if not src:
                continue
            
            # Handle srcset - get the largest image
            if img_tag.get("srcset"):
                srcset = img_tag.get("srcset")
                srcset_parts = [s.strip().split() for s in srcset.split(",")]
                if srcset_parts:
                    try:
                        # Sort by width descriptor and take largest
                        srcset_parts.sort(key=lambda x: int(x[1].replace("w", "")) if len(x) > 1 and x[1].replace("w", "").isdigit() else 0, reverse=True)
                        src = srcset_parts[0][0]
                    except:
                        pass
            
            image_url = urljoin(base_url, src)
            
            # Skip data URIs, SVGs, and very small images
            if image_url.startswith("data:") or image_url.endswith(".svg"):
                continue
            
            # Get image dimensions if available
            width = img_tag.get("width")
            height = img_tag.get("height")
            size_score = 0
            if width and height:
                try:
                    size_score = int(width) * int(height)
                except:
                    pass
            
            # Also check for picture/source elements (responsive images)
            parent = img_tag.find_parent("picture")
            if parent:
                for source in parent.find_all("source"):
                    srcset = source.get("srcset")
                    if srcset:
                        srcset_parts = [s.strip().split() for s in srcset.split(",")]
                        if srcset_parts:
                            try:
                                srcset_parts.sort(key=lambda x: int(x[1].replace("w", "")) if len(x) > 1 and x[1].replace("w", "").isdigit() else 0, reverse=True)
                                larger_src = srcset_parts[0][0]
                                image_url = urljoin(base_url, larger_src)
                            except:
                                pass
            
            if image_url not in imagery and image_url not in all_images:
                all_images.append((image_url, size_score))
        
        # Sort by size (largest first) and add to imagery
        all_images.sort(key=lambda x: x[1], reverse=True)
        for image_url, _ in all_images:
            if image_url not in imagery:
                imagery.append(image_url)
            if len(imagery) >= 12:  # Increased limit to get more images
                break
        
        # 5. Check for background images in inline styles
        for element in soup.find_all(attrs={"style": True}):
            style = element.get("style", "")
            bg_image_match = re.search(r'background-image:\s*url\(["\']?([^"\']+)["\']?\)', style, re.IGNORECASE)
            if bg_image_match:
                bg_url = urljoin(base_url, bg_image_match.group(1))
                if bg_url not in imagery and not bg_url.startswith("data:") and not bg_url.endswith(".svg"):
                    imagery.append(bg_url)
                if len(imagery) >= 15:
                    break
        
        # 6. Check for background images in style blocks
        for style_block in style_blocks:
            content = style_block.get_text() or ""
            bg_matches = re.findall(r'background-image:\s*url\(["\']?([^"\']+)["\']?\)', content, re.IGNORECASE)
            for bg_match in bg_matches:
                bg_url = urljoin(base_url, bg_match)
                if bg_url not in imagery and not bg_url.startswith("data:") and not bg_url.endswith(".svg"):
                    imagery.append(bg_url)
                if len(imagery) >= 15:
                    break
        
        # 7. Check for images in CSS files (from stylesheets we fetched)
        if stylesheet_links:
            for sheet_content in stylesheet_contents:
                if sheet_content:
                    bg_matches = re.findall(r'background-image:\s*url\(["\']?([^"\']+)["\']?\)', sheet_content, re.IGNORECASE)
                    for bg_match in bg_matches:
                        bg_url = urljoin(base_url, bg_match)
                        if bg_url not in imagery and not bg_url.startswith("data:") and not bg_url.endswith(".svg"):
                            imagery.append(bg_url)
                        if len(imagery) >= 15:
                            break
        
        # Limit to top 10 images for response (increased from 6)
        imagery = imagery[:10]
        _safe_print(f"[BRAND] Found {len(imagery)} image URLs from website scraping")
        
        if imagery:
            _safe_print(f"[BRAND] Image URLs found:")
            for idx, img_url in enumerate(imagery[:6], 1):
                _safe_print(f"[BRAND]   {idx}. {img_url}")
        else:
            _safe_print(f"[BRAND] WARNING: No images found! Debugging HTML structure...")
            # Debug: Check if there are any img tags at all
            all_img_tags = soup.find_all("img")
            _safe_print(f"[BRAND]   Total <img> tags in HTML: {len(all_img_tags)}")
            if all_img_tags:
                _safe_print(f"[BRAND]   Sample img tags (first 3):")
                for i, img in enumerate(all_img_tags[:3], 1):
                    try:
                        src_val = str(img.get('src', 'NONE'))[:60]
                        data_src_val = str(img.get('data-src', 'NONE'))[:60]
                        classes_val = str(img.get('class', []))
                        _safe_print(f"[BRAND]     {i}. src={src_val}")
                        _safe_print(f"[BRAND]        data-src={data_src_val}")
                        _safe_print(f"[BRAND]        classes={classes_val}")
                    except:
                        _safe_print(f"[BRAND]     {i}. [Image tag contains Unicode]")
            else:
                _safe_print(f"[BRAND]   No <img> tags found in HTML at all!")
        
        # NEW APPROACH: Download and store images, return our backend URLs (only if fetch succeeded)
        stored_imagery = []
        if html and not fetch_failed and imagery:
            _safe_print(f"[BRAND] Downloading and storing {len(imagery)} images...")
            # Get user_id from org_id if available
            user_id = None
            if org_id:
                try:
                    db = get_db()
                    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
                    if org:
                        user_id = org.get("created_by")
                except:
                    pass
            stored_imagery = await _download_and_store_images(session, imagery, normalized_url, org_id=org_id, user_id=user_id)
            _safe_print(f"[BRAND] Successfully stored {len(stored_imagery)} images")
        else:
            if fetch_failed:
                _safe_print(f"[BRAND] Skipping image download - website fetch failed")
            else:
                _safe_print(f"[BRAND] No images to download - skipping storage")
        
        # Use stored images if available, fallback to original URLs
        final_imagery = stored_imagery if stored_imagery else (imagery[:6] if imagery else [])
        _safe_print(f"[BRAND] Returning {len(final_imagery)} images in response")

        # Safely extract title, handling Unicode encoding issues
        try:
            title = soup.title.string.strip() if soup.title and soup.title.string else None
            # Ensure title is a valid string that can be encoded
            if title:
                title = title.encode('utf-8', errors='replace').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError, AttributeError) as e:
            try:
                _safe_print(f"[BRAND] Warning: Could not extract title safely: {type(e).__name__}")
            except:
                pass
            title = None

        # Safely extract description, handling Unicode encoding issues
        try:
            description_tag = soup.find("meta", attrs={"name": "description"})
            og_description = soup.find("meta", property="og:description")
            description = (
                (description_tag.get("content") if description_tag else None)
                or (og_description.get("content") if og_description else None)
                or None
            )
            # Ensure description is a valid string that can be encoded
            if description:
                description = description.encode('utf-8', errors='replace').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError, AttributeError) as e:
            try:
                _safe_print(f"[BRAND] Warning: Could not extract description safely: {type(e).__name__}")
            except:
                pass
            description = None

        # Extract text content - include header and footer
        # Only extract if we have HTML content
        text_content = ""
        header_content = ""
        footer_content = ""
        
        if html and not fetch_failed:
            # Extract header content (excluding navigation)
            header = soup.find("header")
            if header:
                header_copy = BeautifulSoup(str(header), 'html.parser')
                for nav in header_copy.find_all("nav"):
                    nav.decompose()
                header_text = header_copy.get_text(separator=" ", strip=True)
                if header_text and len(header_text) > 10:
                    header_content = header_text
            
            # Extract footer content
            footer = soup.find("footer")
            if footer:
                footer_text = footer.get_text(separator=" ", strip=True)
                if footer_text and len(footer_text) > 10:
                    footer_content = footer_text
            
            # Extract main content - try multiple strategies to get ALL text
            main = soup.find("main") or soup.find("article") or soup.find("body")
            if main:
                text_content = main.get_text(separator=" ", strip=True)
            else:
                text_content = soup.get_text(separator=" ", strip=True)
            
            # If content is short, also try getting structured content from all elements
            if len(text_content) < 2000:
                structured_parts = []
                for selector in ['h1', 'h2', 'h3', 'h4', 'p', 'li', 'div[class*="content"]', 'div[class*="text"]', 'section', 'article']:
                    elements = soup.select(selector)
                    for elem in elements[:200]:  # Increase limit
                        elem_text = elem.get_text(strip=True)
                        if elem_text and len(elem_text) > 5:  # Lower threshold to get more content
                            structured_parts.append(elem_text)
                
                if structured_parts:
                    structured_text = " ".join(structured_parts)
                    if len(structured_text) > len(text_content):
                        text_content = structured_text
                        _safe_print(f"[BRAND] Extended main content with structured elements: {len(text_content)} chars")
            
            # Combine all content: header + main + footer
            content_parts = []
            if header_content:
                content_parts.append(header_content)
            if text_content:
                content_parts.append(text_content)
            if footer_content:
                content_parts.append(footer_content)
            
            text_content = " ".join(content_parts)
            
            # Ensure text_content is safely encoded (handle Unicode issues)
            try:
                text_content = text_content.encode('utf-8', errors='replace').decode('utf-8')
            except Exception:
                # If encoding fails, try to clean it
                text_content = text_content.encode('ascii', errors='ignore').decode('ascii')
            
            # Also try to extract footer pages content
            footer_links = []
            if footer:
                for link in footer.find_all("a", href=True):
                    href = link.get("href")
                    if href:
                        full_url = urljoin(base_url, href)
                        parsed_link = urlparse(full_url)
                        parsed_base = urlparse(base_url)
                        # Only include same-domain links
                        if parsed_link.netloc == parsed_base.netloc:
                            link_text = link.get_text(strip=True)
                            if link_text and len(link_text) > 2:
                                footer_links.append({
                                    "url": full_url,
                                    "text": link_text
                                })
        
            # Extract content from multiple pages (up to 10 pages)
            all_internal_links = []
            
            # Get footer links
            if footer_links:
                all_internal_links.extend(footer_links)
            
            # Also get navigation links from header/nav
            nav = soup.find("nav")
            if nav:
                for link in nav.find_all("a", href=True):
                    href = link.get("href")
                    if href:
                        full_url = urljoin(base_url, href)
                        parsed_link = urlparse(full_url)
                        parsed_base = urlparse(base_url)
                        # Only include same-domain links
                        if parsed_link.netloc == parsed_base.netloc:
                            link_text = link.get_text(strip=True)
                            if link_text and len(link_text) > 2:
                                link_info = {
                                    "url": full_url,
                                    "text": link_text
                                }
                                # Avoid duplicates
                                if not any(existing['url'] == full_url for existing in all_internal_links):
                                    all_internal_links.append(link_info)
            
            # Extract content from up to 10 pages
            pages_text = []
            if all_internal_links:
                _safe_print(f"[BRAND] Found {len(all_internal_links)} internal links, analyzing up to 10 pages...")
                
                # Prioritize important pages
                important_keywords = ['about', 'contact', 'company', 'team', 'mission', 'vision', 'values', 'services', 'products', 'solutions', 'blog', 'news', 'careers', 'culture']
                
                # Sort links: important ones first, then others
                prioritized_links = []
                other_links = []
                
                for link in all_internal_links:
                    if any(keyword in link['text'].lower() or keyword in link['url'].lower() for keyword in important_keywords):
                        prioritized_links.append(link)
                    else:
                        other_links.append(link)
                
                # Combine: important first, then others, limit to 10 total
                links_to_extract = (prioritized_links + other_links)[:10]
                
                # Extract content from selected pages
                for link_info in links_to_extract:
                    try:
                        page_url = link_info['url']
                        # Safely print link text (may contain Unicode)
                        try:
                            link_text = link_info['text'].encode('utf-8', errors='replace').decode('utf-8')
                        except:
                            link_text = str(link_info['text'])[:50]
                        _safe_print(f"[BRAND] Analyzing page {len(pages_text) + 1}/10: {link_text} ({page_url})")
                        
                        # Use same headers as main request
                        headers = {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5',
                        }
                        async with session.get(page_url, timeout=aiohttp.ClientTimeout(total=15), headers=headers, allow_redirects=True) as page_response:
                            if page_response.status == 200:
                                page_html = await page_response.text(encoding='utf-8', errors='replace')
                                page_soup = BeautifulSoup(page_html, "html.parser")
                                
                                # Remove scripts/styles
                                for script in page_soup(["script", "style"]):
                                    script.decompose()
                                
                                # Extract content - try multiple strategies to get ALL text
                                page_content = page_soup.find("main") or page_soup.find("article") or page_soup.find("body")
                                
                                if page_content:
                                    # Get all text from the page content
                                    page_text = page_content.get_text(separator=" ", strip=True)
                                    
                                    # If main content is short, also try getting structured content
                                    if len(page_text) < 1000:
                                        # Try to get more structured content
                                        structured_parts = []
                                        for selector in ['h1', 'h2', 'h3', 'h4', 'p', 'li', 'div[class*="content"]', 'div[class*="text"]']:
                                            elements = page_soup.select(selector)
                                            for elem in elements[:100]:  # Increase limit
                                                elem_text = elem.get_text(strip=True)
                                                if elem_text and len(elem_text) > 5:  # Lower threshold
                                                    structured_parts.append(elem_text)
                                        
                                        if structured_parts:
                                            structured_text = " ".join(structured_parts)
                                            if len(structured_text) > len(page_text):
                                                page_text = structured_text
                                    
                                    # Use more text per page (increased from 2000 to 8000)
                                    if page_text and len(page_text) > 20:  # Lower threshold from 50
                                        # Ensure page_text is safely encoded
                                        try:
                                            page_text = page_text.encode('utf-8', errors='replace').decode('utf-8')
                                        except:
                                            pass
                                        pages_text.append(page_text[:8000])  # Increased from 2000 to 8000 chars per page
                                        # Safely print link text
                                        try:
                                            link_text = link_info['text'].encode('utf-8', errors='replace').decode('utf-8')
                                        except:
                                            link_text = str(link_info['text'])[:50]
                                        _safe_print(f"[BRAND] Extracted {len(page_text)} chars from {link_text} (using {min(len(page_text), 8000)} chars)")
                                    
                                    # Stop if we've extracted from 10 pages
                                    if len(pages_text) >= 10:
                                        break
                    except Exception as e:
                        _safe_print(f"[BRAND] Failed to extract page {link_info['url']}: {e}")
                        continue
            
            if pages_text:
                # Ensure all page texts are safely encoded before joining
                safe_pages_text = []
                for page_text in pages_text:
                    try:
                        safe_pages_text.append(page_text.encode('utf-8', errors='replace').decode('utf-8'))
                    except:
                        safe_pages_text.append(str(page_text))
                text_content = f"{text_content} {' '.join(safe_pages_text)}"
                # Safely print total characters
                try:
                    total_chars = len(' '.join(safe_pages_text))
                    _safe_print(f"[BRAND] Added content from {len(pages_text)} pages ({total_chars} total characters)")
                except:
                    _safe_print(f"[BRAND] Added content from {len(pages_text)} pages")

        sentences = SENTENCE_SPLIT.split(text_content)
        excerpt = " ".join(sentences[:3]).strip() if sentences else ""

        words = [word.lower() for word in WORD_PATTERN.findall(text_content)]
        filtered_words = [word for word in words if word not in STOPWORDS]
        keyword_summary = [
            word for word, _ in Counter(filtered_words).most_common(12)
        ]

        tone_keywords = keyword_summary[:6]

        # NEW: Use OpenAI to analyze brand DNA from website content
        brand_dna_analysis = None
        
        # If website fetch failed, create minimal content from URL/domain for AI analysis
        if fetch_failed and (not text_content or len(text_content.strip()) < 50):
            domain_name = parsed.netloc.replace('www.', '')
            text_content = f"Website: {normalized_url}\nDomain: {domain_name}\n"
            if title:
                text_content += f"Title: {title}\n"
            if description:
                text_content += f"Description: {description}\n"
            _safe_print(f"[BRAND] Created minimal content for AI analysis: {len(text_content)} chars")
        
        # Lower threshold - analyze even with minimal content
        if text_content and len(text_content.strip()) > 10:  # Lowered from 50 to allow minimal analysis
            try:
                _safe_print(f"[BRAND] Analyzing brand DNA with AI (content length: {len(text_content)} chars)...")
                
                # Get API key for LLM analysis
                from ..adapters.llm_adapter import LLMAdapter
                import os
                
                # Try to get API key from user settings if org_id provided
                api_key = None
                provider = "openai"
                
                if org_id:
                    try:
                        db = get_db()
                        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
                        if org:
                            user_id = org.get("created_by")
                            if user_id:
                                settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
                                if settings:
                                    api_key, provider = get_api_key_and_provider(settings, decrypt_value)
                    except Exception as e:
                        _safe_print(f"[BRAND] Could not get API key from org settings: {e}")
                
                # Fallback to environment variables
                if not api_key:
                    api_key = os.environ.get('OPENAI_API_KEY')
                    if api_key:
                        provider = "openai"
                
                # Final fallback: try system settings (admin-managed API keys)
                if not api_key:
                    try:
                        from ..routes.drafts import get_system_api_key
                        api_key, provider = await get_system_api_key("any")
                        if api_key:
                            _safe_print(f"[BRAND] [SUCCESS] Using system API key from admin dashboard (provider: {provider})")
                        else:
                            _safe_print(f"[BRAND] [WARNING] No system API key found in admin settings")
                    except Exception as e:
                        _safe_print(f"[BRAND] [WARNING] Error getting system API key: {e}")
                
                if api_key:
                    # Use faster model for brand DNA analysis (gpt-4o-mini is 2-3x faster than gpt-4o)
                    model = "gpt-4o-mini" if provider == "openai" else None  # Use default for Google AI
                    llm = LLMAdapter(api_key=api_key, provider=provider, model=model)
                    
                    # Create prompt for brand DNA analysis with emphasis on specificity
                    # Safely print content preview
                    try:
                        preview = text_content[:500].encode('utf-8', errors='replace').decode('utf-8')
                        _safe_print(f"[BRAND] Content preview: {preview}...")
                    except Exception:
                        _safe_print(f"[BRAND] Content preview: [Content contains Unicode characters] (length: {len(text_content)} chars)")
                    
                    # Ensure text_content is safe for use in f-strings
                    safe_text_content = text_content.encode('utf-8', errors='replace').decode('utf-8')
                    safe_title = (title or 'Not provided').encode('utf-8', errors='replace').decode('utf-8') if title else 'Not provided'
                    safe_description = (description or 'Not provided').encode('utf-8', errors='replace').decode('utf-8') if description else 'Not provided'
                    
                    analysis_prompt = f"""You are a brand strategist analyzing a company website. Extract SPECIFIC, AUTHENTIC brand insights based on what the website actually says - NOT generic business terms.

WEBSITE URL: {normalized_url}
WEBSITE TITLE: {safe_title}
WEBSITE DESCRIPTION: {safe_description}

WEBSITE CONTENT (from up to 10 pages):
{safe_text_content[:20000]}  # Reduced from 50k to 20k for faster processing

CRITICAL INSTRUCTIONS:
- Base your analysis ONLY on what is actually written in the content above
- Be SPECIFIC - extract real messages, values, and propositions from the content
- Avoid generic phrases like "Industry expertise" or "Customer success" unless the content specifically mentions them
- If the content mentions specific products, services, industries, or customer problems, include those EXACTLY
- Extract the actual brand personality and tone from how they write, not from assumptions

Extract and return ONLY valid JSON with these fields:
{{
  "brand_story": "A 2-3 sentence narrative about what this brand stands for, its mission, and its unique value proposition - based on what the website actually says",
  "brand_personality": ["3-5 personality traits that describe the brand based on their content (e.g., innovative, trustworthy, bold, approachable)"],
  "core_values": ["3-5 core values or principles the brand embodies - extract from their actual messaging"],
  "target_audience_description": "A brief description of who this brand serves - based on what they say about their customers",
  "target_audience": {{
    "job_titles": ["5-8 specific job titles this brand targets - infer from the content, products/services, and who would benefit (e.g., CEO, Marketing Director, Small Business Owner, HR Manager)"],
    "industries": ["3-5 industries this brand serves - extract from mentions of sectors, verticals, or customer types (e.g., Technology, Healthcare, E-commerce, Finance)"],
    "interests": ["5-8 professional interests of the target audience - based on topics, pain points, and solutions discussed (e.g., Digital Transformation, Business Growth, Productivity)"],
    "pain_points": ["3-5 key challenges or pain points the target audience faces - extract from problems the brand claims to solve"]
  }},
  "unique_selling_points": ["3-5 key differentiators or unique selling points - extract from their actual content"],
  "brand_tone": ["3-5 tone descriptors based on how they write (e.g., professional, friendly, authoritative, conversational)"],
  "key_messages": ["5-7 core messages the brand communicates - extract actual messages from the content, not generic ones"]
}}

Return ONLY the JSON object, no markdown formatting or explanation."""

                    analysis_result = await llm.generate_completion(analysis_prompt, temperature=0.7)
                    
                    # Parse JSON response
                    import json
                    try:
                        # Clean response - remove markdown code blocks if present
                        cleaned_result = analysis_result.strip()
                        if cleaned_result.startswith("```"):
                            # Remove markdown code blocks
                            lines = cleaned_result.split("\n")
                            cleaned_result = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned_result
                        if cleaned_result.startswith("```json"):
                            lines = cleaned_result.split("\n")
                            cleaned_result = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned_result
                        
                        brand_dna_analysis = json.loads(cleaned_result)
                        _safe_print(f"[BRAND] [SUCCESS] Brand DNA analysis complete:")
                        try:
                            story_preview = brand_dna_analysis.get('brand_story', 'N/A')
                            if isinstance(story_preview, str):
                                story_preview = story_preview[:100].encode('utf-8', errors='replace').decode('utf-8')
                            _safe_print(f"   - Brand Story: {story_preview}...")
                            _safe_print(f"   - Personality: {brand_dna_analysis.get('brand_personality', [])}")
                            _safe_print(f"   - Core Values: {brand_dna_analysis.get('core_values', [])}")
                            # Log target audience
                            ta = brand_dna_analysis.get('target_audience', {})
                            if isinstance(ta, dict):
                                _safe_print(f"   - Target Audience:")
                                _safe_print(f"     * Job Titles: {ta.get('job_titles', [])[:5]}")
                                _safe_print(f"     * Industries: {ta.get('industries', [])[:5]}")
                                _safe_print(f"     * Interests: {ta.get('interests', [])[:5]}")
                                _safe_print(f"     * Pain Points: {ta.get('pain_points', [])[:3]}")
                        except Exception:
                            _safe_print(f"   - Brand DNA analysis completed successfully")
                        
                        # Enhance tone_keywords with AI-extracted tone
                        ai_tone = brand_dna_analysis.get('brand_tone', [])
                        if ai_tone:
                            tone_keywords = list(set(tone_keywords + ai_tone))[:6]
                            
                    except json.JSONDecodeError as e:
                        _safe_print(f"[BRAND] [WARNING] Failed to parse AI analysis JSON: {e}")
                        try:
                            raw_preview = analysis_result[:500].encode('utf-8', errors='replace').decode('utf-8')
                            _safe_print(f"[BRAND] Raw response: {raw_preview}")
                        except:
                            _safe_print(f"[BRAND] Raw response: [Contains Unicode characters]")
                else:
                    _safe_print(f"[BRAND] [WARNING] No API key available for brand DNA analysis - skipping AI analysis")
            except Exception as e:
                import traceback
                _safe_print(f"[BRAND] [WARNING] Brand DNA analysis failed: {e}")
                try:
                    traceback.print_exc()
                except UnicodeEncodeError:
                    _safe_print(f"[BRAND] [WARNING] Brand DNA analysis failed (traceback contains Unicode)")

        # Extract target audience data with proper defaults
        target_audience_data = {
            "job_titles": [],
            "industries": [],
            "interests": [],
            "pain_points": []
        }
        if brand_dna_analysis:
            ta = brand_dna_analysis.get("target_audience", {})
            if isinstance(ta, dict):
                target_audience_data = {
                    "job_titles": ta.get("job_titles", []) or [],
                    "industries": ta.get("industries", []) or [],
                    "interests": ta.get("interests", []) or [],
                    "pain_points": ta.get("pain_points", []) or []
                }
        
        return BrandDiscoveryResponse(
            normalized_url=normalized_url,
            title=title,
            description=description,
            color_palette=color_palette,
            font_families=font_families,
            imagery=final_imagery,  # Return stored backend URLs or original URLs
            tone_keywords=tone_keywords,
            keyword_summary=keyword_summary[:12],
            content_excerpt=excerpt or None,
            # Brand DNA analysis results
            brand_story=brand_dna_analysis.get("brand_story") if brand_dna_analysis else None,
            brand_personality=brand_dna_analysis.get("brand_personality", []) if brand_dna_analysis else [],
            core_values=brand_dna_analysis.get("core_values", []) if brand_dna_analysis else [],
            target_audience_description=brand_dna_analysis.get("target_audience_description") if brand_dna_analysis else None,
            target_audience=target_audience_data,
            unique_selling_points=brand_dna_analysis.get("unique_selling_points", []) if brand_dna_analysis else [],
            key_messages=brand_dna_analysis.get("key_messages", []) if brand_dna_analysis else [],
        )


async def _generate_campaign_suggestions_from_dna(
    generator: CampaignGenerator,
    brand_analysis: BrandAnalysis,
    count: int = 3
) -> List[CampaignSuggestion]:
    """Generate campaign suggestions from brand DNA using OpenAI"""
    import json
    
    # Build comprehensive target audience description
    target_audience_info = ""
    if isinstance(brand_analysis.target_audience, dict):
        job_titles = brand_analysis.target_audience.get('job_titles', [])
        industries = brand_analysis.target_audience.get('industries', [])
        interests = brand_analysis.target_audience.get('interests', [])
        pain_points = brand_analysis.target_audience.get('pain_points', [])
        target_audience_info = f"""
  - Job Titles: {', '.join(job_titles[:8]) if job_titles else 'Not specified'}
  - Industries: {', '.join(industries[:5]) if industries else 'Not specified'}
  - Interests: {', '.join(interests[:8]) if interests else 'Not specified'}
  - Pain Points: {', '.join(pain_points[:5]) if pain_points else 'Not specified'}"""
    elif brand_analysis.target_audience_description:
        target_audience_info = f"\n  - Description: {brand_analysis.target_audience_description[:300]}"
    
    prompt = f"""You are a senior LinkedIn marketing strategist. Generate {count} highly strategic, unique LinkedIn campaign concepts based on this comprehensive brand DNA.

=== COMPLETE BRAND DNA ===

BRAND IDENTITY:
- Brand Voice: {brand_analysis.brand_voice}
- Brand Tone/Personality: {', '.join(brand_analysis.brand_tone[:8]) if brand_analysis.brand_tone else 'professional, authentic'}
- Brand Personality Traits: {', '.join(brand_analysis.brand_personality[:8]) if brand_analysis.brand_personality else 'Not specified'}
- Visual Identity: Colors: {', '.join(brand_analysis.brand_colors[:5]) if brand_analysis.brand_colors else 'N/A'}, Fonts: {', '.join(brand_analysis.brand_fonts[:3]) if brand_analysis.brand_fonts else 'N/A'}

BRAND STORY & VALUES:
- Brand Story/Mission: {brand_analysis.brand_story[:400] if brand_analysis.brand_story else 'A brand committed to excellence and value creation'}
- Core Values: {', '.join(brand_analysis.core_values[:8]) if brand_analysis.core_values else 'Excellence, Innovation, Integrity'}
- Unique Selling Points: {', '.join(brand_analysis.unique_selling_points[:5]) if brand_analysis.unique_selling_points else 'Premium quality, Expert service'}

MESSAGING & VALUE:
- Key Messages: {', '.join(brand_analysis.key_messages[:8]) if brand_analysis.key_messages else 'Quality, Trust, Results'}
- Value Propositions: {', '.join(brand_analysis.value_propositions[:5]) if brand_analysis.value_propositions else 'Superior solutions'}

TARGET AUDIENCE:{target_audience_info}

CONTENT STRATEGY:
- Content Pillars: {', '.join(brand_analysis.content_pillars[:8]) if brand_analysis.content_pillars else 'Industry insights, Thought leadership'}
- Expert Segments to Target: {', '.join(brand_analysis.expert_segments[:5]) if brand_analysis.expert_segments else 'Industry leaders'}
- Posting Themes: {', '.join(brand_analysis.posting_themes[:5]) if brand_analysis.posting_themes else 'Insights, Tips, Stories'}

=== CAMPAIGN GENERATION REQUIREMENTS ===

Generate {count} UNIQUE campaign concepts that:
1. Directly leverage the brand story and unique selling points
2. Address specific pain points of the target audience
3. Align with brand personality and voice
4. Support content pillars with fresh angles
5. Have clear, measurable objectives
6. Feel authentic to this specific brand (not generic)

Each campaign must be DISTINCT in approach:
- Campaign 1: Focus on THOUGHT LEADERSHIP - establish authority in the industry
- Campaign 2: Focus on COMMUNITY ENGAGEMENT - build relationships and conversations
- Campaign 3: Focus on VALUE DELIVERY - educate and help the audience succeed

For each campaign provide:
- name: A compelling, memorable campaign name (2-5 words) that reflects brand personality
- description: 2-3 sentence description explaining the strategy, expected outcomes, and how it leverages brand DNA
- focus: Primary focus area with specific angle (e.g., "Thought Leadership - Industry Innovation", "Community Building - Expert Network")

Return ONLY valid JSON array:
[
  {{"name": "Campaign Name 1", "description": "Strategic description 1", "focus": "Focus Area 1"}},
  {{"name": "Campaign Name 2", "description": "Strategic description 2", "focus": "Focus Area 2"}},
  {{"name": "Campaign Name 3", "description": "Strategic description 3", "focus": "Focus Area 3"}}
]

NO markdown, ONLY the JSON array."""
    
    try:
        response = await generator.llm.generate_completion(prompt, temperature=0.7)
        
        # Clean and parse response
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        suggestions_data = json.loads(response_text.strip())
        
        if not isinstance(suggestions_data, list):
            suggestions_data = [suggestions_data]
        
        suggestions = []
        for item in suggestions_data[:count]:
            suggestions.append(
                CampaignSuggestion(
                    name=item.get("name", "Campaign Concept"),
                    description=item.get("description", ""),
                    focus=item.get("focus", "General")
                )
            )
        
        _safe_print(f"[BRAND] Generated {len(suggestions)} campaign suggestions from brand DNA")
        return suggestions
        
    except Exception as e:
        import traceback
        _safe_print(f"[BRAND] Failed to generate campaign suggestions from DNA: {e}")
        traceback.print_exc()
        # Fallback to generic suggestions based on content pillars
        suggestions = []
        pillars = brand_analysis.content_pillars[:count] if brand_analysis.content_pillars else ["Thought Leadership", "Industry Insights", "Best Practices"]
        for i, pillar in enumerate(pillars[:count], 1):
            suggestions.append(
                CampaignSuggestion(
                    name=f"{pillar} Campaign",
                    description=f"Engage your audience with insights and content focused on {pillar.lower()}.",
                    focus=pillar
                )
            )
        return suggestions


async def _prepare_generator(org_id: Optional[str] = None, user_id: Optional[str] = None, prefer_provider: Optional[str] = None) -> tuple[Optional[CampaignGenerator], Optional[str]]:
    """
    Prepare CampaignGenerator with API keys.
    ALWAYS uses system API keys from admin dashboard - users never enter API keys.
    
    Args:
        org_id: Organization ID (optional)
        user_id: User ID (optional)
        prefer_provider: Preferred provider to try first ("openai", "google_ai", or None for default)
    
    Returns:
        Tuple of (CampaignGenerator, user_id) or (None, error_message)
    """
    db = get_db()
    
    # If org_id is provided, get user_id from organization
    if org_id:
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        if org:
            user_id = org.get("created_by")
    
    # ALWAYS use system API keys from admin dashboard - users never enter API keys
    from ..routes.drafts import get_system_api_key
    
    # Determine provider priority
    key_type = prefer_provider or "any"
    
    # Try to get any available system API key
    api_key, provider = await get_system_api_key(key_type)
    
    if not api_key:
        # Get user_id for error message if available
        error_user = user_id
        if not error_user and org_id:
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
            if org:
                error_user = org.get("created_by")
        
        return None, "No system API keys configured in admin dashboard. Please configure API keys in Admin Dashboard > API Keys."
    
    # Get user_id for return value if needed
    if not user_id and org_id:
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
        if org:
            user_id = org.get("created_by")

    return CampaignGenerator(api_key=api_key, provider=provider), user_id


async def _generate_single_campaign(
    generator: CampaignGenerator,
    brand_analysis: BrandAnalysis,
    org_id: Optional[str],
    user_id: Optional[str],
    suggestion: CampaignSuggestion,
    idx: int,
    total: int
) -> tuple[Optional[CampaignPreview], Optional[str]]:
    """
    Generate a single campaign with error handling.
    Returns: (CampaignPreview or None, error_message or None)
    """
    from ..routes.drafts import get_system_api_key
    
    try:
        _safe_print(f"[BRAND] Generating campaign {idx}/{total}: {suggestion.name}")
        campaign: Campaign = await generator.generate_campaign_from_analysis(
            org_id=brand_analysis.org_id,
            created_by=user_id or "onboarding_temp",
            brand_analysis=brand_analysis,
            campaign_name=suggestion.name,
            focus_area=suggestion.focus,
            duration_weeks=12,
        )

        post_ideas = await generator.generate_post_ideas(
            campaign=campaign,
            brand_analysis=brand_analysis,
            count=3,
        )

        campaign_preview = CampaignPreview(
            id=campaign.id,
            name=campaign.name,
            description=suggestion.description or campaign.description,
            focus=suggestion.focus,
            content_pillars=campaign.content_pillars,
            target_audience=campaign.target_audience.model_dump() if hasattr(campaign.target_audience, 'model_dump') else (campaign.target_audience if isinstance(campaign.target_audience, dict) else {}),
            tone_voice=campaign.tone_voice.value
            if hasattr(campaign.tone_voice, "value")
            else str(campaign.tone_voice),
            posting_schedule=campaign.posting_schedule.model_dump(),
            sample_posts=post_ideas[:3],
        )
        _safe_print(f"[BRAND] Successfully generated campaign {idx}: {campaign.name}")
        return campaign_preview, None
        
    except Exception as error:
        error_str = str(error)
        error_msg = f"Campaign {idx} ({suggestion.name}): {error_str[:200]}"
        _safe_print(f"[BRAND] Campaign preview generation failed: {error_msg}")
        
        # Check if this is a quota/rate limit error - try alternate provider
        if "429" in error_str or "quota" in error_str.lower() or "rate" in error_str.lower():
            _safe_print(f"[BRAND] Detected quota/rate limit error. Trying alternate provider...")
            
            # Determine alternate provider
            current_provider = generator.llm.provider if hasattr(generator.llm, 'provider') else "openai"
            alternate = "google_ai_studio" if current_provider == "openai" else "openai"
            
            try:
                alt_key, alt_provider = await get_system_api_key(alternate)
                if alt_key:
                    _safe_print(f"[BRAND] Switching to {alt_provider} provider")
                    alt_generator = CampaignGenerator(api_key=alt_key, provider=alt_provider)
                    
                    # Retry this campaign with new provider
                    campaign = await alt_generator.generate_campaign_from_analysis(
                        org_id=brand_analysis.org_id,
                        created_by=user_id or "onboarding_temp",
                        brand_analysis=brand_analysis,
                        campaign_name=suggestion.name,
                        focus_area=suggestion.focus,
                        duration_weeks=12,
                    )
                    
                    post_ideas = await alt_generator.generate_post_ideas(
                        campaign=campaign,
                        brand_analysis=brand_analysis,
                        count=3,
                    )
                    
                    campaign_preview = CampaignPreview(
                        id=campaign.id,
                        name=campaign.name,
                        description=suggestion.description or campaign.description,
                        focus=suggestion.focus,
                        content_pillars=campaign.content_pillars,
                        target_audience=campaign.target_audience.model_dump() if hasattr(campaign.target_audience, 'model_dump') else (campaign.target_audience if isinstance(campaign.target_audience, dict) else {}),
                        tone_voice=campaign.tone_voice.value
                        if hasattr(campaign.tone_voice, "value")
                        else str(campaign.tone_voice),
                        posting_schedule=campaign.posting_schedule.model_dump(),
                        sample_posts=post_ideas[:3],
                    )
                    _safe_print(f"[BRAND] Successfully generated campaign {idx} with {alt_provider}: {campaign.name}")
                    return campaign_preview, None
            except Exception as retry_error:
                _safe_print(f"[BRAND] Alternate provider also failed: {str(retry_error)[:100]}")
        
        return None, error_msg


async def _try_generate_with_fallback(
    generator: CampaignGenerator,
    brand_analysis: BrandAnalysis,
    org_id: Optional[str],
    user_id: Optional[str],
    suggestions: List[CampaignSuggestion],
    count: int
) -> tuple[List[CampaignPreview], List[str]]:
    """
    Try to generate campaigns with the given generator in parallel.
    If it fails with quota/rate limit errors, try alternate provider.
    
    Returns:
        Tuple of (campaigns_list, errors_list)
    """
    campaigns = []
    errors = []
    
    # Generate all campaigns in parallel for better performance
    _safe_print(f"[BRAND] Generating {count} campaigns in parallel...")
    
    tasks = [
        _generate_single_campaign(
            generator=generator,
            brand_analysis=brand_analysis,
            org_id=org_id,
            user_id=user_id,
            suggestion=suggestion,
            idx=idx + 1,
            total=count
        )
        for idx, suggestion in enumerate(suggestions[:count])
    ]
    
    # Wait for all campaigns to complete
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    for result in results:
        if isinstance(result, Exception):
            errors.append(f"Campaign generation exception: {str(result)[:200]}")
        elif isinstance(result, tuple):
            campaign_preview, error_msg = result
            if campaign_preview:
                campaigns.append(campaign_preview)
            elif error_msg:
                errors.append(error_msg)
    
    _safe_print(f"[BRAND] Completed: {len(campaigns)} campaigns generated, {len(errors)} errors")
    
    return campaigns, errors


@router.post("/discover", response_model=BrandDiscoveryResponse)
async def discover_brand(request: BrandDiscoveryRequest):
    """Brand discovery endpoint with comprehensive error handling"""
    try:
        return await _extract_brand_attributes(request.url, org_id=request.org_id)
    except HTTPException as e:
        # Re-raise HTTPExceptions as-is, but ensure detail is safely encoded
        if e.detail:
            try:
                # Try to encode the detail to ensure it's safe
                safe_detail = str(e.detail).encode('utf-8', errors='replace').decode('utf-8')
                if safe_detail != e.detail:
                    raise HTTPException(status_code=e.status_code, detail=safe_detail)
            except:
                # If encoding fails, use a generic message
                raise HTTPException(status_code=e.status_code, detail="Request failed. Please try again.")
        raise
    except UnicodeEncodeError as error:
        # Handle encoding errors specifically - DON'T use traceback, it causes encoding errors
        _safe_print(f"[BRAND] Encoding error occurred during brand discovery")
        # Return JSONResponse directly to avoid any further encoding issues
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500, 
            content={"detail": "Character encoding error while processing website content. Please try again."}
        )
    except Exception as error:
        # Import JSONResponse here to avoid circular imports
        from fastapi.responses import JSONResponse
        
        # Get error type name safely (this should never fail)
        error_type = "Unknown"
        try:
            error_type = type(error).__name__
        except:
            pass
        
        # Safely get error message - completely avoid encoding issues
        error_msg = f"Error type: {error_type}"
        try:
            # Try to get error string
            error_str = str(error)
            # Try to encode it safely
            safe_str = error_str.encode('ascii', errors='replace').decode('ascii')
            if safe_str and len(safe_str) > 0:
                error_msg = safe_str[:200]
        except:
            pass
        
        # Safely print error message
        _safe_print(f"[BRAND] Discovery error: {error_msg}")
        
        # Return JSONResponse directly - this bypasses all HTTPException handling
        # and avoids any potential encoding issues in the exception handling chain
        return JSONResponse(
            status_code=500,
            content={"detail": f"Brand discovery error: {error_msg}"},
        )


@router.post("/campaign-previews", response_model=CampaignPreviewResponse)
async def generate_campaign_previews(request: CampaignPreviewRequest):
    db = get_db()
    org_id = request.org_id

    # Support onboarding: allow generating previews before an organization exists.
    analysis_doc = None
    if org_id:
        # Check if brand analysis exists and is up-to-date
        analysis_doc = await db.brand_analysis.find_one({"org_id": org_id}, {"_id": 0})
        # If org_id exists but no analysis found, and brand_context is provided, use it
        if not analysis_doc and request.brand_context:
            _safe_print(f"[CAMPAIGN-PREVIEWS] No analysis found for org_id={org_id}, using provided brand_context")
            if hasattr(request.brand_context, 'model_dump'):
                analysis_doc = request.brand_context.model_dump(exclude_none=True)
            elif isinstance(request.brand_context, dict):
                analysis_doc = request.brand_context.copy()
            else:
                analysis_doc = dict(request.brand_context) if request.brand_context else {}
            analysis_doc["org_id"] = org_id
    else:
        # No org_id (onboarding flow) - use brand_context if provided
        if request.brand_context:
            _safe_print(f"[CAMPAIGN-PREVIEWS] Using brand_context for onboarding (no org_id)")
            # Handle both Pydantic model and dict (from frontend)
            if hasattr(request.brand_context, 'model_dump'):
                analysis_doc = request.brand_context.model_dump(exclude_none=True)
            elif isinstance(request.brand_context, dict):
                analysis_doc = request.brand_context.copy()
            else:
                # Fallback: try to convert to dict
                analysis_doc = dict(request.brand_context) if request.brand_context else {}
            analysis_doc["org_id"] = "onboarding_temp"
            _safe_print(f"[CAMPAIGN-PREVIEWS] Brand context keys: {list(analysis_doc.keys())}")
            _safe_print(f"[CAMPAIGN-PREVIEWS] Brand voice: {analysis_doc.get('brand_voice')}")
            _safe_print(f"[CAMPAIGN-PREVIEWS] Content pillars: {analysis_doc.get('content_pillars')}")
            _safe_print(f"[CAMPAIGN-PREVIEWS] Key messages count: {len(analysis_doc.get('key_messages', []))}")
        else:
            # Be resilient: if frontend resumes mid-onboarding and loses analysisData,
            # still generate previews from suggestions/defaults rather than failing 422.
            _safe_print(f"[CAMPAIGN-PREVIEWS] WARNING: No brand_context provided, using defaults")
            analysis_doc = {
                "org_id": "onboarding_temp",
                "brand_voice": "professional",
                "brand_tone": [],
                "brand_colors": [],
                "brand_images": [],
                "brand_fonts": [],
                "key_messages": [],
                "value_propositions": [],
                "target_audience_description": None,
                "unique_selling_points": [],
                "target_audience": {
                    "job_titles": [],
                    "industries": [],
                    "interests": [],
                    "pain_points": [],
                },
                "content_pillars": [],
                "suggested_campaigns": [],
            }
    
    # Check if materials have been added/updated since last analysis
    if analysis_doc and org_id:
        analysis_updated_at = analysis_doc.get('updated_at')
        if isinstance(analysis_updated_at, str):
            from dateutil import parser
            analysis_updated_at = parser.parse(analysis_updated_at)
        
        # Get the most recent material update
        latest_material = await db.organization_materials.find(
            {"org_id": org_id},
            {"_id": 0, "updated_at": 1, "created_at": 1}
        ).sort("updated_at", -1).limit(1).to_list(length=1)
        
        needs_reanalysis = False
        if latest_material and len(latest_material) > 0:
            material_updated = latest_material[0].get('updated_at') or latest_material[0].get('created_at')
            if material_updated:
                if isinstance(material_updated, str):
                    from dateutil import parser
                    material_updated = parser.parse(material_updated)
                
                # If material was updated after analysis, we need to re-analyze
                if material_updated > analysis_updated_at:
                    needs_reanalysis = True
                    _safe_print(f"[CAMPAIGN-PREVIEWS] Materials updated after analysis. Material: {material_updated}, Analysis: {analysis_updated_at}")
        
        # Also check if new materials were added (by comparing counts)
        material_count = await db.organization_materials.count_documents({"org_id": org_id})
        analyzed_material_ids = analysis_doc.get('materials_analyzed', [])
        if material_count > len(analyzed_material_ids):
            needs_reanalysis = True
            _safe_print(f"[CAMPAIGN-PREVIEWS] New materials added. Current: {material_count}, Analyzed: {len(analyzed_material_ids)}")
        
        if needs_reanalysis:
            _safe_print(f"[CAMPAIGN-PREVIEWS] Brand analysis is stale. Triggering re-analysis...")
            # Trigger re-analysis by calling the analyze function directly
            try:
                from .organization_materials import analyze_materials
                # Call the analyze function (it's an async function)
                await analyze_materials(org_id)
                # Re-fetch the updated analysis
                analysis_doc = await db.brand_analysis.find_one(
                    {"org_id": org_id}, {"_id": 0}
                )
                if not analysis_doc:
                    raise HTTPException(
                        status_code=500, detail="Failed to regenerate brand analysis"
                    )
                _safe_print(f"[CAMPAIGN-PREVIEWS] Brand analysis regenerated successfully")
            except Exception as e:
                _safe_print(f"[CAMPAIGN-PREVIEWS] Warning: Failed to re-analyze materials: {e}")
                import traceback
                traceback.print_exc()
                _safe_print(f"[CAMPAIGN-PREVIEWS] Using existing analysis (may be stale)")
    
    if not analysis_doc:
        raise HTTPException(
            status_code=404, detail="No brand analysis found for organization. Please analyze materials first."
        )

    brand_analysis = BrandAnalysis(**analysis_doc)

    # Prepare generator: always use system API keys from admin dashboard
    generator, user_id = await _prepare_generator(org_id=org_id)

    if generator is None:
        return _fallback_campaign_previews(
            brand_analysis=brand_analysis,
            suggestions=(request.suggestions or []),
            count=request.count,
        )

    suggestions = request.suggestions or []
    if not suggestions:
        # First try to get suggestions from brand_analysis.suggested_campaigns
        if brand_analysis.suggested_campaigns:
            for item in brand_analysis.suggested_campaigns[: request.count]:
                suggestions.append(
                    CampaignSuggestion(
                        name=item.get("name", "Campaign Concept"),
                        description=item.get("description"),
                        focus=item.get("focus"),
                    )
                )
        
        # If still no suggestions, generate them from brand DNA using OpenAI
        if not suggestions and generator:
            _safe_print(f"[BRAND] No campaign suggestions found, generating from brand DNA...")
            try:
                generated_suggestions = await _generate_campaign_suggestions_from_dna(
                    generator=generator,
                    brand_analysis=brand_analysis,
                    count=request.count
                )
                suggestions.extend(generated_suggestions)
            except Exception as e:
                import traceback
                _safe_print(f"[BRAND] Failed to generate suggestions from DNA: {e}")
                traceback.print_exc()
                # Continue with empty suggestions - will use fallback if needed

    campaigns: List[CampaignPreview] = []
    errors = []
    
    # Ensure we have enough suggestions
    if len(suggestions) < request.count:
        needed = request.count - len(suggestions)
        
        # Try to get more from brand_analysis.suggested_campaigns
        if brand_analysis.suggested_campaigns and len(brand_analysis.suggested_campaigns) > len(suggestions):
            for item in brand_analysis.suggested_campaigns[len(suggestions):len(suggestions) + needed]:
                suggestions.append(
                    CampaignSuggestion(
                        name=item.get("name", f"Campaign {len(suggestions) + 1}"),
                        description=item.get("description"),
                        focus=item.get("focus"),
                    )
                )
        
        # If still not enough and we have a generator, generate more from DNA
        if len(suggestions) < request.count and generator:
            try:
                additional_needed = request.count - len(suggestions)
                generated_suggestions = await _generate_campaign_suggestions_from_dna(
                    generator=generator,
                    brand_analysis=brand_analysis,
                    count=additional_needed
                )
                suggestions.extend(generated_suggestions[:additional_needed])
            except Exception as e:
                _safe_print(f"[BRAND] Failed to generate additional suggestions: {e}")
    
    # Generate campaigns with fallback to alternate provider if quota/rate limit errors occur
    campaigns, errors = await _try_generate_with_fallback(
        generator=generator,
        brand_analysis=brand_analysis,
        org_id=org_id,
        user_id=user_id,
        suggestions=suggestions[:request.count],
        count=request.count
    )

    if not campaigns:
        # Never hard-fail onboarding on transient LLM issues. Return deterministic previews.
        _safe_print(f"[BRAND] WARNING: Campaign preview generation failed; returning fallback. Errors: {'; '.join(errors) if errors else 'None'}")
        return _fallback_campaign_previews(
            brand_analysis=brand_analysis,
            suggestions=suggestions,
            count=request.count,
        )
    
    if len(campaigns) < request.count:
        _safe_print(f"[BRAND] WARNING: Only generated {len(campaigns)}/{request.count} campaigns. Errors: {'; '.join(errors) if errors else 'None'}")

    return CampaignPreviewResponse(campaigns=campaigns)


@router.post("/post-previews", response_model=PostPreviewResponse)
async def generate_post_previews(request: PostPreviewRequest):
    db = get_db()
    campaign_doc = await db.campaigns.find_one({"id": request.campaign_id}, {"_id": 0})
    if not campaign_doc:
        raise HTTPException(status_code=404, detail="Campaign not found")

    analysis_doc = await db.brand_analysis.find_one(
        {"org_id": request.org_id}, {"_id": 0}
    )
    if not analysis_doc:
        raise HTTPException(
            status_code=404, detail="Brand analysis not found for organization"
        )

    brand_analysis = BrandAnalysis(**analysis_doc)
    generator, _ = await _prepare_generator(org_id=request.org_id)

    if generator is None:
        fallback_posts = [
            f"Plan a LinkedIn post highlighting {pillar}"
            for pillar in brand_analysis.content_pillars[: request.count]
        ]
        return PostPreviewResponse(posts=fallback_posts[: request.count])

    campaign = Campaign(**campaign_doc)
    ideas = await generator.generate_post_ideas(
        campaign=campaign, brand_analysis=brand_analysis, count=request.count
    )

    if not ideas:
        ideas = [
            f"Share a targeted insight on {pillar}"
            for pillar in brand_analysis.content_pillars[: request.count]
        ]

    return PostPreviewResponse(posts=ideas[: request.count])


@router.post("/generate-post")
async def generate_post_with_campaign_generator(request: GeneratePostRequest):
    """
    Generate a single LinkedIn post using CampaignGenerator with 8-part viral format.
    This ensures all posts follow the Linked Coach templates and brand DNA.
    """
    db = get_db()
    
    # Get campaign
    campaign_doc = await db.campaigns.find_one({"id": request.campaign_id}, {"_id": 0})
    if not campaign_doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get brand analysis
    brand_analysis_doc = None
    if request.org_id:
        brand_analysis_doc = await db.brand_analysis.find_one({"org_id": request.org_id}, {"_id": 0})
    
    if not brand_analysis_doc and request.brand_context:
        # Use provided brand context (for onboarding)
        from ..models.organization_materials import BrandAnalysis
        # Convert brand_context dict to BrandAnalysis format
        brand_analysis_doc = {
            "org_id": request.org_id or "onboarding_temp",
            "brand_voice": request.brand_context.get("brand_voice", "professional"),
            "key_messages": request.brand_context.get("key_messages", []),
            "value_propositions": request.brand_context.get("value_propositions", []),
            "content_pillars": request.brand_context.get("content_pillars", []),
            "target_audience": request.brand_context.get("target_audience", {}),
            "brand_story": request.brand_context.get("brand_story", ""),
            "brand_personality": request.brand_context.get("brand_personality", []),
            "core_values": request.brand_context.get("core_values", []),
            "brand_tone": request.brand_context.get("brand_personality", []) or request.brand_context.get("brand_tone", [])
        }
        
        # Store topic from brand_context for use in post generation
        topic_from_context = request.brand_context.get("topic") or request.brand_context.get("enriched_topic")
        if topic_from_context:
            # Add topic to brand_analysis_doc as metadata
            brand_analysis_doc["_topic"] = topic_from_context
    
    if not brand_analysis_doc:
        raise HTTPException(status_code=404, detail="Brand analysis not found. Please complete brand discovery first.")
    
    brand_analysis = BrandAnalysis(**brand_analysis_doc)
    campaign = Campaign(**campaign_doc)
    
    # Prepare generator - use user_id from request if org_id is None (onboarding)
    generator, error = await _prepare_generator(
        org_id=request.org_id or campaign.org_id,
        user_id=request.user_id if not request.org_id else None
    )
    if not generator:
        raise HTTPException(status_code=500, detail=f"Failed to initialize generator: {error}. Please configure API keys in Settings.")
    
    # Extract topic from brand_context if provided (for onboarding)
    topic = None
    if request.brand_context:
        topic = request.brand_context.get("topic") or request.brand_context.get("enriched_topic")
        if isinstance(topic, str) and len(topic) > 0:
            # Extract just the topic part if it's enriched (remove brand context part)
            if "\n\nBrand Context:" in topic:
                topic = topic.split("\n\nBrand Context:")[0].strip()
    
    # Generate post with excluded types to avoid consecutive same style
    excluded_types = request.excluded_types or []
    post_ideas = await generator.generate_post_ideas(
        campaign=campaign,
        brand_analysis=brand_analysis,
        count=1,
        excluded_types=excluded_types,
        topic=topic
    )
    
    if not post_ideas or len(post_ideas) == 0:
        raise HTTPException(status_code=500, detail="Failed to generate post")
    
    # Determine post type used - use proper rotation based on excluded_types
    # This ensures each post in a batch gets a different type
    post_types = [
        "How to/The Secret to",
        "The Rant",
        "Polarisation",
        "Data Driven",
        "There Are 3 Things"
    ]
    available_types = [t for t in post_types if t not in excluded_types]
    if not available_types:
        available_types = post_types
    
    # Use index-based rotation: if excluded_types has N items, pick the Nth type from available
    # This ensures each call with different excluded_types gets a different type
    # Example: 
    # - excluded_types=[] -> rotation_index=0 -> first type
    # - excluded_types=["How to"] -> rotation_index=1 -> second type from available
    # - excluded_types=["How to", "Rant"] -> rotation_index=2 -> third type from available
    rotation_index = len(excluded_types) % len(available_types)
    selected_type = available_types[rotation_index]
    
    print(f"[POST GENERATION] Template rotation:")
    print(f"   Excluded types: {excluded_types}")
    print(f"   Available types ({len(available_types)}): {available_types}")
    print(f"   Rotation index: {rotation_index}")
    print(f"   Selected type: '{selected_type}'")
    
    return {
        "content": post_ideas[0],
        "post_type": selected_type,
        "generation_prompt": f"Generated using 8-part viral format with {selected_type} template",
        "content_pillar": campaign.content_pillars[0] if campaign.content_pillars else "General",
        "content_type": "text"
    }


