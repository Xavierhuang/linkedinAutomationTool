"""
Prompt History Model - Store all prompts with versioning and audit trail
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
from enum import Enum
import uuid


class PromptType(str, Enum):
    TEXT_GENERATION = "text_generation"
    IMAGE_GENERATION = "image_generation"
    CAROUSEL_GENERATION = "carousel_generation"


class PromptAction(str, Enum):
    CREATED = "created"
    EDITED = "edited"
    REGENERATED = "regenerated"
    COPIED = "copied"


class PromptHistory(BaseModel):
    """Store all AI generation prompts with version history"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    org_id: str
    
    # Reference to what was generated
    draft_id: Optional[str] = None
    campaign_id: Optional[str] = None
    ai_post_id: Optional[str] = None
    
    # Prompt details
    prompt_type: PromptType
    action: PromptAction = PromptAction.CREATED
    version: int = 1
    
    # Prompt data (JSON stored as dict)
    text_prompt: Optional[str] = None
    image_prompt: Optional[str] = None
    carousel_prompt: Optional[Dict] = None
    
    # Metadata
    model_used: Optional[str] = None
    provider_used: Optional[str] = None
    success: bool = True
    error_message: Optional[str] = None
    
    # Generated output reference
    generated_content: Optional[str] = None
    generated_image_url: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user_123",
                "org_id": "org_456",
                "draft_id": "draft_789",
                "prompt_type": "text_generation",
                "action": "created",
                "version": 1,
                "text_prompt": "Generate a LinkedIn post about AI automation for small businesses",
                "model_used": "gpt-4o",
                "provider_used": "openai",
                "success": True,
                "created_at": "2025-10-31T22:00:00Z"
            }
        }





