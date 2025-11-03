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
    
    def __init__(self, api_key: str, provider: str = "openrouter"):
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

1. DESCRIPTION: 2-3 sentence campaign description
2. CONTENT_PILLARS: Select 4-6 most relevant pillars from the analysis
3. TARGET_AUDIENCE: Refine the audience for this specific campaign
   - job_titles: 5-8 specific roles
   - industries: 3-5 industries
   - interests: 5-8 interests
4. TONE_VOICE: Choose ONE: professional, casual, thought-leader, storytelling
5. POSTING_FREQUENCY: Choose ONE: daily, 3x_week, 2x_week, weekly, bi_weekly
6. TIME_SLOTS: 2-4 optimal posting times in HH:MM 24-hour format based on:
   - Target audience's typical LinkedIn activity times
   - Industry best practices (B2B: 07:00-09:00, 12:00-13:00, 17:00-18:00)
   - Geographic timezone considerations
   - Content type and engagement patterns
   Examples: ["08:00", "12:30", "17:00"] or ["09:00", "14:00"]
7. CONTENT_TYPES: Array from: text, article, poll, carousel
8. INCLUDE_IMAGES: true/false - should posts include AI-generated images?
9. IMAGE_STYLE: If images enabled, style: professional, creative, minimalist, bold
10. DRAFT_POST_IDEAS: 10 specific post ideas aligned with pillars and audience
11. EXPERT_TARGETS: 5-8 types of experts/influencers to engage with
12. HASHTAG_STRATEGY: 8-12 relevant hashtags
13. ENGAGEMENT_TACTICS: 3-5 tactics to boost engagement
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
            "posting_frequency": "weekly",
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
        frequency = freq_map.get(campaign_data.get('posting_frequency', 'weekly'), PostingFrequency.WEEKLY)
        
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
            include_images=campaign_data.get('include_images', False),
            use_ai_images=False,  # Default to stock photos
            image_style=campaign_data.get('image_style', 'professional'),
            image_model="openai/dall-e-3",  # Only used if user enables AI images
            status=CampaignStatus.DRAFT,
            auto_post=False,
            created_by=created_by
        )
        
        return campaign
    
    async def generate_post_ideas(
        self,
        campaign: Campaign,
        brand_analysis: BrandAnalysis,
        count: int = 10
    ) -> List[str]:
        """Generate specific post ideas for a campaign"""
        
        prompt = f"""Generate {count} specific LinkedIn post ideas for this campaign:

CAMPAIGN: {campaign.name}
DESCRIPTION: {campaign.description}
CONTENT PILLARS: {', '.join(campaign.content_pillars)}
TARGET AUDIENCE: {', '.join(campaign.target_audience.job_titles[:5])}
TONE: {campaign.tone_voice}
BRAND VOICE: {brand_analysis.brand_voice}
KEY MESSAGES: {', '.join(brand_analysis.key_messages[:3])}

Each post idea should:
- Be specific and actionable
- Align with a content pillar
- Resonate with the target audience
- Match the brand tone and voice
- Be suitable for LinkedIn format

Return as JSON array of strings:
["Post idea 1", "Post idea 2", ...]

NO markdown, ONLY the JSON array."""

        response = await self.llm.generate_completion(prompt)
        
        try:
            # Clean and parse
            response_text = response.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            
            ideas = json.loads(response_text.strip())
            return ideas if isinstance(ideas, list) else []
            
        except:
            # Fallback
            return [
                f"Share insights about {pillar}" 
                for pillar in campaign.content_pillars[:count]
            ]


