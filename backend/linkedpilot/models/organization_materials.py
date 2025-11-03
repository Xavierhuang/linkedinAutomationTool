from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum
import uuid

class MaterialType(str, Enum):
    WEBSITE = "website"
    PDF = "pdf"
    IMAGE = "image"
    BLOG = "blog"
    DOCUMENT = "document"

class MaterialStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    ANALYZED = "analyzed"
    FAILED = "failed"

class OrganizationMaterial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str
    type: MaterialType
    name: str
    url: Optional[str] = None  # For websites and blogs
    file_path: Optional[str] = None  # For uploaded files
    content: Optional[str] = None  # Extracted text content
    status: MaterialStatus = MaterialStatus.PENDING
    
    # Metadata
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BrandAnalysis(BaseModel):
    """AI-extracted brand insights from materials"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str
    
    # Brand Identity
    brand_tone: List[str] = []  # e.g., ["professional", "innovative", "friendly"]
    brand_voice: str = "professional"  # professional, casual, thought-leader, storytelling
    key_messages: List[str] = []  # Core messages the brand communicates
    value_propositions: List[str] = []  # What they offer
    
    # Audience Insights
    target_audience: Dict = {
        "job_titles": [],
        "industries": [],
        "interests": [],
        "pain_points": []
    }
    
    # Content Strategy
    content_pillars: List[str] = []  # Main topics to post about
    expert_segments: List[str] = []  # Types of experts to target
    posting_themes: List[str] = []  # Recurring themes
    
    # Campaign Suggestions
    suggested_campaigns: List[Dict] = []  # Pre-configured campaign ideas
    
    # Analysis Metadata
    confidence_score: float = 0.0  # 0-1 confidence in analysis
    materials_analyzed: List[str] = []  # IDs of materials used
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CampaignGenerationRequest(BaseModel):
    org_id: str
    campaign_name: str
    focus_area: Optional[str] = None  # Specific focus for this campaign
    use_analysis: bool = True  # Whether to use brand analysis

class GeneratedCampaignConfig(BaseModel):
    """Auto-generated campaign configuration"""
    name: str
    description: str
    content_pillars: List[str]
    target_audience: Dict
    tone_voice: str
    posting_schedule: Dict
    content_types: List[str]
    include_images: bool
    draft_post_ideas: List[str]  # Sample post ideas
    reasoning: str  # Why these settings were chosen
