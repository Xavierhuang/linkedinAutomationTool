from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum
import uuid

class CampaignStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"

class PostingFrequency(str, Enum):
    # Testing frequencies (for quick testing)
    EVERY_5_MIN = "every_5_min"
    EVERY_15_MIN = "every_15_min"
    EVERY_30_MIN = "every_30_min"
    HOURLY = "hourly"
    
    # Production frequencies
    TWICE_DAILY = "twice_daily"
    DAILY = "daily"
    THREE_TIMES_WEEK = "3x_week"
    TWICE_WEEK = "2x_week"
    WEEKLY = "weekly"
    BI_WEEKLY = "bi_weekly"

class ToneVoice(str, Enum):
    PROFESSIONAL = "professional"
    CASUAL = "casual"
    THOUGHT_LEADER = "thought-leader"
    STORYTELLING = "storytelling"

class TargetAudience(BaseModel):
    job_titles: List[str] = []
    industries: List[str] = []
    interests: List[str] = []

class PostingSchedule(BaseModel):
    frequency: PostingFrequency = PostingFrequency.WEEKLY
    time_slots: List[str] = ["09:00", "14:00"]  # HH:mm format

class CampaignDuration(BaseModel):
    start_date: Optional[str] = None  # ISO date string
    end_date: Optional[str] = None

class Campaign(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str
    name: str
    description: Optional[str] = None
    
    # AI-Powered Configuration
    target_audience: TargetAudience = Field(default_factory=TargetAudience)
    content_pillars: List[str] = []
    posting_schedule: PostingSchedule = Field(default_factory=PostingSchedule)
    tone_voice: ToneVoice = ToneVoice.PROFESSIONAL
    content_types: List[str] = ["text"]  # text, article, poll, carousel
    duration: CampaignDuration = Field(default_factory=CampaignDuration)
    
    # AI Model Settings
    text_model: Optional[str] = "openai/gpt-4o-mini"  # Model to use for text generation
    
    # Image Generation Settings
    include_images: bool = True  # Whether to generate images with posts
    use_ai_images: bool = True  # Prefer AI-generated images by default; stock is optional
    image_style: Optional[str] = "professional"  # Style for image generation
    image_model: Optional[str] = "google/gemini-2.5-flash-image"  # Default AI image model
    
    # LinkedIn Publishing Settings
    profile_type: Optional[str] = "personal"  # personal or company
    linkedin_author_id: Optional[str] = None  # LinkedIn person/org URN
    author_name: Optional[str] = None  # Display name for the author (person or company name)
    
    # Settings
    status: CampaignStatus = CampaignStatus.DRAFT
    auto_post: bool = False  # Auto-post without review
    
    # Analytics & Metrics
    posts_this_week: int = 0
    posts_this_month: int = 0
    total_posts: int = 0
    next_post_time: Optional[str] = None  # ISO datetime string
    last_post_time: Optional[str] = None
    last_generation_time: Optional[str] = None  # ISO datetime string - tracks when content was last generated
    
    # Metadata
    created_by: str
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Q1 Thought Leadership Campaign",
                "description": "Establish industry expertise through regular insights",
                "target_audience": {
                    "job_titles": ["CEO", "Marketing Director"],
                    "industries": ["Technology", "SaaS"],
                    "interests": ["Leadership", "Innovation"]
                },
                "content_pillars": ["Leadership Tips", "Industry Trends", "Product Insights"],
                "posting_schedule": {
                    "frequency": "weekly",
                    "time_slots": ["09:00", "14:00"]
                },
                "tone_voice": "professional",
                "content_types": ["text", "article"],
                "status": "active",
                "auto_post": False
            }
        }

# AI-Generated Posts Model
class AIGeneratedPostStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    POSTED = "posted"
    FAILED = "failed"

class AIGeneratedPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    campaign_id: str
    org_id: str
    
    # Content
    content: str  # Generated post text
    generation_prompt: str  # What was sent to AI
    content_pillar: Optional[str] = None  # Which pillar was used
    content_type: str = "text"  # text, article, poll, carousel
    image_url: Optional[str] = None  # Generated image URL (if include_images is enabled)
    
    # LinkedIn Publishing Info
    profile_type: Optional[str] = "personal"  # Where to publish (personal/company)
    author_name: Optional[str] = None  # Display name for calendar (person or company name)
    
    # Status & Scheduling
    status: AIGeneratedPostStatus = AIGeneratedPostStatus.PENDING_REVIEW
    scheduled_for: Optional[datetime] = None
    posted_at: Optional[datetime] = None
    
    # LinkedIn Integration
    linkedin_post_id: Optional[str] = None
    platform_url: Optional[str] = None
    
    # Performance Metrics
    performance_metrics: Optional[Dict] = None  # impressions, likes, comments, shares
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "campaign_id": "camp_123",
                "content": "5 leadership lessons I learned...",
                "generation_prompt": "Generate a post about leadership tips",
                "content_pillar": "Leadership Tips",
                "status": "pending_review"
            }
        }

# Campaign Analytics Model
class CampaignAnalytics(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    campaign_id: str
    
    # Post Counts
    total_posts: int = 0
    successful_posts: int = 0
    failed_posts: int = 0
    pending_review: int = 0
    
    # Engagement Metrics
    total_impressions: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    avg_engagement_rate: float = 0.0
    
    # Time Tracking
    last_run_at: Optional[datetime] = None
    last_post_at: Optional[datetime] = None
    
    # Content Performance
    best_performing_pillar: Optional[str] = None
    best_performing_time: Optional[str] = None
    
    # Metadata
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "campaign_id": "camp_123",
                "total_posts": 12,
                "successful_posts": 11,
                "failed_posts": 1,
                "total_impressions": 5000,
                "avg_engagement_rate": 4.5
            }
        }
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "campaign_id": "camp_123",
                "total_posts": 12,
                "successful_posts": 11,
                "failed_posts": 1,
                "total_impressions": 5000,
                "avg_engagement_rate": 4.5
            }
        }
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "campaign_id": "camp_123",
                "total_posts": 12,
                "successful_posts": 11,
                "failed_posts": 1,
                "total_impressions": 5000,
                "avg_engagement_rate": 4.5
            }
        }