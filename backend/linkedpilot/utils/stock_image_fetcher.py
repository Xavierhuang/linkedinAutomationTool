"""
Stock Image Fetcher - Fetch high-quality free stock images from Unsplash and Pexels
"""
import httpx
import os
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


class StockImageFetcher:
    def __init__(self, unsplash_key: Optional[str] = None, pexels_key: Optional[str] = None):
        # Use provided keys or fall back to environment variables
        self.unsplash_access_key = unsplash_key or os.getenv("UNSPLASH_ACCESS_KEY", "")
        self.pexels_api_key = pexels_key or os.getenv("PEXELS_API_KEY", "")
        
    async def fetch_image(self, query: str, orientation: str = "landscape"):
        if self.unsplash_access_key:
            result = await self._fetch_from_unsplash(query, orientation)
            if result:
                return result
        if self.pexels_api_key:
            result = await self._fetch_from_pexels(query, orientation)
            if result:
                return result
        return None
    
    async def _fetch_from_unsplash(self, query: str, orientation: str):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.unsplash.com/search/photos",
                    params={"query": query, "orientation": orientation, "per_page": 1},
                    headers={"Authorization": f"Client-ID {self.unsplash_access_key}"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("results") and len(data["results"]) > 0:
                        photo = data["results"][0]
                        photographer_name = photo["user"]["name"]
                        photographer_url = photo["user"]["links"]["html"]
                        return {
                            "url": photo["urls"]["regular"],
                            "photographer": photographer_name,
                            "photographer_url": photographer_url,
                            "attribution": f"Photo by {photographer_name} on Unsplash",
                            "source": "Unsplash"
                        }
        except Exception as e:
            logger.error(f"Error fetching from Unsplash: {e}")
        return None
    
    async def _fetch_from_pexels(self, query: str, orientation: str):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.pexels.com/v1/search",
                    params={"query": query, "orientation": orientation, "per_page": 1},
                    headers={"Authorization": self.pexels_api_key},
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("photos") and len(data["photos"]) > 0:
                        photo = data["photos"][0]
                        photographer_name = photo["photographer"]
                        photographer_url = photo["photographer_url"]
                        return {
                            "url": photo["src"]["large"],
                            "photographer": photographer_name,
                            "photographer_url": photographer_url,
                            "attribution": f"Photo by {photographer_name} on Pexels",
                            "source": "Pexels"
                        }
        except Exception as e:
            logger.error(f"Error fetching from Pexels: {e}")
        return None


async def extract_image_keywords_ai(post_content: str, topic: str, openai_key: str = None) -> str:
    """
    Use AI (GPT) to generate visual search keywords for stock images.
    Analyzes topic and post content to create concrete, visual scene descriptions.
    """
    import os
    import httpx
    
    # Fallback to environment variable if no key provided
    if not openai_key:
        openai_key = os.getenv('OPENAI_API_KEY')
    
    if not openai_key:
        # Fallback to simple extraction if no AI key
        return extract_image_keywords_simple(post_content, topic)
    
    try:
        # Use AI to generate visual search query
        system_prompt = """You are a professional stock image search query generator. Your job is to create HIGHLY SPECIFIC, DOMAIN-AWARE visual search queries for stock photo sites.

**PROCESS:**
1. Read the TOPIC - identify the industry/domain (music, tech, health, business, sports, education, etc.)
2. Read the POST CONTENT - understand the specific context, mood, and angle
3. Generate a search query using DOMAIN-SPECIFIC terminology

**CRITICAL RULES:**

**DOMAIN-SPECIFIC NOUNS** (Be precise about WHO is in the photo):
- Music/Entertainment -> "musician", "singer", "recording artist", "performer", "DJ", "band member", "conductor"
- Tech/Software -> "software developer", "programmer", "coder", "tech entrepreneur", "engineer", "data scientist"
- Healthcare -> "doctor", "nurse", "physician", "surgeon", "medical professional", "healthcare worker", "patient"
- Business/Corporate -> "executive", "entrepreneur", "business professional", "manager", "CEO", "consultant"
- Sports/Fitness -> "athlete", "trainer", "coach", "player", "competitor", "fitness professional"
- Education -> "teacher", "professor", "student", "educator", "instructor"
- Creative Arts -> "designer", "photographer", "videographer", "painter", "sculptor" (NOT "artist" alone)

**AVOID GENERIC TERMS:**
❌ "artist" (ambiguous - painter? musician? performer?)
❌ "person" (no context)
❌ "people" (too vague)
❌ "professional" alone (what profession?)
❌ "worker" (what kind of work?)

**INCLUDE VISUAL SPECIFICS:**
- Key objects: "microphone", "Grammy trophy", "laptop", "code", "stethoscope", "whiteboard", "guitar"
- Settings: "recording studio", "stage", "office", "hospital", "gym", "classroom", "workspace"
- Actions: "performing", "coding", "presenting", "examining", "celebrating", "training"
- Mood: "celebrating", "focused", "collaborating", "innovating", "struggling", "succeeding"

**Examples showing domain awareness:**
- Topic: "Grammy Awards" -> "singer holding Grammy trophy stage" OR "musician celebrating music award backstage"
- Topic: "Album Recording" -> "recording artist singing microphone studio" OR "band recording session headphones"
- Topic: "MVP Development" -> "programmer coding laptop startup office" OR "software developer testing prototype screen"
- Topic: "Medical Research" -> "doctor analyzing medical research data" OR "physician examining lab results"
- Topic: "Marathon Training" -> "athlete running intense training" OR "runner marathon preparation outdoors"
- Topic: "Corporate Leadership" -> "executive presenting business strategy team" OR "CEO leading corporate meeting"

Output format: Just the 4-6 word search query, nothing else."""

        user_prompt = f"""Topic: {topic}
Post Content: {post_content[:300]}

Generate visual stock image search query:"""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                'https://api.openai.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {openai_key}'},
                json={
                    'model': 'gpt-4o-mini',  # Fast and cheap
                    'messages': [
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': user_prompt}
                    ],
                    'temperature': 0.5,  # More creative
                    'max_tokens': 30  # Allow longer, more descriptive queries
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                result = response.json()
                keywords = result['choices'][0]['message']['content'].strip()
                return keywords[:50]  # Limit length
    
    except Exception as e:
        logger.error(f"AI keyword extraction failed: {e}")
    
    # Fallback to simple extraction
    return extract_image_keywords_simple(post_content, topic)


def extract_image_keywords_simple(post_content: str, topic: str) -> str:
    """
    Fallback: Simple keyword extraction without AI.
    """
    import re
    
    # Analyze topic separately to understand the domain/subject
    topic_lower = topic.lower()
    
    # Analyze post content for context and details
    post_text = post_content[:500].lower()
    
    # Combine for full analysis
    full_text = f"{topic_lower} {post_text}"
    
    # Remove marketing fluff and non-visual words
    remove_words = [
        "did you know", "are you", "do you", "can you", "have you",
        "secret", "secrets", "guide", "learn", "today", "amazing", 
        "discover", "tips", "tricks", "hacks", "ultimate", "best"
    ]
    for word in remove_words:
        full_text = re.sub(rf'\b{word}\b', ' ', full_text, flags=re.IGNORECASE)
    
    # Remove percentages, stats, emojis
    full_text = re.sub(r'\d+%|\d+ percent', '', full_text)
    full_text = re.sub(r'[📸🎯✨💡🐾🎶🚀💪🔥⚡️✅❤️👍🙌🎉🌟💼📊📈😮🤔]+', '', full_text)
    full_text = re.sub(r'[^\w\s]', ' ', full_text)
    
    # Extract all meaningful words (nouns, verbs, adjectives)
    words = full_text.split()
    # Remove short words and common stop words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
                  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
                  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
                  'that', 'this', 'these', 'those', 'it', 'its', 'your', 'their', 'our'}
    
    meaningful_words = [w for w in words if len(w) > 3 and w not in stop_words]
    
    # First, extract keywords from TOPIC to understand the domain
    topic_words = [w for w in topic_lower.split() if len(w) > 3 and w not in stop_words]
    
    # Identify key visual action/subject words
    action_words = []
    subject_words = []
    
    # Common action keywords that are visual
    actions = ['coding', 'developing', 'development', 'building', 'build', 'working', 'meeting', 
               'planning', 'designing', 'design', 'writing', 'creating', 'programming', 
               'exercising', 'running', 'consulting', 'examining', 'treating', 'helping', 
               'teaching', 'presenting', 'startup', 'entrepreneur']
    
    # Common subject keywords
    subjects = ['developer', 'person', 'team', 'doctor', 'patient', 'entrepreneur',
                'professional', 'worker', 'employee', 'manager', 'student', 'teacher',
                'programmer', 'designer', 'engineer', 'analyst', 'coder']
    
    # Check TOPIC first for domain keywords (highest priority)
    for word in topic_words:
        if any(action in word for action in actions):
            action_words.append(word)
        if any(subject in word for subject in subjects):
            subject_words.append(word)
    
    # Then check post content for additional context
    for word in meaningful_words[:15]:
        if any(action in word for action in actions) and word not in action_words:
            action_words.append(word)
        if any(subject in word for subject in subjects) and word not in subject_words:
            subject_words.append(word)
    
    # Detect context (positive vs negative/problem-focused)
    negative_indicators = ['issue', 'issues', 'problem', 'problems', 'suffer', 'suffering',
                          'pain', 'struggle', 'struggling', 'fail', 'failing', 'challenge',
                          'challenges', 'concern', 'concerned', 'worried', 'stress', 'stressed',
                          'difficult', 'difficulty', 'crisis', 'chronic', 'disease', 'illness']
    
    positive_indicators = ['solution', 'solve', 'success', 'successful', 'achieve', 'growth',
                          'improve', 'improving', 'better', 'wellness', 'healthy', 'tips',
                          'boost', 'optimize', 'enhance']
    
    has_negative_context = any(indicator in full_text for indicator in negative_indicators)
    has_positive_context = any(indicator in full_text for indicator in positive_indicators)
    
    # Build natural descriptive search query from extracted keywords
    # Take top 2-3 most meaningful words and combine them naturally
    
    # Prioritize: topic keywords + action words + subject words + other meaningful words
    query_parts = []
    
    # Add topic keywords (highest priority - what user actually wants)
    query_parts.extend(topic_words[:2])
    
    # Add action/subject words if found
    if subject_words:
        query_parts.append(subject_words[0])
    if action_words:
        query_parts.append(action_words[0])
    
    # Add other meaningful nouns/verbs if we don't have enough
    if len(query_parts) < 3:
        for word in meaningful_words[:8]:
            if word not in query_parts and len(word) > 4:
                query_parts.append(word)
                if len(query_parts) >= 3:
                    break
    
    # Build final query from parts (limit to 3-4 words for best results)
    if query_parts:
        query = " ".join(query_parts[:3])
    else:
        query = topic.strip() if topic.strip() else "professional working"
    
    # Add context modifier if appropriate
    if has_negative_context and not has_positive_context:
        # For problem-focused posts, add context words
        if 'health' in query or 'medical' in query or 'doctor' in query or 'patient' in query:
            query = query + " consultation"
        elif 'work' in query or 'business' in query or 'team' in query:
            query = query + " problem solving"
        else:
            query = query + " concerned"
    elif has_positive_context:
        # For solution-focused posts, keep upbeat
        if 'health' in query:
            query = query + " active"
        elif 'work' in query or 'business' in query:
            query = query + " successful"
    
    # Clean and limit length
    query = " ".join(query.split())
    return query[:50]

  
