"""
Admin authentication middleware
Separate JWT tokens and validation for admin users
"""
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

security = HTTPBearer()

# Use separate JWT secret for admin tokens for added security
ADMIN_JWT_SECRET = os.environ.get('ADMIN_JWT_SECRET', os.environ.get('JWT_SECRET_KEY', 'your-admin-secret-key'))
ALGORITHM = "HS256"
ADMIN_TOKEN_EXPIRE_HOURS = 8  # Shorter expiry for security


def create_admin_token(user_id: str, role: str) -> str:
    """Create an admin JWT token with shorter expiry"""
    to_encode = {
        "user_id": user_id,
        "role": role,
        "type": "admin_access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=ADMIN_TOKEN_EXPIRE_HOURS)
    }
    encoded_jwt = jwt.encode(to_encode, ADMIN_JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt


def decode_admin_token(token: str) -> dict:
    """Decode and validate admin JWT token"""
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=[ALGORITHM])
        if payload.get("type") != "admin_access":
            raise HTTPException(status_code=403, detail="Not an admin token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Admin token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate admin token")


async def get_current_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Dependency to get current admin user from token"""
    from server import db  # Import from main server
    
    token = credentials.credentials
    payload = decode_admin_token(token)
    user_id = payload.get("user_id")
    role = payload.get("role")
    
    if role not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    # Get user from database
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Admin user not found")
    
    # Verify user has admin role in database
    if user.get('role') not in ['admin', 'superadmin']:
        raise HTTPException(
            status_code=403,
            detail="User does not have admin privileges"
        )
    
    return user


async def require_superadmin(
    admin_user: dict = Depends(get_current_admin_user)
):
    """Dependency to require superadmin role"""
    if admin_user.get('role') != 'superadmin':
        raise HTTPException(
            status_code=403,
            detail="Superadmin access required"
        )
    return admin_user


async def log_admin_activity(
    admin_id: str,
    action: str,
    target_user_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None
):
    """Log admin activity for audit trail"""
    from server import db
    import uuid
    
    log_entry = {
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "action": action,
        "target_user_id": target_user_id,
        "details": details or {},
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.admin_activity_logs.insert_one(log_entry)



