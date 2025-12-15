import os
from typing import Optional, Dict, List
from openai import AsyncOpenAI

from linkedpilot.utils.linkedin_templates import (
    pick_linkedin_template,
    build_template_prompt,
    pick_image_style,
    build_image_caption_brief
)

class LLMAdapter:
    """
    Adapter for LLM operations using OpenAI or Google AI Studio
    Supports: OpenAI, Google AI Studio (Gemini)
    """
    
    def __init__(self, api_key: Optional[str] = None, provider: str = "openai", model: Optional[str] = None):
        # Use provided API key or fall back to environment variable
        self.provider = provider
        
        # Multi-provider support
        if provider == "google_ai_studio":
            self.api_key = api_key or os.getenv('GOOGLE_AI_API_KEY')
            self.base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
            # Default to Gemini 2.5 Pro for advanced capabilities
            self.model = model or 'gemini-2.5-pro'  # Gemini 2.5 Pro for expert-grade designs
        else:  # openai (default)
            self.api_key = api_key or os.getenv('OPENAI_API_KEY')
            self.base_url = "https://api.openai.com/v1"
            self.model = model or 'gpt-4o'
        
        # Always use mock mode if no API key
        self.mock_mode = not self.api_key or os.getenv('MOCK_LLM', 'false').lower() == 'true'
        
        # Initialize OpenAI client (works for OpenAI-compatible APIs)
        self.client = None
        if self.api_key:
            extra_headers = {}
            
            self.client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
                default_headers=extra_headers
            )
    
    async def generate_campaign_ideas(self, org_summary: Dict, goal: str) -> List[Dict]:
        """Generate campaign ideas based on organization context"""
        # Always use mock mode for now (can add OpenAI integration later)
        return self._mock_campaign_ideas(goal)
        
    async def generate_post_content(self, context: Dict, mode: str) -> Dict:
        """Generate LinkedIn post content"""
        print(f"[LLM] LLMAdapter.generate_post_content called:")
        print(f"   - API key present: {bool(self.api_key)}")
        print(f"   - Mock mode: {self.mock_mode}")
        print(f"   - Context: {context}")
        
        if self.mock_mode or not self.api_key:
            error_msg = "No OpenAI API key configured. Please add your API key in Settings."
            print(f"[ERROR] {error_msg}")
            raise Exception(error_msg)
        
        try:
            # Build the prompt based on context
            topic = context.get('topic') or context.get('message', 'business growth')
            tone = context.get('tone', 'professional')
            org_id = context.get('org_id', '')
            
            # Use the topic directly without forcing current trends
            print(f"[SUCCESS] Using REAL AI mode!")
            print(f"   - Topic: {topic}")
            print(f"   - Tone: {tone}")
            print(f"   - Model: {self.model}")
            
            # Template + visual rotation to avoid same-sounding posts
            template = pick_linkedin_template(org_id, topic)
            image_style = pick_image_style(org_id, template['id'])
            template_prompt = build_template_prompt(template, tone)
            image_caption_brief = build_image_caption_brief(topic, template, image_style)
            
            print(f"   - Template: {template['label']} ({template['id']})")
            print(f"   - Image style: {image_style['label']} ({image_style['ratio']})")
            
            # Structured prompt with few-shot examples and clear formatting
            prompt = f"""You are an expert LinkedIn content strategist with deep expertise in creating high-engagement posts that drive meaningful conversations and audience growth.

TASK: Create a compelling, professional LinkedIn post about: "{topic}"

IMPORTANT: Stay fully focused on the exact topic. Do NOT default to general themes (AI, tech, productivity, remote work, etc.) unless they're directly part of the topic.

TEMPLATE & STYLE ROTATION
Use this template verbatim, adapting it to the topic:
{template_prompt}

TONE:
Professional, conversational, and authentic — written like a real person with genuine insight, not like marketing copy.

STRUCTURE REQUIREMENTS (updated for readability):

Hook (1–2 short lines):
Start with a bold statement, question, or surprising fact that instantly grabs attention.
Keep it tight — 1–2 lines max.

Core Content (4–6 short sections):

Use short sentences and frequent line breaks — aim for 1–3 lines per paragraph.

Mix in questions, dashes, or ellipses to create rhythm and natural flow.

Share specific examples, data, or insights (not generic advice).

Use occasional emojis (2–3 max) to guide the reader's eye, not decorate.

Vary paragraph length — make the post look easy to read at first glance.

Call-to-Action (CTA):
End with a conversation prompt, not a sales pitch.
Example: "What's your take?" / "How are you approaching this?" / "Would you try this?"

IMAGE CAPTION + VISUAL DIRECTION:
LinkedIn rewards posts where the caption reinforces the supporting creative. After the CTA, add ONE line that starts with
Image caption: <18 word description>
Describe the scene that should match this visual plan: {image_caption_brief}
Image style target: {image_style['label']} ({image_style['ratio']}, {image_style['orientation']}) — {image_style['description']}
This caption must appear BEFORE the hashtags.

Hashtags (REQUIRED):
Include exactly 5 relevant hashtags at the very end of the post, after the image caption line.
- Mix trending hashtags with niche-specific ones
- Make them relevant to the topic and industry
- Use proper LinkedIn hashtag format (e.g., #Leadership #BusinessGrowth #StartupTips)

Formatting Rules:

Keep total length under 260 words.

Use line breaks between every paragraph.

Avoid dense blocks of text — it should look like it breathes on screen.

If you use lists, use the "→" arrow style or emojis for flow.

Output Format:
Write the complete post with all content, then add 5 hashtags at the end on a new line.
Example:
[Your post content here with paragraphs separated by line breaks]

What's your take?

Image caption: describe the recommended visual in <= 18 words.

#HashtagOne #HashtagTwo #HashtagThree #HashtagFour #HashtagFive"""

            print("[API] Calling OpenAI-compatible API with optimized parameters...")
            # Build request kwargs with provider-specific compatibility
            create_kwargs = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert LinkedIn content strategist and copywriter. You create high-performing posts that combine authentic storytelling with strategic engagement tactics. CRITICAL: You stay laser-focused on the exact topic provided by the user. You do NOT default to tech, AI, remote work, or startup themes unless explicitly mentioned. You adapt your content to match ANY industry, profession, or subject matter the user specifies."
                    },
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.8,
                "max_tokens": 1000,
            }

            # Google OpenAI-compat shim does not support presence/frequency penalties
            if self.provider not in ("google_ai_studio",):
                create_kwargs.update({
                    "presence_penalty": 0.1,
                    "frequency_penalty": 0.1,
                })

            response = await self.client.chat.completions.create(**create_kwargs)
            
            content = response.choices[0].message.content
            print(f"[SUCCESS] OpenAI API success! Generated {len(content)} characters")
            result = self._parse_post_response(content)
            result['generation_prompt'] = prompt  # Include the prompt for logging
            result.setdefault('image_caption', image_caption_brief)
            result['template_id'] = template['id']
            result['template_label'] = template['label']
            result['image_style'] = image_style
            result['image_caption_brief'] = image_caption_brief
            return result
            
        except Exception as e:
            print(f"[ERROR] Error generating post content: {e}")
            import traceback
            traceback.print_exc()
            raise  # Re-raise the exception instead of falling back to mock
    
    async def generate_carousel_content(self, context: Dict) -> Dict:
        """Generate multi-slide carousel content
        
        Args:
            context: Dict with 'topic', 'tone', 'num_slides' (default 5)
            
        Returns:
            Dict with 'slides' array and 'caption'
        """
        print(f"\n[CAROUSEL] LLMAdapter.generate_carousel_content called:")
        print(f"   - Context: {context}")
        
        if self.mock_mode or not self.api_key:
            return {
                "caption": "Check out these insights! [API]",
                "slides": [
                    {"title": f"Slide {i+1}", "content": f"Key point {i+1}"} 
                    for i in range(context.get('num_slides', 5))
                ],
                "hashtags": ["#Carousel", "#LinkedIn", "#Content"]
            }
        
        try:
            topic = context.get('topic', 'business growth')
            tone = context.get('tone', 'professional')
            num_slides = context.get('num_slides', 5)
            
            prompt = f"""Create a {num_slides}-slide LinkedIn carousel about "{topic}" with a {tone} tone.
            
Return ONLY valid JSON (no markdown, no extra text) in this exact format:
{{
  "caption": "Main post caption (2-3 sentences)",
  "slides": [
    {{"title": "Slide 1 Title", "content": "Slide 1 key point or insight"}},
    {{"title": "Slide 2 Title", "content": "Slide 2 key point or insight"}}
  ],
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}}

Each slide should:
- Have a catchy title (3-5 words)
- Contain ONE key insight or tip (1-2 sentences)
- Be visually distinct

Make it engaging and actionable!"""

            print("[API] Calling OpenAI API for carousel...")
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at creating engaging LinkedIn carousel content. Return ONLY valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content
            print(f"[SUCCESS] Carousel content generated!")
            return self._parse_carousel_response(content)
            
        except Exception as e:
            print(f"[ERROR] Error generating carousel: {e}")
            # Fallback to mock
            return {
                "caption": f"Insights on {context.get('topic', 'business')} [API]",
                "slides": [
                    {"title": f"Slide {i+1}", "content": f"Key insight {i+1}"} 
                    for i in range(context.get('num_slides', 5))
                ],
                "hashtags": ["#Carousel", "#LinkedIn"]
            }
    
    async def edit_post_with_chat(self, current_content: str, edit_instruction: str, history: List[Dict]) -> str:
        """Edit post content based on chat instruction"""
        # Always use mock mode for now (can add OpenAI integration later)
        return f"{current_content} [Edited: {edit_instruction}]"
    
    async def generate_reply_suggestion(self, comment: str, post_context: str) -> str:
        """Generate AI reply suggestion for a comment"""
        # Always use mock mode for now (can add OpenAI integration later)
        return "Thanks for your comment! We appreciate your engagement."
    
    def _mock_campaign_ideas(self, goal: str) -> List[Dict]:
        return [
            {
                "title": f"Campaign 1 - {goal.capitalize()}",
                "description": "Mock campaign description",
                "post_ideas": [
                    {"format": "text", "message": "Post idea 1", "cta": "Learn more"},
                    {"format": "image", "message": "Post idea 2", "cta": "Get started"},
                    {"format": "carousel", "message": "Post idea 3", "cta": "Download guide"}
                ]
            }
        ]
    
    def _mock_post_content(self, mode: str) -> Dict:
        return {
            "body": f"This is a mock {mode} post. Great content coming soon! [API]",
            "hashtags": ["#MockPost", "#LinkedInMarketing", "#ContentStrategy"],
            "cta": "Learn more in comments"
        }
    
    def _parse_campaign_response(self, response: str) -> List[Dict]:
        # Simple parsing - in production, use better JSON extraction
        try:
            import json
            return json.loads(response)
        except:
            # Fallback to mock if parsing fails
            return self._mock_campaign_ideas("awareness")
    
    def _parse_carousel_response(self, response: str) -> Dict:
        """Parse carousel content response"""
        import json
        import re
        
        try:
            # Try to extract JSON from markdown code blocks if present
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                json_str = response
            
            carousel_data = json.loads(json_str)
            return carousel_data
        except:
            # Fallback to mock
            return {
                "caption": "Insights on business growth [API]",
                "slides": [
                    {"title": f"Slide {i+1}", "content": f"Key point {i+1}"} 
                    for i in range(5)
                ],
                "hashtags": ["#Carousel", "#LinkedIn"]
            }
    
    def _parse_post_response(self, response: str) -> Dict:
        """Parse post response - expects prose text with hashtags at the end"""
        import re
        
        try:
            # Clean up response (remove any markdown code blocks if present)
            text = response.strip()
            if text.startswith('```'):
                # Remove markdown code blocks
                text = re.sub(r'```(?:json|text)?\s*', '', text)
                text = re.sub(r'```\s*$', '', text)
            
            # Try to extract JSON if LLM still outputs JSON (backward compatibility)
            json_match = re.search(r'\{[^{}]*"body"[^{}]*\}', text, re.DOTALL)
            if json_match:
                try:
                    import json
                    parsed = json.loads(json_match.group(0))
                    body = parsed.get("body", "")
                    hashtags = parsed.get("hashtags", [])
                    # Combine body and hashtags if hashtags are separate
                    if hashtags:
                        body_with_hashtags = f"{body}\n\n{' '.join(hashtags)}"
                    else:
                        body_with_hashtags = body
                    return {
                        "body": body_with_hashtags,
                        "hashtags": hashtags if isinstance(hashtags, list) else [],
                        "cta": parsed.get("cta", "")
                    }
                except:
                    pass
            
            # Parse prose format: extract hashtags from the end
            # Look for hashtags at the end (usually last line with # symbols)
            lines = text.split('\n')
            image_caption = ""
            image_caption_line_idx = None
            normalized_lines = []
            for idx, line in enumerate(lines):
                if image_caption_line_idx is None and line.strip().lower().startswith("image caption:"):
                    image_caption = line.split(":", 1)[1].strip()
                    image_caption_line_idx = idx
                else:
                    normalized_lines.append(line)
            lines = normalized_lines
            hashtags = []
            hashtag_line_indices = []
            
            # Find hashtags at the end (last 1-2 lines)
            for i in range(len(lines) - 1, max(-1, len(lines) - 3), -1):
                line = lines[i].strip()
                if line and '#' in line:
                    # Extract all hashtags from this line
                    found_hashtags = re.findall(r'#\w+', line)
                    if found_hashtags:
                        hashtags.extend(found_hashtags)
                        hashtag_line_indices.append(i)
            
            # Reverse hashtags to maintain order
            hashtags = list(reversed(hashtags)) if hashtags else []
            
            # Ensure we have at least 5 hashtags - if we have fewer, the AI might not have included them
            # or they might be embedded in the text. Let's check if we need to extract more.
            if len(hashtags) < 5:
                # Try to find hashtags anywhere in the text (not just at the end)
                all_hashtags = re.findall(r'#\w+', text)
                if all_hashtags and len(all_hashtags) >= 5:
                    # Take the last 5 hashtags found
                    hashtags = all_hashtags[-5:]
                elif len(hashtags) == 0:
                    # No hashtags found at all - this shouldn't happen with the updated prompt
                    # but we'll add defaults as fallback
                    hashtags = ["#LinkedIn", "#Business", "#Professional", "#Growth", "#Success"]
            
            # Extract CTA from text before removing hashtags
            # Look for question mark in last few paragraphs
            cta_match = re.search(r'([^.!?\n]+\?[^.!?\n]*)', text, re.MULTILINE)
            cta = cta_match.group(1).strip() if cta_match else ""
            
            # If we found hashtags, ensure we have exactly 5 and format properly
            if hashtags:
                # Remove hashtag lines from body text
                body_lines = [line for i, line in enumerate(lines) if i not in hashtag_line_indices]
                text = '\n'.join(body_lines).strip()
                
                # Ensure we have exactly 5 hashtags
                hashtags_to_use = hashtags[:5] if len(hashtags) >= 5 else hashtags
                # If we have fewer than 5, pad with defaults (but prefer AI-generated ones)
                if len(hashtags_to_use) < 5:
                    defaults = ["#LinkedIn", "#Business", "#Professional", "#Growth", "#Success"]
                    # Only add defaults that aren't already in hashtags_to_use
                    for default in defaults:
                        if len(hashtags_to_use) >= 5:
                            break
                        if default.lower() not in [h.lower() for h in hashtags_to_use]:
                            hashtags_to_use.append(default)
                
                body_text = text
                if image_caption:
                    body_text = f"{body_text}\n\nImage caption: {image_caption}"
                body_text = f"{body_text}\n\n{' '.join(hashtags_to_use)}"
                hashtags = hashtags_to_use
            else:
                # No hashtags found, use text as-is and add exactly 5 default hashtags
                body_text = text
                if image_caption:
                    body_text = f"{body_text}\n\nImage caption: {image_caption}"
                hashtags = ["#LinkedIn", "#Business", "#Professional", "#Growth", "#Success"]
                body_text = f"{body_text}\n\n{' '.join(hashtags)}"
            
            return {
                "body": body_text,
                "hashtags": hashtags,
                "cta": cta,
                "image_caption": image_caption
            }
            
        except Exception as e:
            print(f"Error parsing post response: {e}")
            # Fallback: return text as-is with default hashtags (5 total)
            hashtags = ["#LinkedIn", "#Business", "#Professional", "#Growth", "#Success"]
            return {
                "body": f"{response.strip()}\n\n{' '.join(hashtags)}",
                "hashtags": hashtags,
                "cta": "What's your take?",
                "image_caption": ""
            }
    
    async def generate_completion(self, prompt: str, temperature: float = 0.7) -> str:
        """Generate a completion from the LLM"""
        if self.mock_mode or not self.api_key:
            return "Mock LLM response"
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful AI assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=4000
            )
            
            content = response.choices[0].message.content
            return content if content else ""
            
        except Exception as e:
            print(f"[ERROR] LLM completion error: {e}")
            raise
    
    async def llm_complete(self, prompt: str, temperature: float = 0.7) -> str:
        """Alias for generate_completion for backward compatibility"""
        return await self.generate_completion(prompt, temperature)
    
    async def generate_completion_with_image(self, prompt: str, image_base64: str, temperature: float = 0.7) -> str:
        """Generate completion with image input using Gemini vision API"""
        if self.mock_mode or not self.api_key:
            return "Mock image analysis: This image shows professional branding elements."
        
        try:
            # For Gemini, use the vision API format
            if self.provider == "google_ai_studio":
                import httpx
                
                # Gemini vision API endpoint - use gemini-1.5-pro for vision
                model_name = self.model if self.model else "gemini-1.5-pro"
                # Ensure model name doesn't have provider prefix
                if "/" in model_name:
                    model_name = model_name.split("/")[-1]
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
                
                payload = {
                    "contents": [{
                        "parts": [
                            {
                                "text": prompt
                            },
                            {
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": image_base64
                                }
                            }
                        ]
                    }],
                    "generationConfig": {
                        "temperature": temperature,
                        "maxOutputTokens": 4000
                    }
                }
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        url,
                        json=payload,
                        headers={"x-goog-api-key": self.api_key}
                    )
                    response.raise_for_status()
                    result = response.json()
                    
                    if 'candidates' in result and len(result['candidates']) > 0:
                        content = result['candidates'][0]['content']['parts'][0]['text']
                        return content
                    else:
                        raise Exception("No content in Gemini response")
            
            # Fallback to OpenAI-compatible vision API
            else:
                return await self.generate_with_image(prompt, image_base64, "image/jpeg")
                
        except Exception as e:
            print(f"[ERROR] Vision completion error: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    async def generate_with_image(self, prompt: str, image_base64: str, mime_type: str) -> str:
        """Generate completion with image input (vision model) - OpenAI compatible"""
        if self.mock_mode or not self.api_key:
            return "Mock image analysis: This image shows professional branding elements."
        
        try:
            # Use vision-capable model
            vision_model = "gpt-4o" if self.provider == "openai" else "gemini-2.5-pro"
            
            response = await self.client.chat.completions.create(
                model=vision_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                temperature=0.7,
                max_tokens=1500
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"[ERROR] Vision model error: {e}")
            # Fallback to basic description
            return "Image uploaded successfully. Contains visual branding elements."
    
    async def generate_post_with_canva(self, context: Dict, canva_adapter) -> Dict:
        """
        Generate LinkedIn post WITH Canva template recommendation using OpenAI function calling
        
        Args:
            context: Dict with topic, tone, style preferences
            canva_adapter: CanvaAdapter instance for making Canva API calls
            
        Returns:
            Dict with post content AND canva_template_id
        """
        print(f"\n[IMAGE] LLMAdapter.generate_post_with_canva called:")
        print(f"   - Context: {context}")
        
        if self.mock_mode or not self.api_key:
            error_msg = "No OpenAI API key configured. Please add your API key in Settings."
            print(f"[ERROR] {error_msg}")
            raise Exception(error_msg)
        
        try:
            topic = context.get('topic') or context.get('message', 'business growth')
            tone = context.get('tone', 'professional')
            visual_style = context.get('visual_style', 'modern professional')
            
            # Define Canva function for OpenAI
            canva_function = {
                "type": "function",
                "function": {
                    "name": "search_canva_templates",
                    "description": "Search for Canva templates that match the post topic and visual style. Returns template IDs that can be used to create professional graphics.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query for templates (e.g., 'professional LinkedIn', 'business modern', 'tech innovation')"
                            },
                            "category": {
                                "type": "string",
                                "enum": ["social-media", "business", "marketing"],
                                "description": "Template category"
                            }
                        },
                        "required": ["query", "category"]
                    }
                }
            }
            
            prompt = f"""Create a LinkedIn post about "{topic}" with a {tone} tone.
Also recommend a Canva template style that would visually complement this post.

Post Requirements:
- Engaging opening hook
- 3-5 key points or insights  
- Call to action
- Include 3-5 relevant hashtags
- Keep it under 300 words

Visual Style: {visual_style}

Please search for an appropriate Canva template and include it in your response.
Format as JSON:
{{
    "body": "post text",
    "hashtags": ["#tag1", "#tag2"],
    "cta": "call to action",
    "template_query": "search query for Canva template"
}}"""
            
            print("[API] Calling OpenAI API with function calling...")
            
            # First call - AI will decide if it needs to search templates
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert LinkedIn content creator AND designer. You create engaging posts and recommend appropriate visual templates from Canva."},
                    {"role": "user", "content": prompt}
                ],
                tools=[canva_function],
                tool_choice="auto",
                temperature=0.7,
                max_tokens=1000
            )
            
            message = response.choices[0].message
            
            # Check if AI wants to call Canva function
            template_id = None
            if message.tool_calls:
                print(f"[AI] AI requested Canva template search!")
                for tool_call in message.tool_calls:
                    if tool_call.function.name == "search_canva_templates":
                        import json
                        args = json.loads(tool_call.function.arguments)
                        print(f"   Query: {args.get('query')}")
                        print(f"   Category: {args.get('category')}")
                        
                        # Actually search Canva templates
                        templates = await canva_adapter.search_templates(
                            query=args.get('query', ''),
                            category=args.get('category', 'social-media')
                        )
                        
                        # Pick the first template
                        if templates:
                            template_id = templates[0]['id']
                            template_name = templates[0]['name']
                            print(f"   [SUCCESS] Selected template: {template_name} (ID: {template_id})")
            
            # Parse the post content
            post_content = self._parse_post_response(message.content or "")
            
            # Add template info
            post_content['canva_template_id'] = template_id
            post_content['has_template'] = bool(template_id)
            
            print(f"[SUCCESS] Generated post with Canva template: {template_id}")
            return post_content
            
        except Exception as e:
            print(f"[ERROR] Error generating post with Canva: {e}")
            import traceback
            traceback.print_exc()
            raise

    async def chat_with_context(self, messages: List[Dict], user_context: Optional[Dict] = None) -> Dict:
        """
        Chat with the LLM to gather requirements and generate a draft.
        
        Args:
            messages: List of conversation history [{"role": "user", "content": "..."}, ...]
            user_context: Optional dict with user/org info
            
        Returns:
            Dict with:
            - type: "question" or "draft"
            - content: The text response or the draft content
            - context_gathered: Dict of what we know so far (topic, tone, etc.)
        """
        print(f"\\n[CHAT] LLMAdapter.chat_with_context called")
        
        if self.mock_mode or not self.api_key:
            # Mock response
            last_msg = messages[-1]['content'].lower() if messages else ""
            if "topic" in last_msg or "about" in last_msg:
                return {
                    "type": "question",
                    "content": "That sounds interesting! Who is your target audience for this post?",
                    "context_gathered": {"topic": "identified"}
                }
            elif "audience" in last_msg or "everyone" in last_msg:
                return {
                    "type": "draft",
                    "content": "Here is a draft based on our conversation... [Mock Draft]",
                    "context_gathered": {"topic": "identified", "audience": "identified"}
                }
            else:
                return {
                    "type": "question",
                    "content": "I can help you write a LinkedIn post. What topic do you want to write about today?",
                    "context_gathered": {}
                }

        try:
            # System prompt to guide the conversation
            system_prompt = """You are an expert LinkedIn content strategist and ghostwriter.
Your goal is to help the user create a high-performing LinkedIn post by gathering necessary information and then writing it.

PROCESS:
1. Analyze the conversation history.
2. Determine if you have enough information to write a high-quality post.
   Required Information:
   - TOPIC: What is the post about?
   - AUDIENCE: Who is this for? (e.g., developers, founders, general network)
   - TONE: What is the desired style? (e.g., professional, controversial, personal story, educational)

3. IF INFORMATION IS MISSING:
   - Ask a specific, friendly follow-up question to get the missing piece.
   - Do NOT ask for everything at once. Keep it conversational (one question at a time is best).
   - If the user just says "hi" or starts, ask for the topic.

4. IF YOU HAVE ENOUGH INFORMATION:
   - Generate the LinkedIn post.
   - Follow these best practices:
     - Strong hook (1-2 lines).
     - Short paragraphs (1-3 lines).
     - Clear value or insight.
     - Call to Action (CTA) at the end.
     - 3-5 relevant hashtags.

OUTPUT FORMAT:
You MUST return ONLY a valid JSON object with no additional text, markdown, or code blocks. The JSON must follow this exact structure:
{
  "type": "question" | "draft",
  "content": "The question to ask the user OR the full generated post content",
  "thought_process": "Brief explanation of your decision (e.g., 'Missing tone, asking for it')",
  "context_gathered": {
    "topic": "detected topic or null",
    "audience": "detected audience or null",
    "tone": "detected tone or null"
  }
}

CRITICAL: Return ONLY the JSON object. Do not include markdown code blocks, explanations, or any other text. The response must be valid JSON that can be parsed directly.
"""

            # Prepare messages for the API
            api_messages = [{"role": "system", "content": system_prompt}]
            api_messages.extend(messages)

            print("[API] Calling OpenAI-compatible API for chat...")
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=api_messages,
                temperature=0.7,
                response_format={"type": "json_object"} if self.provider == "openai" else None
            )

            content = response.choices[0].message.content
            print(f"[SUCCESS] Chat response received: {content[:100]}...")
            
            import json
            try:
                # Try to parse JSON
                # Clean up markdown code blocks if present (common with some models)
                clean_content = content.replace('```json', '').replace('```', '').strip()
                result = json.loads(clean_content)
                
                # Validate response structure
                if not isinstance(result, dict):
                    raise ValueError("Response is not a dictionary")
                
                # Ensure required fields exist
                if 'type' not in result:
                    print(f"[WARNING] Missing 'type' field, defaulting to 'question'")
                    result['type'] = 'question'
                
                if 'content' not in result:
                    print(f"[WARNING] Missing 'content' field, using empty string")
                    result['content'] = ''
                
                if 'context_gathered' not in result:
                    result['context_gathered'] = {}
                
                # Validate type value
                if result['type'] not in ['question', 'draft']:
                    print(f"[WARNING] Invalid type '{result['type']}', defaulting to 'question'")
                    result['type'] = 'question'
                
                print(f"[SUCCESS] Validated response: type={result['type']}, content_length={len(result.get('content', ''))}")
                return result
                
            except (json.JSONDecodeError, ValueError) as e:
                print(f"[WARNING] Failed to parse JSON response: {e}")
                print(f"[DEBUG] Raw content: {content[:500]}")
                # Fallback if model didn't output JSON
                return {
                    "type": "question",
                    "content": content if content else "I'm having trouble processing that. Could you rephrase?",
                    "context_gathered": {}
                }

        except Exception as e:
            print(f"[ERROR] Error in chat_with_context: {e}")
            import traceback
            traceback.print_exc()
            # Fallback error response
            return {
                "type": "question",
                "content": "I'm having trouble connecting to my brain right now. Could you try saying that again?",
                "context_gathered": {}
            }