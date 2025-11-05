"""
AI Content Generation Service for LinkedIn Campaigns
Supports multiple providers: OpenRouter (default), OpenAI, Claude, Gemini
"""

import httpx
import os
from typing import Dict, Optional, List
import random
from datetime import datetime


class AIContentGenerator:
    def __init__(
        self, 
        api_key: Optional[str] = None,
        provider: str = "openrouter",  # openrouter, openai, claude, gemini
        model: Optional[str] = None
    ):
        self.provider = provider
        self.api_key = api_key
        self.model = model
        
        # Set up provider configurations
        if provider == "openrouter":
            self.api_key = api_key or os.getenv('OPENROUTER_API_KEY')
            self.base_url = "https://openrouter.ai/api/v1"
            self.model = model or os.getenv('CONTENT_GENERATION_MODEL', 'anthropic/claude-3.5-sonnet')
            
        elif provider == "openai":
            self.api_key = api_key or os.getenv('OPENAI_API_KEY')
            self.base_url = "https://api.openai.com/v1"
            self.model = model or 'gpt-4o'
            
        elif provider == "claude":
            self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
            self.base_url = "https://api.anthropic.com/v1"
            self.model = model or 'claude-3-5-sonnet-20241022'
            
        elif provider == "gemini":
            self.api_key = api_key or os.getenv('GOOGLE_AI_API_KEY')
            self.base_url = "https://generativelanguage.googleapis.com/v1beta"
            self.model = model or 'gemini-1.5-pro'
        
        # Fallback to mock if no API key
        self.mock_mode = not self.api_key
        
        if self.mock_mode:
            print(f"[WARNING] AI Content Generator in MOCK mode (no {provider} API key found)")

    async def generate_post_for_campaign(self, campaign: Dict) -> Dict:
        """
        Generate a LinkedIn post for a campaign based on its configuration
        
        Args:
            campaign: Campaign object with target_audience, content_pillars, tone_voice, etc.
            
        Returns:
            Dict with generated content, prompt used, and metadata
        
        Raises:
            Exception: If no API key is configured (mock mode disabled)
        """
        # Check if API key is available
        if self.mock_mode or not self.api_key:
            raise Exception("No API key configured. Please add an API key in Settings > API Keys to use automation.")
        
        # Select a random content pillar (or cycle through them)
        content_pillar = self._select_content_pillar(campaign.get('content_pillars', []))
        
        # Build the AI prompt
        prompt = self._build_generation_prompt(campaign, content_pillar)
        
        # Generate content using the selected provider (NO MOCK MODE)
        content = await self._generate_with_api(prompt)
        
        return {
            "content": content,
            "generation_prompt": prompt,
            "content_pillar": content_pillar,
            "content_type": self._select_content_type(campaign.get('content_types', ['text'])),
            "generated_at": datetime.utcnow().isoformat(),
            "provider": self.provider,
            "model": self.model
        }

    def _select_content_pillar(self, pillars: List[str]) -> str:
        """Select a content pillar (for now, random selection)"""
        if not pillars:
            return "General LinkedIn Content"
        return random.choice(pillars)

    def _select_content_type(self, content_types: List[str]) -> str:
        """Select content type (for now, prefer text)"""
        if 'text' in content_types:
            return 'text'
        return content_types[0] if content_types else 'text'

    def _build_generation_prompt(self, campaign: Dict, content_pillar: str) -> str:
        """Build optimized AI prompt based on best practices from OpenAI, Arize, and Prompt Engineering Guide"""
        
        # Extract campaign details
        name = campaign.get('name', 'LinkedIn Campaign')
        description = campaign.get('description', '')
        
        target_audience = campaign.get('target_audience', {})
        job_titles = target_audience.get('job_titles', [])
        industries = target_audience.get('industries', [])
        interests = target_audience.get('interests', [])
        
        tone_voice = campaign.get('tone_voice', 'professional')
        
        # Add temporal context (2025 trends)
        current_year = datetime.now().year
        current_month = datetime.now().strftime("%B")
        
        # Build audience description
        audience_desc = []
        if job_titles:
            audience_desc.append(f"Job titles: {', '.join(job_titles[:5])}")  # Limit to avoid prompt bloat
        if industries:
            audience_desc.append(f"Industries: {', '.join(industries[:3])}")
        if interests:
            audience_desc.append(f"Interests: {', '.join(interests[:5])}")
        
        audience_text = "; ".join(audience_desc) if audience_desc else "LinkedIn professionals"
        
        # Build tone guidance with enhanced descriptions
        tone_guidance = {
            'professional': "authentic, authoritative, and value-driven. Balance expertise with approachability.",
            'casual': "friendly, conversational, and relatable. Use everyday language while maintaining credibility.",
            'thought-leader': "insightful, visionary, and perspective-shifting. Challenge conventional thinking with backed insights.",
            'storytelling': "narrative-driven and emotionally engaging. Create a compelling story arc with clear lessons."
        }
        tone_desc = tone_guidance.get(tone_voice, tone_guidance['professional'])
        
        # Advanced optimized prompt with structure, examples, and clear requirements
        prompt = f"""You are an expert LinkedIn content strategist and copywriter specializing in campaign-driven content that drives measurable engagement and builds thought leadership.

**CAMPAIGN CONTEXT**:
- Campaign Name: {name}
{'- Campaign Goal: ' + description if description else ''}
- Target Audience: {audience_text}
- Content Focus: {content_pillar}
- Tone Style: {tone_voice.capitalize()}

**TEMPORAL CONTEXT**:
Consider {current_year} trends, recent developments in {current_month} {current_year}, and current industry insights related to "{content_pillar}".

**TONE REQUIREMENTS**:
Write with a {tone_voice} voice that is {tone_desc}

**CONTENT STRUCTURE** (follow this pattern exactly):
1. **Opening Hook** (1-2 sentences): 
   - Start with a compelling question, surprising stat, bold statement, or personal observation
   - Make it scroll-stopping and relevant to "{content_pillar}"
   - Connect to the target audience's interests and challenges

2. **Core Value** (3-5 short paragraphs):
   - Each paragraph: 2-3 sentences maximum
   - Include specific examples, data points, or actionable insights
   - Relate to "{content_pillar}" throughout
   - Make it practical and immediately useful
   - Address target audience needs directly

3. **Call-to-Action** (1 sentence):
   - End with an engaging question that invites conversation
   - OR provide a clear next step for the reader
   - Make it feel natural, not forced

4. **Hashtags (REQUIRED)**:
   - Include exactly 5 relevant hashtags at the very end of the post, on a new line after the CTA
   - Mix trending hashtags with niche-specific ones
   - Make them relevant to the topic and industry
   - Use proper LinkedIn hashtag format (e.g., #Leadership #BusinessGrowth #StartupTips)

**QUALITY STANDARDS**:
- Length: Under 260 words (optimal for LinkedIn algorithm)
- Readability: Use line breaks between paragraphs for mobile readability
- Engagement: Include 2-3 strategic emojis (not excessive)
- Value: Provide genuine, specific insights - not generic advice
- Authenticity: Write like a human expert, not an AI or marketer
- Variety: Make each post unique - vary sentence structure, examples, and perspectives
- Specificity: Use concrete examples, numbers, or scenarios

**OUTPUT FORMAT**:
Write the complete post with all content, then add exactly 5 hashtags at the end on a new line.

Example:
[Your post content here with paragraphs separated by line breaks]

What's your take?

#HashtagOne #HashtagTwo #HashtagThree #HashtagFour #HashtagFive

**OUTPUT REQUIREMENTS**:
- Write the complete post with all content
- Use line breaks between paragraphs
- Include exactly 5 hashtags at the end on a new line
- Make it feel authentic and human-written
- Ensure variety - do NOT repeat patterns from previous posts
- Focus on "{content_pillar}" but approach it from fresh angles each time
- Do NOT include any meta-commentary or explanations
- Return ONLY the post content with hashtags

Generate the LinkedIn post now:"""

        return prompt

    async def _generate_with_api(self, prompt: str) -> str:
        """Generate content using the configured API provider"""
        
        try:
            if self.provider == "openrouter" or self.provider == "openai":
                return await self._generate_openai_compatible(prompt)
            elif self.provider == "claude":
                return await self._generate_claude(prompt)
            elif self.provider == "gemini":
                return await self._generate_gemini(prompt)
            else:
                raise Exception(f"Unsupported provider: {self.provider}")
                
        except Exception as e:
            print(f"[ERROR] AI generation failed with {self.provider}: {e}")
            # Try fallback providers
            return await self._generate_with_fallback(prompt)

    async def _generate_openai_compatible(self, prompt: str) -> str:
        """Generate using OpenAI API format (works for OpenRouter and OpenAI)"""
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # Add OpenRouter-specific headers
            if self.provider == "openrouter":
                headers["HTTP-Referer"] = "https://linkedin-pilot.app"
                headers["X-Title"] = "LinkedIn Pilot"
            
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an expert LinkedIn content creator. Generate engaging, authentic posts that drive engagement."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.8,
                    "max_tokens": 800
                }
            )
            
            response.raise_for_status()
            result = response.json()
            
            content = result['choices'][0]['message']['content']
            return content.strip()

    async def _generate_claude(self, prompt: str) -> str:
        """Generate using Anthropic Claude API"""
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "max_tokens": 800,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.8
                }
            )
            
            response.raise_for_status()
            result = response.json()
            
            content = result['content'][0]['text']
            return content.strip()

    async def _generate_gemini(self, prompt: str) -> str:
        """Generate using Google Gemini API"""
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [
                        {
                            "parts": [
                                {"text": prompt}
                            ]
                        }
                    ],
                    "generationConfig": {
                        "temperature": 0.8,
                        "maxOutputTokens": 800
                    }
                }
            )
            
            response.raise_for_status()
            result = response.json()
            
            content = result['candidates'][0]['content']['parts'][0]['text']
            return content.strip()

    async def _generate_with_fallback(self, prompt: str) -> str:
        """Try fallback providers if primary fails (NO MOCK - requires API keys)"""
        
        fallback_order = ['openrouter', 'openai', 'claude', 'gemini']
        
        for provider in fallback_order:
            if provider == self.provider:
                continue  # Skip the one that already failed
            
            try:
                print(f"[FALLBACK] Trying fallback provider: {provider}")
                fallback_generator = AIContentGenerator(provider=provider)
                
                if not fallback_generator.mock_mode and fallback_generator.api_key:
                    content = await fallback_generator._generate_with_api(prompt)
                    print(f"[SUCCESS] Fallback successful with {provider}")
                    return content
                else:
                    print(f"[FALLBACK] {provider} skipped - no API key")
                    
            except Exception as e:
                print(f"[ERROR] Fallback {provider} also failed: {e}")
                continue
        
        # If all providers fail, raise exception (NO MOCK)
        raise Exception("All AI providers failed or no API keys configured. Please add at least one API key in Settings > API Keys to use automation.")

    def _generate_mock_content(self, campaign: Dict, content_pillar: str) -> str:
        """Generate VARIED mock content when no API is available"""
        
        tone = campaign.get('tone_voice', 'professional')
        timestamp = datetime.utcnow().timestamp()
        
        # Generate variety using timestamp to ensure different content each time
        variation_templates = {
            'professional': [
                f"""The key to success in {content_pillar.lower()} isn't about working harder—it's about working smarter.

I've learned this lesson over years of experience, and here's what changed everything:

- Focus on impact, not activity
- Build systems, not just tasks
- Learn continuously, adapt quickly

The professionals who thrive aren't the ones who know everything. They're the ones who know how to learn, adapt, and execute with precision.

What's your biggest insight about {content_pillar.lower()} this year?

#{content_pillar.replace(' ', '')} #ProfessionalDevelopment #Leadership""",

                f"""Three things I wish I knew about {content_pillar.lower()} 5 years ago:

1. Consistency beats intensity every time
2. Your network is your net worth—invest in relationships
3. Learning in public accelerates your growth exponentially

The game changed when I stopped trying to be perfect and started sharing my journey, mistakes and all.

What would you add to this list?

#{content_pillar.replace(' ', '')} #CareerGrowth #ThoughtLeadership""",

                f"""Real talk about {content_pillar.lower()}:

Everyone's showing their highlight reel, but nobody talks about the reality.

- Success takes longer than social media makes it seem
- Failures teach more than victories
- Behind every "overnight success" is years of unsexy work

The difference between those who make it and those who don't? They kept going when it got hard.

What's a hard truth you've learned in your career?

#{content_pillar.replace(' ', '')} #RealTalk #CareerAdvice""",

                f"""The {content_pillar.lower()} landscape has changed dramatically.

What worked 3 years ago doesn't work today.

Here's what I'm seeing:
• Authenticity beats perfection
• Community beats audience
• Depth beats breadth

The winners in 2025? Those who adapt fastest while staying true to their core values.

How are you adapting to these changes?

#{content_pillar.replace(' ', '')} #Innovation #FutureOfWork""",
            ],
            
            'casual': [
                f"""Let's talk about {content_pillar.lower()} for a sec 👇

I used to think I had it all figured out. Spoiler: I didn't 😅

The game-changer? Realizing that progress beats perfection every single time.

Here's what actually works:
• Ship it, learn from it, improve it
• Talk to real people (not just data)
• Stay curious, stay humble

The best advice I got? "Done is better than perfect."

How do you approach {content_pillar.lower()}? Would love to hear your take!

#{content_pillar.replace(' ', '')} #GrowthMindset #KeepLearning""",

                f"""OK real talk about {content_pillar.lower()}...

Nobody tells you how messy it actually is behind the scenes 🤷‍♂️

- Plans change constantly
- You'll doubt yourself (a lot)
- What works for others might not work for you

But here's the secret: embrace the chaos.

Your unique path is what makes your story worth sharing.

What's your biggest "{content_pillar.lower()}" lesson this month?

#{content_pillar.replace(' ', '')} #RealityCheck #Authentic""",
            ],
            
            'thought-leader': [
                f"""We're at an inflection point in {content_pillar.lower()}.

The old playbook? Obsolete.
The new rules? Still being written.

Here's what I'm seeing from the frontlines:

The organizations winning today aren't just adapting to change—they're creating it. They understand that {content_pillar.lower()} is no longer about following best practices; it's about defining them.

Three shifts I'm watching closely:

1. From reactive to proactive thinking
2. From siloed to integrated approaches  
3. From incremental to exponential growth

The question isn't whether your industry will transform. It's whether you'll lead that transformation or be disrupted by it.

Where do you see {content_pillar.lower()} heading in the next 3-5 years?

#{content_pillar.replace(' ', '')} #ThoughtLeadership #Innovation""",

                f"""The future of {content_pillar.lower()} won't look like its past.

And that's exactly why now is the most exciting time to be in this space.

My prediction? The next decade will be defined by those who can:
- Unlearn outdated assumptions
- Embrace emerging paradigms
- Lead with vision, not just execution

The opportunity isn't in optimizing the old ways. It's in pioneering the new ones.

Are you prepared for what's coming?

#{content_pillar.replace(' ', '')} #FutureReady #StrategicThinking""",
            ],
            
            'storytelling': [
                f"""Three years ago, I made a decision that changed everything about {content_pillar.lower()}.

I was sitting in a conference room, watching yet another initiative fail. Everyone was pointing fingers. Nobody was taking responsibility.

That's when it hit me.

The problem wasn't the strategy. It wasn't the team. It was our fundamental approach to {content_pillar.lower()}.

So I did something crazy: I threw out our entire playbook and started from scratch.

The first month? Chaos.
The second month? Doubt.
The third month? Breakthrough.

We discovered that success in {content_pillar.lower()} isn't about having all the answers. It's about asking better questions.

Today, that same approach has transformed how we work, think, and deliver results.

The lesson? Sometimes you need to break something completely to build it better.

What's a time you had to start from zero? How did it turn out?

#{content_pillar.replace(' ', '')} #LessonsLearned #Transformation""",

                f"""I'll never forget the moment {content_pillar.lower()} finally clicked for me.

It wasn't in a boardroom or a course. It was at 2 AM, staring at my laptop, wondering if I was completely off track.

Then something shifted.

I realized I'd been asking the wrong questions. Instead of "How can I be better?" I started asking "What value am I actually creating?"

That single reframe changed my entire trajectory.

Within 6 months:
- My impact tripled
- My stress halved
- My clarity skyrocketed

The best part? I stopped comparing myself to others and started building something uniquely mine.

{content_pillar} isn't about following someone else's blueprint. It's about writing your own.

What question changed everything for you?

#{content_pillar.replace(' ', '')} #PersonalJourney #Growth""",
            ]
        }
        
        # Select random template based on tone (using timestamp for variety)
        templates = variation_templates.get(tone, variation_templates['professional'])
        selected_index = int(timestamp) % len(templates)
        return templates[selected_index]

    async def validate_post_quality(self, content: str) -> Dict:
        """
        Validate the generated post meets quality standards
        
        Returns:
            Dict with 'valid': bool and 'issues': List[str]
        """
        issues = []
        
        # Check length
        word_count = len(content.split())
        if word_count < 50:
            issues.append("Post is too short (minimum 50 words)")
        elif word_count > 500:
            issues.append("Post is too long (maximum 500 words)")
        
        # Check for common AI tells
        ai_phrases = [
            "as an AI", "I don't have personal", "I cannot", "I'm sorry",
            "delve into", "in conclusion", "in summary", "it's worth noting"
        ]
        for phrase in ai_phrases:
            if phrase.lower() in content.lower():
                issues.append(f"Contains AI phrase: '{phrase}'")
        
        # Check for engagement elements
        has_question = '?' in content
        if not has_question:
            issues.append("No engaging question or CTA")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "word_count": word_count,
            "has_engagement": has_question
        }



