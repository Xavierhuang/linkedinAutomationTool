"""
User Preferences Routes - For managing user-specific preferences and onboarding progress
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from server import db, get_current_user

router = APIRouter(prefix="/user-preferences", tags=["user-preferences"])

class OnboardingProgress(BaseModel):
    user_id: str
    current_step: int = 1
    completed_steps: Dict[str, bool] = {}
    org_id: Optional[str] = None
    website_url: Optional[str] = None
    description: Optional[str] = None
    saved_campaign_id: Optional[str] = None
    updated_at: Optional[str] = None

class SaveOnboardingProgressRequest(BaseModel):
    current_step: int = 1
    completed_steps: Dict[str, bool] = {}
    org_id: Optional[str] = None
    website_url: Optional[str] = None
    description: Optional[str] = None
    saved_campaign_id: Optional[str] = None

@router.get("/onboarding-progress")
async def get_onboarding_progress(
    user_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get onboarding progress for a user"""
    # Verify user can only access their own progress
    if current_user.get('id') != user_id:
        raise HTTPException(status_code=403, detail="Cannot access other user's progress")
    
    progress = await db.onboarding_progress.find_one({"user_id": user_id}, {"_id": 0})
    
    if not progress:
        # Return default progress if none exists
        return {
            "user_id": user_id,
            "current_step": 1,
            "completed_steps": {
                "step1": False,
                "step2": False,
                "step3": False,
                "step4": False,
                "step5": False
            },
            "org_id": None,
            "website_url": None,
            "description": None,
            "saved_campaign_id": None,
            "updated_at": None
        }
    
    return progress

@router.post("/onboarding-progress")
async def save_onboarding_progress(
    request: SaveOnboardingProgressRequest,
    user_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Save onboarding progress for a user"""
    # Verify user can only save their own progress
    if current_user.get('id') != user_id:
        raise HTTPException(status_code=403, detail="Cannot save other user's progress")
    
    progress_data = {
        "user_id": user_id,
        "current_step": request.current_step,
        "completed_steps": request.completed_steps,
        "org_id": request.org_id,
        "website_url": request.website_url,
        "description": request.description,
        "saved_campaign_id": request.saved_campaign_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.onboarding_progress.update_one(
        {"user_id": user_id},
        {"$set": progress_data},
        upsert=True
    )
    
    return {
        "status": "success",
        "message": "Onboarding progress saved",
        "progress": progress_data
    }

@router.delete("/onboarding-progress")
async def clear_onboarding_progress(
    user_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Clear onboarding progress for a user (for testing/reset)"""
    # Verify user can only clear their own progress
    if current_user.get('id') != user_id:
        raise HTTPException(status_code=403, detail="Cannot clear other user's progress")
    
    result = await db.onboarding_progress.delete_one({"user_id": user_id})
    
    return {
        "status": "success",
        "message": "Onboarding progress cleared"
    }
