from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
import os

from ..models.campaign import (
    Campaign, 
    CampaignStatus,
    TargetAudience,
    PostingSchedule,
    ToneVoice,
    CampaignDuration,
    AIGeneratedPost,
    CampaignAnalytics
)
from ..adapters.llm_adapter import LLMAdapter
from ..adapters.linkedin_adapter import LinkedInAdapter

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

async def resolve_author_name(org_id: str, profile_type: str, linkedin_author_id: Optional[str]) -> Optional[str]:
    """Resolve the display name for a LinkedIn author"""
    if not linkedin_author_id:
        return None
    
    db = get_db()
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        return None
    
    author_name = None
    if profile_type == 'company' or profile_type == 'organization':
        # Try to find company name from managed organizations
        linkedin_token = org.get('linkedin_access_token')
        if linkedin_token:
            try:
                linkedin = LinkedInAdapter(client_id="dummy", client_secret="dummy")
                linkedin.mock_mode = False
                managed_orgs = await linkedin.get_managed_organizations(linkedin_token)
                for managed_org in managed_orgs:
                    if str(managed_org.get('id')) == str(linkedin_author_id):
                        author_name = managed_org.get('name', managed_org.get('localizedName'))
                        break
            except Exception as e:
                print(f"   [WARNING] Could not fetch company name: {e}")
    else:
        # Personal profile
        linkedin_profile = org.get('linkedin_profile', {})
        author_name = linkedin_profile.get('name', 'Personal Profile')
    
    return author_name

from pydantic import BaseModel as PydanticBaseModel

# Request Models
class CampaignCreateRequest(PydanticBaseModel):
    org_id: str
    name: str
    description: Optional[str] = None
    target_audience: Optional[TargetAudience] = None
    content_pillars: List[str] = []
    posting_schedule: Optional[PostingSchedule] = None
    tone_voice: ToneVoice = ToneVoice.PROFESSIONAL
    content_types: List[str] = ["text"]
    duration: Optional[CampaignDuration] = None
    text_model: Optional[str] = "openai/gpt-4o-mini"
    include_images: bool = True
    use_ai_images: bool = True
    image_style: Optional[str] = "professional"
    image_model: Optional[str] = "google/gemini-2.5-flash-image"
    profile_type: Optional[str] = "personal"
    linkedin_author_id: Optional[str] = None
    status: CampaignStatus = CampaignStatus.DRAFT
    auto_post: bool = False
    created_by: str

class CampaignUpdateRequest(PydanticBaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_audience: Optional[TargetAudience] = None
    content_pillars: Optional[List[str]] = None
    posting_schedule: Optional[PostingSchedule] = None
    tone_voice: Optional[ToneVoice] = None
    content_types: Optional[List[str]] = None
    duration: Optional[CampaignDuration] = None
    text_model: Optional[str] = None
    include_images: Optional[bool] = None
    use_ai_images: Optional[bool] = None
    image_style: Optional[str] = None
    image_model: Optional[str] = None
    profile_type: Optional[str] = None
    linkedin_author_id: Optional[str] = None
    status: Optional[CampaignStatus] = None
    auto_post: Optional[bool] = None
    updated_by: Optional[str] = None

class CampaignStatusUpdate(PydanticBaseModel):
    status: CampaignStatus

@router.post("", response_model=Campaign)
async def create_campaign(request: CampaignCreateRequest):
    """Create a new AI-powered campaign"""
    db = get_db()
    
    # Resolve author name if profile_type and linkedin_author_id are provided
    author_name = None
    if request.profile_type and request.linkedin_author_id:
        author_name = await resolve_author_name(request.org_id, request.profile_type, request.linkedin_author_id)
    
    # Validate and reject DALL-E models (deprecated)
    image_model = request.image_model or "google/gemini-2.5-flash-image"
    if image_model.lower() and ('dall-e' in image_model.lower() or image_model.lower().startswith('openai:')):
        print(f"[WARNING] DALL-E model detected in create: {image_model}, converting to Gemini")
        image_model = "google/gemini-2.5-flash-image"
    
    # Create campaign with all new fields
    campaign = Campaign(
        id=request.id if hasattr(request, 'id') else f"camp_{int(datetime.utcnow().timestamp() * 1000)}",
        org_id=request.org_id,
        name=request.name,
        description=request.description,
        target_audience=request.target_audience or TargetAudience(),
        content_pillars=request.content_pillars,
        posting_schedule=request.posting_schedule or PostingSchedule(),
        tone_voice=request.tone_voice,
        content_types=request.content_types,
        duration=request.duration or CampaignDuration(),
        text_model=request.text_model,
        include_images=request.include_images,
        use_ai_images=request.use_ai_images,
        image_style=request.image_style,
        image_model=image_model,
        profile_type=request.profile_type,
        linkedin_author_id=request.linkedin_author_id,
        author_name=author_name,
        status=request.status,
        auto_post=request.auto_post,
        created_by=request.created_by
    )
    
    # Convert to dict and handle datetime serialization
    campaign_dict = campaign.model_dump()
    campaign_dict['created_at'] = datetime.utcnow()
    campaign_dict['updated_at'] = datetime.utcnow()
    
    # Insert into MongoDB
    await db.campaigns.insert_one(campaign_dict)
    
    # Create initial analytics record
    analytics = CampaignAnalytics(campaign_id=campaign.id)
    await db.campaign_analytics.insert_one(analytics.model_dump())
    
    return campaign

@router.get("", response_model=List[Campaign])
async def list_campaigns(org_id: str):
    """List all campaigns for an organization"""
    db = get_db()
    campaigns = await db.campaigns.find({"org_id": org_id}, {"_id": 0}).to_list(length=100)
    
    # Convert datetime strings if needed
    for c in campaigns:
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
        if isinstance(c.get('updated_at'), str):
            c['updated_at'] = datetime.fromisoformat(c['updated_at'])
    
    return [Campaign(**c) for c in campaigns]

@router.get("/{campaign_id}", response_model=Campaign)
async def get_campaign(campaign_id: str):
    """Get campaign by ID"""
    db = get_db()
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if isinstance(campaign.get('created_at'), str):
        campaign['created_at'] = datetime.fromisoformat(campaign['created_at'])
    if isinstance(campaign.get('updated_at'), str):
        campaign['updated_at'] = datetime.fromisoformat(campaign['updated_at'])
    
    return Campaign(**campaign)
@router.put("/{campaign_id}", response_model=Campaign)
async def update_campaign(campaign_id: str, request: CampaignUpdateRequest):
    """Update an existing campaign"""
    db = get_db()
    
    # Get existing campaign
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Build update dict (only include fields that were provided)
    update_data = {}
    if request.name is not None:
        update_data['name'] = request.name
    if request.description is not None:
        update_data['description'] = request.description
    if request.target_audience is not None:
        update_data['target_audience'] = request.target_audience.model_dump()
    if request.content_pillars is not None:
        update_data['content_pillars'] = request.content_pillars
    if request.posting_schedule is not None:
        update_data['posting_schedule'] = request.posting_schedule.model_dump()
    if request.tone_voice is not None:
        update_data['tone_voice'] = request.tone_voice
    if request.content_types is not None:
        update_data['content_types'] = request.content_types
    if request.duration is not None:
        update_data['duration'] = request.duration.model_dump()
    if request.text_model is not None:
        update_data['text_model'] = request.text_model
    if request.include_images is not None:
        update_data['include_images'] = request.include_images
    if request.use_ai_images is not None:
        update_data['use_ai_images'] = request.use_ai_images
    if request.image_style is not None:
        update_data['image_style'] = request.image_style
    if request.image_model is not None:
        # Validate and reject DALL-E models (deprecated)
        image_model = request.image_model.lower()
        if 'dall-e' in image_model or image_model.startswith('openai:'):
            print(f"[WARNING] DALL-E model detected in update: {request.image_model}, converting to Gemini")
            update_data['image_model'] = "google/gemini-2.5-flash-image"
        else:
            update_data['image_model'] = request.image_model
    if request.profile_type is not None:
        update_data['profile_type'] = request.profile_type
    if request.linkedin_author_id is not None:
        update_data['linkedin_author_id'] = request.linkedin_author_id
    
    # Resolve author name if profile_type or linkedin_author_id changed
    if request.profile_type is not None or request.linkedin_author_id is not None:
        profile_type = request.profile_type if request.profile_type is not None else campaign.get('profile_type')
        linkedin_author_id = request.linkedin_author_id if request.linkedin_author_id is not None else campaign.get('linkedin_author_id')
        if profile_type and linkedin_author_id:
            author_name = await resolve_author_name(campaign['org_id'], profile_type, linkedin_author_id)
            if author_name:
                update_data['author_name'] = author_name
    
    if request.status is not None:
        update_data['status'] = request.status
    if request.auto_post is not None:
        update_data['auto_post'] = request.auto_post
    if request.updated_by is not None:
        update_data['updated_by'] = request.updated_by
    
    update_data['updated_at'] = datetime.utcnow()
    
    # Update in database
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": update_data}
    )
    
    # Return updated campaign
    updated_campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return Campaign(**updated_campaign)

@router.patch("/{campaign_id}/status")
async def update_campaign_status(campaign_id: str, request: CampaignStatusUpdate):
    """Update campaign status (activate/pause)"""
    db = get_db()
    
    # Check if campaign exists
    campaign = await db.campaigns.find_one({"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Update status
    await db.campaigns.update_one(
        {"id": campaign_id},
        {
            "$set": {
                "status": request.status,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"success": True, "status": request.status}

@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str):
    """Delete a campaign"""
    db = get_db()
    
    # Check if campaign exists
    campaign = await db.campaigns.find_one({"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Delete campaign
    await db.campaigns.delete_one({"id": campaign_id})
    
    # Delete related AI-generated posts
    await db.ai_generated_posts.delete_many({"campaign_id": campaign_id})
    
    # Delete analytics
    await db.campaign_analytics.delete_one({"campaign_id": campaign_id})
    
    return {"success": True, "message": "Campaign deleted successfully"}

@router.get("/{campaign_id}/analytics", response_model=CampaignAnalytics)
async def get_campaign_analytics(campaign_id: str):
    """Get analytics for a campaign"""
    db = get_db()
    
    # Get analytics
    analytics = await db.campaign_analytics.find_one({"campaign_id": campaign_id}, {"_id": 0})
    
    if not analytics:
        # Create default analytics if doesn't exist
        analytics = CampaignAnalytics(campaign_id=campaign_id)
        await db.campaign_analytics.insert_one(analytics.model_dump())
    
    return CampaignAnalytics(**analytics)


