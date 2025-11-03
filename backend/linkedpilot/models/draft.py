from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum
import uuid

class DraftMode(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    CAROUSEL = "carousel"

class DraftStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SCHEDULED = "scheduled"

class Draft(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str
    campaign_id: Optional[str] = None
    author_id: str
    mode: DraftMode
    content: Dict  # {"title": "...", "body": "...", "hashtags": []}
    assets: Optional[List[Dict]] = []  # [{"type": "image", "url": "...", "s3_key": "..."}]
    status: DraftStatus = DraftStatus.DRAFT
    version: int = 1
    ai_edit_history: Optional[List[Dict]] = []  # Chat history
    linkedin_author_type: Optional[str] = "personal"  # "personal", "company", or "organization"
    linkedin_author_id: Optional[str] = None  # LinkedIn person ID or organization ID
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "mode": "text",
                "content": {
                    "body": "Exciting news! We're launching...",
                    "hashtags": ["#innovation", "#tech"]
                }
            }
        }