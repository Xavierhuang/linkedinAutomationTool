from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime
import uuid

class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    platform_comment_id: str
    author: Dict  # {"name": "...", "profile_url": "...", "avatar": "..."}
    text: str
    sentiment: Optional[float] = None  # -1 to 1
    ai_suggestion: Optional[str] = None
    moderated: bool = False
    replied: bool = False
    reply_text: Optional[str] = None
    replied_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "text": "Great post! Can you share more details?",
                "sentiment": 0.8,
                "ai_suggestion": "Thanks for your interest! Check out..."
            }
        }