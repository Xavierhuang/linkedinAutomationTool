"""
AI-Powered Image Prompt Optimizer
Uses GPT-4 to dynamically analyze post content and create unique visual metaphors
No hardcoded metaphors - every image prompt is custom-tailored
"""

import httpx
from typing import Optional, List

async def generate_optimized_image_prompt(
    post_content: str,
    ai_api_key: str,
    ai_model: str = "gpt-4-o",
    brand_colors: Optional[List[str]] = None,
    brand_fonts: Optional[List[str]] = None,
    campaign_context: Optional[str] = None
) -> dict:
    """
    Use AI to analyze post and create a unique, optimized image prompt
    
    Args:
        post_content: The full LinkedIn post text
        ai_api_key: OpenAI API key for GPT-4
        ai_model: Model to use (default: gpt-4-o)
    
    Returns:
        dict with:
        - visual_concept: The AI's visual interpretation
        - metaphor_description: The metaphor explanation
        - optimized_prompt: The final DALL-E prompt
        - reasoning: Why this visual works
    """
    
    system_prompt = """You are an expert visual metaphor creator for LinkedIn content.

Your job:
1. Analyze the LinkedIn post content
2. Extract the core emotional message and key insight
3. Create a UNIQUE, CINEMATIC visual metaphor (NOT generic office/desk scenes)
4. Generate an optimized DALL-E prompt for hyper-realistic photography

RULES FOR VISUAL IMAGERY:
- STAY RELEVANT TO THE TOPIC FIRST - If the post is about soldiers, show soldiers; if about doctors, show medical imagery; if about teachers, show educational settings
- Only use abstract metaphors for GENERIC business concepts (growth, success, innovation)
- For SPECIFIC professions/topics: Use DIRECT, REALISTIC, RELEVANT imagery (actual people, real situations, authentic contexts)
- Avoid: Generic office scenes, stock photo clichés, people at desks with laptops, forced handshakes
- Think: Real-world scenarios, authentic moments, documentary-style captures, actual professionals in action
- Each image should be UNIQUE and TOPIC-APPROPRIATE - never generic
- Realism and relevance > Abstract symbolism

PHOTOGRAPHY REQUIREMENTS:
- Hyper-realistic, photojournalistic style
- Shot on professional DSLR (35mm, f/1.8)
- Cinematic lighting and composition
- Shallow depth of field
- Ample negative space for text overlay
- Rule of thirds or golden ratio
- ALWAYS include bold, readable text overlay with a key message or quote from the post
- Text should be prominently displayed, well-positioned, and easy to read
- Use modern, professional typography that matches the image style

OUTPUT FORMAT (JSON):
{
  "visual_concept": "One sentence describing the visual metaphor",
  "metaphor_description": "Why this visual represents the post's message",
  "subject": "Main subject of the photo",
  "environment": "Setting/background",
  "focal_point": "Key element that draws the eye",
  "lighting": "Lighting style and mood",
  "color_palette": "Primary colors and tones",
  "composition": "Framing and perspective",
  "emotional_tone": "The feeling this image evokes",
  "key_message": "A short, impactful quote or key phrase (5-10 words) from the post to display as text overlay",
  "reasoning": "Why this specific visual works for this post"
}"""

    # Build brand context string
    brand_context = ""
    if brand_colors:
        brand_context += f"\nBRAND COLORS: {', '.join(brand_colors[:5])} - Incorporate these colors naturally into the image palette where appropriate."
    if brand_fonts:
        brand_context += f"\nBRAND TYPOGRAPHY STYLE: {', '.join(brand_fonts[:3])} - Match the visual aesthetic of these font styles (modern, classic, bold, etc.)"
    if campaign_context:
        brand_context += f"\nCAMPAIGN CONTEXT: {campaign_context} - Ensure the visual aligns with this campaign's messaging and tone."
    
    user_prompt = f"""Analyze this LinkedIn post and create the perfect visual:

POST CONTENT:
{post_content}
{brand_context}

CRITICAL: Stay ON-TOPIC and RELEVANT!
- If this post mentions specific professions (soldiers, doctors, teachers, etc.) -> Show THAT profession in action
- If it's about specific industries (construction, healthcare, military) -> Show THAT industry realistically
- If it's generic business concepts (growth, teamwork, success) -> Then you can use creative metaphors
- If brand colors are provided, incorporate them naturally into the scene (clothing, lighting, environment)
- Ensure visual variety - each image should be UNIQUE and different from previous generations

Create hyper-realistic imagery that is:
1. DIRECTLY RELEVANT to the post's topic
2. PHOTOGRAPHIC and documentary-style (NOT abstract or symbolic unless the topic is abstract)
3. Shows REAL people, REAL situations, AUTHENTIC contexts
4. Makes someone STOP scrolling because it's compelling and ON-POINT
5. Incorporates brand colors naturally if provided (don't force them, but use them where they fit organically)

Respond ONLY with valid JSON matching the format specified."""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {ai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": ai_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.5,  # Balanced - lower for more consistent, realistic interpretations
                    "response_format": {"type": "json_object"}
                }
            )
            
            if response.status_code != 200:
                raise Exception(f"OpenAI API error: {response.status_code} - {response.text}")
            
            result = response.json()
            ai_analysis = result['choices'][0]['message']['content']
            
            # Parse the AI's JSON response
            import json
            analysis = json.loads(ai_analysis)
            
            # Build optimized Gemini 3 Pro Image Preview prompt - include text for LinkedIn posts
            # Use key_message from AI analysis if available, otherwise extract from post
            key_message = analysis.get('key_message', '')
            if not key_message:
                post_summary = post_content[:150].replace('\n', ' ').strip()
                # Get a short, impactful quote or key phrase (first sentence or up to 10 words)
                key_message = post_summary.split('.')[0][:80] if '.' in post_summary else ' '.join(post_summary.split(' ')[:10])
            
            optimized_prompt = f"""A professional LinkedIn post image featuring {analysis['subject']} in {analysis['environment']}, {analysis['focal_point']} as focal point. {analysis['lighting']}, {analysis['color_palette']}. {analysis['composition']}. Shot on DSLR, 35mm f/1.8, shallow depth of field. Photojournalistic style, National Geographic quality, hyper-realistic, 4K, natural lighting, authentic candid moment. Include bold, readable text overlay with the key message: "{key_message}". Text should be prominently displayed, well-positioned, and easy to read on the image."""
            
            analysis['optimized_prompt'] = optimized_prompt.replace('\n', ' ').strip()
            
            return analysis
            
    except Exception as e:
        print(f"[ERROR] AI prompt optimization failed: {e}")
        # Fallback to a simple generic prompt
        return {
            "visual_concept": "Abstract visual representation",
            "metaphor_description": "Visual metaphor for the post content",
            "optimized_prompt": f"""PROFESSIONAL PHOTOGRAPH - PHOTOREALISTIC ONLY. 
Shot on DSLR, 35mm lens, f/1.8. A cinematic photograph representing the concept from this post: "{post_content[:100]}...". 
Natural setting, dramatic lighting, shallow depth of field, professional composition. 
Photojournalism style, National Geographic quality.""".replace('\n', ' ').strip(),
            "reasoning": "Fallback generic prompt due to AI analysis error"
        }
