from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import uuid
import secrets
import string
from motor.motor_asyncio import AsyncIOMotorClient
import os
import jwt

router = APIRouter(prefix="/text-editor", tags=["text-editor"])

def get_db():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    return client[os.environ['DB_NAME']]

async def get_user_id_from_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract user_id from JWT token"""
    if not authorization:
        return None
    
    try:
        # Remove "Bearer " prefix if present
        token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
        
        # Decode token (use same secret key as server.py)
        SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id")
    except Exception:
        return None

class TextEditorProject(BaseModel):
    id: Optional[str] = None
    image_url: str
    elements: List[Dict[str, Any]] = []
    preview_data_url: Optional[str] = None
    campaign_data: Optional[Dict[str, Any]] = None
    user_id: str
    org_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class CreateProjectRequest(BaseModel):
    image_url: str
    elements: List[Dict[str, Any]] = []
    preview_data_url: Optional[str] = None
    campaign_data: Optional[Dict[str, Any]] = None
    org_id: Optional[str] = None

class UpdateProjectRequest(BaseModel):
    image_url: Optional[str] = None
    elements: Optional[List[Dict[str, Any]]] = None
    preview_data_url: Optional[str] = None
    campaign_data: Optional[Dict[str, Any]] = None

class CreateSessionRequest(BaseModel):
    image_url: str
    elements: List[Dict[str, Any]] = []
    campaign_data: Optional[Dict[str, Any]] = None

def generate_short_token(length: int = 12) -> str:
    """Generate a short URL-safe token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

@router.post("/projects", response_model=Dict[str, Any])
async def create_project(
    request: CreateProjectRequest,
    user_id: Optional[str] = Depends(get_user_id_from_token)
):
    """Create a new text editor project"""
    db = get_db()
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    project_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    project = {
        "id": project_id,
        "image_url": request.image_url,
        "elements": request.elements or [],
        "preview_data_url": request.preview_data_url,
        "campaign_data": request.campaign_data,
        "user_id": user_id,
        "org_id": request.org_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.text_editor_projects.insert_one(project)
    
    return {"id": project_id, **project}

@router.get("/projects/{project_id}", response_model=Dict[str, Any])
async def get_project(project_id: str):
    """Get a text editor project by ID"""
    db = get_db()
    
    project = await db.text_editor_projects.find_one({"id": project_id})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Remove MongoDB _id field
    project.pop("_id", None)
    
    return project

@router.put("/projects/{project_id}", response_model=Dict[str, Any])
async def update_project(
    project_id: str,
    request: UpdateProjectRequest
):
    """Update a text editor project"""
    db = get_db()
    
    # Check if project exists
    existing = await db.text_editor_projects.find_one({"id": project_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Build update dict
    update_data = {"updated_at": datetime.utcnow()}
    if request.image_url is not None:
        update_data["image_url"] = request.image_url
    if request.elements is not None:
        update_data["elements"] = request.elements
    if request.preview_data_url is not None:
        update_data["preview_data_url"] = request.preview_data_url
    if request.campaign_data is not None:
        update_data["campaign_data"] = request.campaign_data
    
    await db.text_editor_projects.update_one(
        {"id": project_id},
        {"$set": update_data}
    )
    
    # Return updated project
    updated = await db.text_editor_projects.find_one({"id": project_id})
    updated.pop("_id", None)
    
    return updated

@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a text editor project"""
    db = get_db()
    
    result = await db.text_editor_projects.delete_one({"id": project_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project deleted successfully"}

@router.get("/projects", response_model=List[Dict[str, Any]])
async def list_projects(
    user_id: Optional[str] = None,
    org_id: Optional[str] = None,
    limit: int = 50
):
    """List text editor projects for a user or organization"""
    db = get_db()
    
    query = {}
    if user_id:
        query["user_id"] = user_id
    if org_id:
        query["org_id"] = org_id
    
    projects = await db.text_editor_projects.find(query).sort("updated_at", -1).limit(limit).to_list(length=limit)
    
    # Remove MongoDB _id fields
    for project in projects:
        project.pop("_id", None)
    
    return projects

@router.post("/sessions", response_model=Dict[str, Any])
async def create_session(request: CreateSessionRequest):
    """Create a temporary session with short token for text editor
    
    This endpoint stores image_url and elements temporarily and returns a short token.
    Sessions expire after 24 hours. Use this instead of passing data in URL query params.
    """
    db = get_db()
    
    # Generate short token (12 characters)
    session_token = generate_short_token(12)
    now = datetime.utcnow()
    expires_at = now + timedelta(hours=24)  # 24 hour expiration
    
    session = {
        "token": session_token,
        "image_url": request.image_url,
        "elements": request.elements or [],
        "campaign_data": request.campaign_data,
        "created_at": now,
        "expires_at": expires_at
    }
    
    await db.text_editor_sessions.insert_one(session)
    
    print(f"[TEXT EDITOR] Created session token: {session_token} (expires: {expires_at})")
    
    return {"token": session_token, "expires_at": expires_at.isoformat()}

@router.get("/sessions/{token}", response_model=Dict[str, Any])
async def get_session(token: str):
    """Get session data by token"""
    db = get_db()
    
    session = await db.text_editor_sessions.find_one({"token": token})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    # Check expiration
    expires_at = session.get("expires_at")
    if expires_at and datetime.utcnow() > expires_at:
        # Clean up expired session
        await db.text_editor_sessions.delete_one({"token": token})
        raise HTTPException(status_code=404, detail="Session expired")
    
    # Remove MongoDB _id field
    session.pop("_id", None)
    
    return {
        "image_url": session.get("image_url"),
        "elements": session.get("elements", []),
        "campaign_data": session.get("campaign_data")
    }








