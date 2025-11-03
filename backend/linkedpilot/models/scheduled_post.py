from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum
import uuid

class PostStatus(str, Enum):
    SCHEDULED = "scheduled"
    QUEUED = "queued"
    POSTING = "posting"
    POSTED = "posted"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ScheduledPost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    draft_id: str
    org_id: str
    publish_time: datetime
    timezone: str = "UTC"
    status: PostStatus = PostStatus.SCHEDULED
    require_approval: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    idempotency_key: str = Field(default_factory=lambda: str(uuid.uuid4()))
    retries: int = 0
    max_retries: int = 3
    error_message: Optional[str] = None
    job_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "publish_time": "2025-10-27T09:00:00Z",
                "timezone": "America/New_York"
            }
        }