from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime
import uuid

class AnalyticsEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str
    org_id: str
    event_type: str  # impression, reaction, comment, share, click
    value: Dict  # {"count": 10, "delta": 2, ...}
    event_time: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "event_type": "impression",
                "value": {"count": 1500, "delta": 150},
                "event_time": "2025-10-27T12:00:00Z"
            }
        }