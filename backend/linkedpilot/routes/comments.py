from fastapi import APIRouter, HTTPException
from datetime import datetime
import os

from ..models.comment import Comment
from ..adapters.linkedin_adapter import LinkedInAdapter

router = APIRouter(prefix="/comments", tags=["comments"])

def get_db():
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

@router.post("/{comment_id}/reply")
async def reply_to_comment(comment_id: str, text: str, org_id: str):
    """Reply to a LinkedIn comment"""
    db = get_db()
    
    # Get comment
    comment = await db.comments.find_one({"id": comment_id}, {"_id": 0})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Get org for access token
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Post reply via LinkedIn - pass dummy credentials to disable mock mode
    linkedin = LinkedInAdapter(client_id="from_user", client_secret="from_user")
    reply_data = await linkedin.post_comment_reply(
        org.get('linkedin_access_token', ''),
        comment['platform_comment_id'],
        text
    )
    
    # Update comment as replied
    await db.comments.update_one(
        {"id": comment_id},
        {"$set": {
            "replied": True,
            "reply_text": text,
            "replied_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {"comment_id": comment_id, "reply_id": reply_data.get('id'), "status": "sent"}