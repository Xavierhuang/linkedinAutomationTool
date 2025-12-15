"""
AI-powered campaign generation service
Generates complete campaign configurations from brand analysis
"""
import json
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from ..models.campaign import (
    Campaign, CampaignStatus, PostingFrequency, ToneVoice,
    TargetAudience, PostingSchedule, CampaignDuration
)
from ..models.organization_materials import BrandAnalysis
from ..adapters.llm_adapter import LLMAdapter


class CampaignGenerator:
    """Generate structured campaign data from brand analysis"""
    
    def __init__(self, api_key: str, provider: str = "openai"):
        self.llm = LLMAdapter(api_key=api_key, provider=provider)
    
    @staticmethod
    def suggest_optimal_times(target_audience: Dict, tone: str = "professional") -> List[str]:
        """
        Suggest optimal posting times based on target audience and tone
        
        LinkedIn best practices:
        - B2B: 7-9 AM, 12-1 PM, 5-6 PM (business hours)
        - B2C: 12-1 PM, 5-6 PM, 8-9 PM (lunch and evening)
        - Executives: 7-8 AM, 12 PM, 5-6 PM (early morning, lunch, commute)
        - Marketers: 9-10 AM, 12-1 PM, 3-4 PM (mid-morning, lunch, afternoon)
        """
        job_titles = target_audience.get('job_titles', [])
        industries = target_audience.get('industries', [])
        
        # Convert to lowercase for matching
        titles_lower = [t.lower() for t in job_titles]
        industries_lower = [i.lower() for i in industries]
        
        # Executive audience (CEOs, VPs, Directors)
        if any(word in ' '.join(titles_lower) for word in ['ceo', 'vp', 'director', 'executive', 'president']):
            return ["07:30", "12:00", "17:30"]  # Early morning, lunch, evening commute
        
        # Marketing/Creative audience
        elif any(word in ' '.join(titles_lower) for word in ['marketing', 'creative', 'designer', 'content']):
            return ["09:00", "13:00", "15:00"]  # Mid-morning, lunch, mid-afternoon
        
        # Tech/Developer audience
        elif any(word in ' '.join(titles_lower) for word in ['developer', 'engineer', 'tech', 'programmer']):
            return ["08:00", "12:30", "16:00"]  # Morning, lunch, afternoon
        
        # Sales audience
        elif any(word in ' '.join(titles_lower) for word in ['sales', 'account', 'business development']):
            return ["08:30", "12:00", "17:00"]  # Before calls, lunch, end of day
        
        # B2C industries
        elif any(word in ' '.join(industries_lower) for word in ['retail', 'consumer', 'ecommerce', 'b2c']):
            return ["12:00", "17:00", "20:00"]  # Lunch, evening, night
        
        # Default B2B times
        else:
            return ["08:00", "12:30", "17:00"]  # Standard business hours
    
    async def generate_campaign_from_analysis(
        self,
        org_id: str,
        created_by: str,
        brand_analysis: BrandAnalysis,
        campaign_name: str,
        focus_area: Optional[str] = None,
        duration_weeks: int = 12
    ) -> Campaign:
        """
        Generate a complete campaign configuration from brand analysis
        Returns a Campaign object ready to be saved
        """
        
        # Build comprehensive prompt for campaign generation
        prompt = self._build_campaign_prompt(brand_analysis, campaign_name, focus_area)
        
        # Get AI-generated campaign config
        response = await self.llm.generate_completion(prompt)
        
        # Parse response
        campaign_data = self._parse_campaign_response(response)
        
        # Map to Campaign model
        campaign = self._create_campaign_object(
            org_id=org_id,
            created_by=created_by,
            campaign_name=campaign_name,
            campaign_data=campaign_data,
            brand_analysis=brand_analysis,
            duration_weeks=duration_weeks
        )
        
        return campaign
    
    def _build_campaign_prompt(
        self,
        analysis: BrandAnalysis,
        campaign_name: str,
        focus_area: Optional[str]
    ) -> str:
        """Build detailed prompt for campaign generation"""
        
        prompt = f"""You are a LinkedIn campaign strategist. Generate a complete campaign configuration based on this brand analysis.

BRAND ANALYSIS:
- Brand Voice: {analysis.brand_voice}
- Brand Tone: {', '.join(analysis.brand_tone)}
- Key Messages: {', '.join(analysis.key_messages[:5])}
- Value Propositions: {', '.join(analysis.value_propositions[:3])}
- Content Pillars: {', '.join(analysis.content_pillars)}
- Target Audience:
  * Job Titles: {', '.join(analysis.target_audience.get('job_titles', [])[:5])}
  * Industries: {', '.join(analysis.target_audience.get('industries', [])[:5])}
  * Interests: {', '.join(analysis.target_audience.get('interests', [])[:5])}
  * Pain Points: {', '.join(analysis.target_audience.get('pain_points', [])[:3])}
- Expert Segments: {', '.join(analysis.expert_segments)}
- Posting Themes: {', '.join(analysis.posting_themes)}

CAMPAIGN NAME: {campaign_name}
FOCUS AREA: {focus_area or 'General brand awareness and thought leadership'}

Generate a campaign configuration with:

1. DESCRIPTION: 2-3 sentence campaign description that explicitly references the brand story, core values, or unique selling points. Make it feel personal to THIS brand.
2. CONTENT_PILLARS: Select 4-6 most relevant pillars that align with the brand's unique selling points, value propositions, and personality. These should feel specific to THIS brand, not generic.
3. TARGET_AUDIENCE: Refine the audience for this specific campaign based on the brand's actual target audience data
   - job_titles: 5-8 specific roles from the brand's target audience
   - industries: 3-5 industries from the brand's target audience
   - interests: 5-8 interests from the brand's target audience
4. TONE_VOICE: Choose ONE that matches the brand's personality: professional, casual, thought-leader, storytelling
   - If brand_personality includes "authentic" or "genuine", lean toward storytelling
   - If brand_personality includes "authoritative" or "expert", lean toward thought-leader
   - Match the brand's specified tone
5. POSTING_FREQUENCY: Choose ONE: daily, twice_daily (default to daily unless specified otherwise)
6. TIME_SLOTS: 2-4 optimal posting times in HH:MM 24-hour format based on:
   - Target audience's typical LinkedIn activity times
   - Industry best practices (B2B: 07:00-09:00, 12:00-13:00, 17:00-18:00)
   - Geographic timezone considerations
   - Content type and engagement patterns
   Examples: ["08:00", "12:30", "17:00"] or ["09:00", "14:00"]
7. CONTENT_TYPES: Array from: text, article, poll, carousel
8. INCLUDE_IMAGES: true/false - should posts include AI-generated images?
9. IMAGE_STYLE: If images enabled, style: professional, creative, minimalist, bold (match brand personality)
10. DRAFT_POST_IDEAS: 10 specific post ideas that:
    - Reference the brand's core values, unique selling points, or brand story
    - Align with the brand's personality traits
    - Incorporate key messages naturally
    - Feel authentic to THIS brand (not generic LinkedIn advice)
    - Address the target audience's pain points
11. EXPERT_TARGETS: 5-8 types of experts/influencers relevant to the brand's industry and content pillars
12. HASHTAG_STRATEGY: 8-12 relevant hashtags aligned with the brand's industry, content pillars, and target audience
13. ENGAGEMENT_TACTICS: 3-5 tactics that reflect the brand's personality and values
14. SUCCESS_METRICS: Key metrics to track

Return ONLY valid JSON with this exact structure:
{{
  "description": "string",
  "content_pillars": ["string"],
  "target_audience": {{
    "job_titles": ["string"],
    "industries": ["string"],
    "interests": ["string"]
  }},
  "tone_voice": "professional|casual|thought-leader|storytelling",
  "posting_frequency": "daily|3x_week|2x_week|weekly|bi_weekly",
  "time_slots": ["HH:MM"],
  "content_types": ["text", "article"],
  "include_images": boolean,
  "image_style": "string",
  "draft_post_ideas": ["string"],
  "expert_targets": ["string"],
  "hashtag_strategy": ["string"],
  "engagement_tactics": ["string"],
  "success_metrics": ["string"]
}}

NO markdown formatting, ONLY the JSON object."""

        return prompt
    
    def _parse_campaign_response(self, response: str) -> Dict:
        """Parse and validate AI response"""
        try:
            # Clean response
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            data = json.loads(response_text.strip())
            
            # Validate required fields
            required_fields = [
                'description', 'content_pillars', 'target_audience',
                'tone_voice', 'posting_frequency', 'time_slots',
                'content_types', 'draft_post_ideas'
            ]
            
            for field in required_fields:
                if field not in data:
                    raise ValueError(f"Missing required field: {field}")
            
            return data
            
        except json.JSONDecodeError as e:
            # Fallback with default structure
            print(f"JSON parse error: {e}")
            return self._get_fallback_campaign_data()
        except Exception as e:
            print(f"Campaign parse error: {e}")
            return self._get_fallback_campaign_data()
    
    def _get_fallback_campaign_data(self) -> Dict:
        """Fallback campaign data if AI generation fails"""
        return {
            "description": "AI-generated LinkedIn campaign focused on thought leadership and brand awareness",
            "content_pillars": ["Industry Insights", "Thought Leadership", "Product Updates", "Customer Success"],
            "target_audience": {
                "job_titles": ["CEO", "Marketing Director", "Business Owner", "VP of Sales"],
                "industries": ["Technology", "SaaS", "Professional Services"],
                "interests": ["Innovation", "Leadership", "Business Growth"]
            },
            "tone_voice": "professional",
            "posting_frequency": "daily",
            "time_slots": ["08:00", "12:30", "17:00"],  # Optimal B2B times: morning, lunch, evening
            "content_types": ["text", "article"],
            "include_images": True,
            "image_style": "professional",
            "draft_post_ideas": [
                "Share industry insights and trends",
                "Discuss leadership lessons learned",
                "Highlight customer success stories",
                "Provide actionable business tips"
            ],
            "expert_targets": ["Industry Leaders", "Subject Matter Experts"],
            "hashtag_strategy": ["#Leadership", "#Innovation", "#BusinessGrowth"],
            "engagement_tactics": ["Ask thought-provoking questions", "Share personal experiences"],
            "success_metrics": ["Engagement rate", "Follower growth", "Post reach"]
        }
    
    def _create_campaign_object(
        self,
        org_id: str,
        created_by: str,
        campaign_name: str,
        campaign_data: Dict,
        brand_analysis: BrandAnalysis,
        duration_weeks: int
    ) -> Campaign:
        """Create Campaign model object from generated data"""
        
        # Map tone_voice string to enum
        tone_map = {
            "professional": ToneVoice.PROFESSIONAL,
            "casual": ToneVoice.CASUAL,
            "thought-leader": ToneVoice.THOUGHT_LEADER,
            "storytelling": ToneVoice.STORYTELLING
        }
        tone_voice = tone_map.get(campaign_data.get('tone_voice', 'professional'), ToneVoice.PROFESSIONAL)
        
        # Map posting frequency
        freq_map = {
            "daily": PostingFrequency.DAILY,
            "3x_week": PostingFrequency.THREE_TIMES_WEEK,
            "2x_week": PostingFrequency.TWICE_WEEK,
            "weekly": PostingFrequency.WEEKLY,
            "bi_weekly": PostingFrequency.BI_WEEKLY,
            "twice_daily": PostingFrequency.TWICE_DAILY
        }
        frequency = freq_map.get(campaign_data.get('posting_frequency', 'daily'), PostingFrequency.DAILY)
        
        # Create target audience
        target_audience = TargetAudience(
            job_titles=campaign_data.get('target_audience', {}).get('job_titles', []),
            industries=campaign_data.get('target_audience', {}).get('industries', []),
            interests=campaign_data.get('target_audience', {}).get('interests', [])
        )
        
        # Create posting schedule with intelligent defaults
        time_slots = campaign_data.get('time_slots', [])
        if not time_slots or len(time_slots) == 0:
            # Use AI-suggested optimal times based on audience
            time_slots = self.suggest_optimal_times(
                campaign_data.get('target_audience', {}),
                campaign_data.get('tone_voice', 'professional')
            )
        
        posting_schedule = PostingSchedule(
            frequency=frequency,
            time_slots=time_slots
        )
        
        # Create duration
        start_date = datetime.utcnow()
        end_date = start_date + timedelta(weeks=duration_weeks)
        duration = CampaignDuration(
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat()
        )
        
        # Create campaign
        campaign = Campaign(
            org_id=org_id,
            name=campaign_name,
            description=campaign_data.get('description', ''),
            target_audience=target_audience,
            content_pillars=campaign_data.get('content_pillars', []),
            posting_schedule=posting_schedule,
            tone_voice=tone_voice,
            content_types=campaign_data.get('content_types', ['text']),
            duration=duration,
            include_images=campaign_data.get('include_images', True),  # Default to True - always generate images
            use_ai_images=False,  # Default to stock photos
            image_style=campaign_data.get('image_style', 'professional'),
            image_model="google/gemini-3-pro-image-preview",  # Default to Gemini 3 Pro Image Preview (supports text)
            status=CampaignStatus.DRAFT,
            auto_post=False,
            created_by=created_by
        )
        
        return campaign
    
    async def generate_post_ideas(
        self,
        campaign: Campaign,
        brand_analysis: BrandAnalysis,
        count: int = 10,
        excluded_types: Optional[List[str]] = None
    ) -> List[str]:
        """Generate full LinkedIn posts using the proven 8-part viral format with 5 rotating post types
        
        Args:
            campaign: Campaign object
            brand_analysis: BrandAnalysis object
            count: Number of posts to generate
            excluded_types: List of post type names to exclude (e.g., to avoid consecutive days having same type)
        """
        
        # Build comprehensive brand context
        target_audience_desc = ""
        if isinstance(brand_analysis.target_audience, dict):
            job_titles = brand_analysis.target_audience.get('job_titles', [])
            industries = brand_analysis.target_audience.get('industries', [])
            interests = brand_analysis.target_audience.get('interests', [])
            pain_points = brand_analysis.target_audience.get('pain_points', [])
            target_audience_desc = f"""
- Job Titles: {', '.join(job_titles[:8]) if job_titles else 'Professional audience'}
- Industries: {', '.join(industries[:5]) if industries else 'Various industries'}
- Interests: {', '.join(interests[:8]) if interests else 'Professional growth'}
- Pain Points: {', '.join(pain_points[:5]) if pain_points else 'Business challenges'}"""
        elif brand_analysis.target_audience_description:
            target_audience_desc = f"- Description: {brand_analysis.target_audience_description[:200]}"
        
        # 5 proven content templates from Linked Coach (https://linked.coach/5-proven-content-templates-for-linkedin/)
        post_types = [
            {
                "name": "How to/The Secret to",
                "hook_style": "Start with 'How to {DO THIS THING}' or 'The Secret to {GETTING DESIRED OUTCOME}'",
                "body_style": "5 little-known steps (or 3 traits) with short descriptions. Use bullet points. End with value proposition.",
                "template_guide": "Template: How to {DO THIS THING}: (5 little-known steps anyone can use) * {1ST THING}: {SHORT DESCRIPTION} * {2ND THING}: {SHORT DESCRIPTION} etc."
            },
            {
                "name": "The Rant",
                "hook_style": "Start with 'I'M GOING TO RANT' or shocking question about why negative thing happens",
                "body_style": "Describe frustrating behavior in vivid detail. Acknowledge exceptions. Explain ripple effects. Offer better playbook. End asking what reader does.",
                "template_guide": "Template: {I'M GOING TO RANT} {QUESTION ABOUT WHY NEGATIVE THING HAPPENS} I've had {NEGATIVE THING HAPPEN} and I'm feeling very frustrated! Explain effects, offer solution, ask what they do."
            },
            {
                "name": "Polarisation",
                "hook_style": "Contrarian opener stating what most people get wrong",
                "body_style": "Explain default approach and why it fails. Reveal alternative point of view. Back with example. Ask readers to pick a side.",
                "template_guide": "Template: Contrarian hook ('Doing X? It's slowing you down.') Explain why default fails. Reveal alternative. Back with example. CTA asking to pick a side."
            },
            {
                "name": "Data Driven",
                "hook_style": "Hook with metric or percentage and why it matters",
                "body_style": "Break down insight in 2-3 micro paragraphs. Highlight implication. Provide 2-3 action bullets. End asking how they're tracking.",
                "template_guide": "Template: Hook with metric/percentage. Break down insight. Highlight implication. 2-3 action bullets. CTA asking how they track the metric."
            },
            {
                "name": "There Are 3 Things",
                "hook_style": "'There are 3 things...' or '3 Things Every {TOPIC} Should Include'",
                "body_style": "Three numbered points with bolded keyword + one-liner. Optional bonus tip. CTA inviting readers to add a fourth idea.",
                "template_guide": "Template: 'There are 3 things...' or '3 Things Every {TOPIC} Should Include:' * {THING 1} - {SHORT EXPLANATION} * {THING 2} - {SHORT EXPLANATION} * {THING 3} - {SHORT EXPLANATION} CTA asking what's their number four."
            }
        ]
        
        # Filter out excluded types
        excluded_types = excluded_types or []
        available_types = [t for t in post_types if t['name'] not in excluded_types]
        
        if not available_types:
            # If all types are excluded, use all types anyway (fallback)
            print(f"[CAMPAIGN] All types excluded, using all types anyway")
            available_types = post_types
        
        # Rotate through post types - ensure we use all available types when generating multiple posts
        import hashlib
        from datetime import datetime
        week = datetime.utcnow().isocalendar()[1]
        day_of_year = datetime.utcnow().timetuple().tm_yday
        
        # Generate posts in batches, rotating through all available types
        all_posts = []
        posts_per_type = max(1, count // len(available_types))
        remaining = count % len(available_types)
        
        for type_idx in range(len(available_types)):
            posts_to_generate = posts_per_type + (1 if type_idx < remaining else 0)
            if posts_to_generate == 0:
                continue
                
            # Use day_of_year for daily rotation, ensuring different type each day
            rotation_index = (day_of_year + type_idx) % len(available_types)
            current_type = available_types[rotation_index]
        
            prompt = f"""Generate {posts_to_generate} complete, ready-to-post LinkedIn posts using the PROVEN 8-PART VIRAL FORMAT.

CRITICAL: Every post MUST follow this exact 8-part structure:

1. HOOK (6-8 words max)
   - Stop the scroll instantly
   - Use numbers, bold claims, or contrarian takes
   - Make them need to know more
   - Style: {current_type['hook_style']}

2. REHOOK (halfway reminder)
   - Re-engage skimmers after the hook
   - Use phrases like "But here's the thing..." or "Here's why this matters..."
   - Build intrigue for what's coming
   - Keep it 1-2 lines

3. PROBLEM (make it hurt)
   - Call out their exact struggle
   - Mirror their internal dialogue
   - Use "You know that feeling when..." or similar
   - Make it specific and relatable
   - 2-3 lines

4. SOLUTION (deliver value)
   - Tease the solution
   - Keep it simple and clear
   - A strong one-liner is fine
   - 1-2 lines

5. SIGNPOST (show the way)
   - Hint at how you did the thing
   - Use "Here's how..." or "Let me show you..."
   - Build anticipation for the solution
   - 1-2 lines

6. BODY (tell the story)
   - {current_type['body_style']}
   - Keep it short & actionable
   - Use white space (line breaks) for readability
   - Show step-by-step process or numbered points
   - 4-6 lines

7. POWER ENDING (nail the close)
   - End with impact
   - Use pattern interrupts
   - Reiterate an earlier point
   - Leave them with a memorable message
   - 2-3 lines

8. CTA (invite action)
   - Ask for engagement
   - Use "Which part resonated?" or "What's your take?"
   - Make it easy to respond
   - End with "P.S." or "P.P.S." for bonus engagement
   - 1-2 lines

BRAND DNA:
- Brand Voice: {brand_analysis.brand_voice}
- Brand Tone: {', '.join(brand_analysis.brand_tone[:5]) if brand_analysis.brand_tone else 'professional'}
- Key Messages: {', '.join(brand_analysis.key_messages[:5]) if brand_analysis.key_messages else 'Value-driven messaging'}
- Value Propositions: {', '.join(brand_analysis.value_propositions[:3]) if brand_analysis.value_propositions else 'Excellence'}
- Core Values: {', '.join(brand_analysis.core_values[:5]) if brand_analysis.core_values else 'Quality'}
- Brand Story: {brand_analysis.brand_story[:300] if brand_analysis.brand_story else 'Premium brand'}
- Content Pillars: {', '.join(brand_analysis.content_pillars[:6]) if brand_analysis.content_pillars else 'Industry insights'}

CAMPAIGN DETAILS:
- Name: {campaign.name}
- Description: {campaign.description}
- Focus: {getattr(campaign, 'focus', 'General brand awareness')}
- Content Pillars: {', '.join(campaign.content_pillars[:6])}
- Tone: {campaign.tone_voice}
- Target Audience:{target_audience_desc}

POST TYPE: {current_type['name']}
TEMPLATE GUIDE: {current_type['template_guide']}

FORMATTING REQUIREMENTS:
- Total length: 200-300 words
- Use line breaks between each section
- Use emojis sparingly (2-3 max, strategically placed)
- Include 3-5 relevant hashtags at the very end
- Make it conversational and engaging
- Vary the content pillar for each post

Return as JSON array of complete post strings:
["Full post 1 following 8-part format", "Full post 2 following 8-part format", ...]

Each post must be a complete, polished LinkedIn post ready to publish, following the exact 8-part structure above.

NO markdown, ONLY the JSON array."""

            response = await self.llm.generate_completion(prompt, temperature=0.8)
        
            try:
                # Clean and parse
                response_text = response.strip()
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.startswith("```"):
                    response_text = response_text[3:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                
                batch_posts = json.loads(response_text.strip())
                if not isinstance(batch_posts, list):
                    batch_posts = [batch_posts]
                
                all_posts.extend(batch_posts[:posts_to_generate])
                
            except Exception as e:
                print(f"[CAMPAIGN] Failed to generate posts for type {current_type['name']}: {e}")
                # Continue with other types
        
        # If we still need more posts, fill with fallback
        if len(all_posts) < count:
            needed = count - len(all_posts)
            fallback_posts = [
                f"Share insights about {pillar}" 
                for pillar in campaign.content_pillars[:needed]
            ]
            all_posts.extend(fallback_posts[:needed])
        
        return all_posts[:count]


