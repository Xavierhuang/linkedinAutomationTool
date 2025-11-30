from fastapi import APIRouter, HTTPException, Depends
from typing import List
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os

from ..models.organization import Organization
from ..adapters.llm_adapter import LLMAdapter

router = APIRouter(prefix="/organizations", tags=["organizations"])

# Get DB
def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

@router.post("", response_model=Organization)
async def create_organization(org: Organization):
    """Create a new organization"""
    db = get_db()
    org_dict = org.model_dump()
    org_dict['created_at'] = org_dict['created_at'].isoformat() if org_dict.get('created_at') else datetime.utcnow().isoformat()
    org_dict['updated_at'] = datetime.utcnow().isoformat()
    
    await db.organizations.insert_one(org_dict)
    return org

@router.get("", response_model=List[Organization])
async def list_organizations(user_id: str):
    """List all organizations for a user"""
    db = get_db()
    orgs = await db.organizations.find({"created_by": user_id}).to_list(length=100)
    
    for org in orgs:
        if isinstance(org.get('created_at'), str):
            org['created_at'] = datetime.fromisoformat(org['created_at'])
        if isinstance(org.get('updated_at'), str):
            org['updated_at'] = datetime.fromisoformat(org['updated_at'])
    
    return [Organization(**org) for org in orgs]

@router.get("/{org_id}", response_model=Organization)
async def get_organization(org_id: str):
    """Get organization by ID"""
    db = get_db()
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    if isinstance(org.get('created_at'), str):
        org['created_at'] = datetime.fromisoformat(org['created_at'])
    if isinstance(org.get('updated_at'), str):
        org['updated_at'] = datetime.fromisoformat(org['updated_at'])
    
    return Organization(**org)

@router.delete("/{org_id}")
async def delete_organization(org_id: str):
    """Delete organization and all associated data"""
    db = get_db()
    
    # Check if organization exists
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Delete all associated data
    await db.organization_materials.delete_many({"org_id": org_id})
    await db.campaigns.delete_many({"org_id": org_id})
    await db.drafts.delete_many({"org_id": org_id})
    await db.scheduled_posts.delete_many({"org_id": org_id})
    
    # Delete the organization
    result = await db.organizations.delete_one({"id": org_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    return {"message": "Organization deleted successfully", "id": org_id}

@router.post("/{org_id}/disconnect-linkedin")
async def disconnect_linkedin(org_id: str):
    """Disconnect LinkedIn from organization and user settings"""
    db = get_db()
    
    # Get organization to find user_id (created_by)
    org = await db.organizations.find_one({"id": org_id})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Disconnect from organization
    result = await db.organizations.update_one(
        {"id": org_id},
        {"$unset": {
            "linkedin_access_token": "",
            "linkedin_token_expires": "",
            "linkedin_profile": "",
            "linkedin_sub": "",
            "linkedin_person_urn": "",
            "linkedin_organization_id": ""
        }, "$set": {
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    # ALSO disconnect from user_settings (shared connection)
    # Use created_by field instead of user_id
    user_id = org.get('created_by')
    if user_id:
        await db.user_settings.update_one(
            {"user_id": user_id},
            {"$unset": {
                "linkedin_access_token": "",
                "linkedin_token_expires": "",
                "linkedin_profile": "",
                "linkedin_sub": "",
                "linkedin_person_urn": "",
                "linkedin_organization_id": ""
            }, "$set": {
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
    
    return {"message": "LinkedIn disconnected successfully"}

@router.get("/{org_id}/summary")
async def get_organization_summary(org_id: str):
    """Get AI-generated organization summary"""
    db = get_db()
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Return existing summary or generate new one
    if org.get('ai_summary'):
        return org['ai_summary']
    
    # Generate new summary using LLM
    llm = LLMAdapter()
    summary = {
        "brand_tone": org.get('brand_tone', 'Professional and engaging'),
        "keywords": org.get('keywords', ['innovation', 'technology', 'business']),
        "target_audience": org.get('target_audience', 'Business professionals'),
        "recommended_campaigns": [
            "Thought leadership series",
            "Product announcement campaigns",
            "Customer success stories"
        ]
    }
    
    # Update org with summary
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"ai_summary": summary, "updated_at": datetime.utcnow().isoformat()}}
    )
    
    return summary