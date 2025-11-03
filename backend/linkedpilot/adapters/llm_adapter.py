import os
from typing import Optional, Dict, List
from openai import AsyncOpenAI

class LLMAdapter:
    """
    Adapter for LLM operations using OpenAI or OpenRouter
    Supports: OpenAI, OpenRouter (with access to Claude, Gemini, etc.)
    """
    
    def __init__(self, api_key: Optional[str] = None, provider: str = "openai", model: Optional[str] = None):
        # Use provided API key or fall back to environment variable
        self.provider = provider
        
        # Multi-provider support
        if provider == "openrouter":
            self.api_key = api_key or os.getenv('OPENROUTER_API_KEY')
            self.base_url = "https://openrouter.ai/api/v1"
            self.model = model or 'anthropic/claude-3.5-sonnet'
        elif provider == "google_ai_studio":
            self.api_key = api_key or os.getenv('GOOGLE_AI_API_KEY')
            self.base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
            self.model = model or 'gemini-2.0-flash-exp'
        elif provider == "anthropic":
            self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
            self.base_url = "https://api.anthropic.com/v1"
            self.model = model or 'claude-3-5-sonnet-20241022'
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
            if provider == "openrouter":
                extra_headers = {
                    "HTTP-Referer": "https://linkedin-pilot.app",
                    "X-Title": "LinkedIn Pilot"
                }
            elif provider == "anthropic":
                extra_headers = {
                    "anthropic-version": "2023-06-01"
                }
            
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
            
            # Use the topic directly without forcing current trends
            print(f"[SUCCESS] Using REAL AI mode!")
            print(f"   - Topic: {topic}")
            print(f"   - Tone: {tone}")
            print(f"   - Model: {self.model}")
            
            # Structured prompt with few-shot examples and clear formatting
            prompt = f"""You are an expert LinkedIn content strategist with deep expertise in creating high-engagement posts that drive meaningful conversations and audience growth.

TASK: Create a compelling, professional LinkedIn post about: "{topic}"

IMPORTANT: Stay fully focused on the exact topic. Do NOT default to general themes (AI, tech, productivity, remote work, etc.) unless they're directly part of the topic.

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

Formatting Rules:

Keep total length under 260 words.

Use line breaks between every paragraph.

Avoid dense blocks of text — it should look like it breathes on screen.

If you use lists, use the "→" arrow style or emojis for flow.

OUTPUT FORMAT (respond ONLY with valid JSON):
{{
  "body": "Complete post text formatted with natural rhythm, short paragraphs, line breaks, and emojis — easy to scan and read on LinkedIn.\nEach paragraph should be 1–3 lines max.\nInclude a clear CTA at the end.",
  "hashtags": ["#HashtagOne", "#HashtagTwo", "#HashtagThree", "#HashtagFour", "#HashtagFive"],
  "cta": "Exact question or invitation to engage from the final paragraph"
}}

CRITICAL: Your response must be valid JSON only. Do not include any text before or after the JSON object."""

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
        """Parse OpenAI response into post structure"""
        import json
        import re
        
        try:
            # Try to extract JSON from markdown code blocks if present
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                json_str = response
            
            parsed = json.loads(json_str)
            
            # Ensure required fields exist
            return {
                "body": parsed.get("body", response),
                "hashtags": parsed.get("hashtags", ["#LinkedIn", "#Business"]),
                "cta": parsed.get("cta", "Learn more")
            }
        except Exception as e:
            print(f"Error parsing post response: {e}")
            # Fallback to extracting text content
            return {
                "body": response,
                "hashtags": ["#LinkedIn", "#Business"],
                "cta": "Learn more"
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
                max_tokens=2000
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"[ERROR] LLM completion error: {e}")
            raise
    
    async def llm_complete(self, prompt: str, temperature: float = 0.7) -> str:
        """Alias for generate_completion for backward compatibility"""
        return await self.generate_completion(prompt, temperature)
    
    async def generate_with_image(self, prompt: str, image_base64: str, mime_type: str) -> str:
        """Generate completion with image input (vision model)"""
        if self.mock_mode or not self.api_key:
            return "Mock image analysis: This image shows professional branding elements."
        
        try:
            # Use vision-capable model
            vision_model = "gpt-4o" if self.provider == "openai" else "anthropic/claude-3.5-sonnet"
            
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