from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
import uuid

class Organization(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    website: Optional[str] = None
    linkedin_page_id: Optional[str] = None
    linkedin_access_token: Optional[str] = None
    linkedin_token_expires: Optional[datetime] = None
    ai_summary: Optional[Dict] = None
    brand_tone: Optional[str] = None
    keywords: Optional[List[str]] = []
    target_audience: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "TechCorp",
                "website": "https://techcorp.com",
                "linkedin_page_id": "12345678"
            }
        }