"""
Prompt Logger - Log all AI generation prompts with versioning and audit trail
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from typing import Dict, Optional
from linkedpilot.models.prompt_history import PromptHistory, PromptType, PromptAction
import uuid


def get_db():
    """Get database connection"""
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]


async def log_prompt(
    user_id: str,
    org_id: str,
    prompt_type: PromptType,
    action: PromptAction,
    text_prompt: Optional[str] = None,
    image_prompt: Optional[str] = None,
    carousel_prompt: Optional[Dict] = None,
    draft_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    ai_post_id: Optional[str] = None,
    model_used: Optional[str] = None,
    provider_used: Optional[str] = None,
    success: bool = True,
    error_message: Optional[str] = None,
    generated_content: Optional[str] = None,
    generated_image_url: Optional[str] = None
) -> str:
    """
    Log a prompt to the database with full audit trail
    
    Args:
        user_id: User who generated the content
        org_id: Organization ID
        prompt_type: Type of prompt (text, image, carousel)
        action: Action taken (created, edited, regenerated)
        text_prompt: Text generation prompt
        image_prompt: Image generation prompt
        carousel_prompt: Carousel generation prompt dict
        draft_id: Associated draft ID
        campaign_id: Associated campaign ID
        ai_post_id: Associated AI post ID
        model_used: AI model used
        provider_used: AI provider used
        success: Whether generation succeeded
        error_message: Error message if failed
        generated_content: Generated text content
        generated_image_url: Generated image URL
    
    Returns:
        Prompt history ID
    """
    db = get_db()
    
    # Determine version number
    version = 1
    if draft_id:
        existing = await db.prompt_history.find_one(
            {"draft_id": draft_id},
            sort=[("version", -1)]
        )
        if existing:
            version = existing.get('version', 0) + 1
    elif ai_post_id:
        existing = await db.prompt_history.find_one(
            {"ai_post_id": ai_post_id},
            sort=[("version", -1)]
        )
        if existing:
            version = existing.get('version', 0) + 1
    
    # Create prompt history entry
    prompt_entry = PromptHistory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        org_id=org_id,
        draft_id=draft_id,
        campaign_id=campaign_id,
        ai_post_id=ai_post_id,
        prompt_type=prompt_type,
        action=action,
        version=version,
        text_prompt=text_prompt,
        image_prompt=image_prompt,
        carousel_prompt=carousel_prompt,
        model_used=model_used,
        provider_used=provider_used,
        success=success,
        error_message=error_message,
        generated_content=generated_content,
        generated_image_url=generated_image_url
    )
    
    # Save to database
    await db.prompt_history.insert_one(prompt_entry.model_dump())
    
    print(f"[PROMPT_LOG] Saved prompt history: {prompt_entry.id}")
    print(f"   User: {user_id}, Type: {prompt_type}, Version: {version}, Action: {action}")
    
    return prompt_entry.id


async def get_prompt_history(
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
    draft_id: Optional[str] = None,
    campaign_id: Optional[str] = None,
    limit: int = 50
) -> list:
    """
    Retrieve prompt history
    
    Args:
        user_id: Filter by user
        org_id: Filter by org
        draft_id: Filter by draft
        campaign_id: Filter by campaign
        limit: Maximum results
    
    Returns:
        List of prompt history entries
    """
    db = get_db()
    
    query = {}
    if user_id:
        query['user_id'] = user_id
    if org_id:
        query['org_id'] = org_id
    if draft_id:
        query['draft_id'] = draft_id
    if campaign_id:
        query['campaign_id'] = campaign_id
    
    cursor = db.prompt_history.find(query).sort("created_at", -1).limit(limit)
    results = await cursor.to_list(length=limit)
    
    return results


async def get_prompt_by_id(prompt_id: str) -> Optional[Dict]:
    """Get a specific prompt history entry by ID"""
    db = get_db()
    result = await db.prompt_history.find_one({"id": prompt_id}, {"_id": 0})
    return result





