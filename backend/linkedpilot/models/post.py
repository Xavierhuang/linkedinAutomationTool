from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime
import uuid

class Post(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scheduled_post_id: str
    org_id: str
    platform_post_id: Optional[str] = None  # LinkedIn URN
    platform_url: Optional[str] = None
    posted_at: Optional[datetime] = None
    metadata: Optional[Dict] = {}  # Store LinkedIn response
    impressions: int = 0
    reactions: int = 0
    comments: int = 0
    shares: int = 0
    clicks: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "platform_post_id": "urn:li:share:1234567890",
                "impressions": 1500,
                "reactions": 45
            }
        }