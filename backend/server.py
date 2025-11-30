from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
try:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]
    print(f"[SERVER] MongoDB connection configured: {mongo_url}")
    print(f"[SERVER] Database name: {os.environ.get('DB_NAME', 'linkedpilot')}")
except Exception as e:
    print(f"[SERVER] WARNING: MongoDB connection error: {e}")
    print(f"[SERVER] Server will start but database operations may fail")
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ.get('DB_NAME', 'linkedpilot')]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Lifespan event handlers
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown event handlers"""
    # Startup
    from linkedpilot.scheduler_service import start_scheduler
    import asyncio
    import threading
    
    # Run scheduler startup in background with its own event loop
    def start_scheduler_background():
        try:
            # Small delay to ensure main event loop is ready
            import time
            time.sleep(1)
            
            # Create new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            # Start scheduler
            start_scheduler()
            
            # Keep the loop running
            loop.run_forever()
        except Exception as e:
            print(f"[ERROR] Failed to start scheduler")
            print(f"   {str(e)}")
            print(f"   Server will continue without automated scheduling")
    
    # Start scheduler in a separate thread to avoid blocking
    scheduler_thread = threading.Thread(target=start_scheduler_background, daemon=True)
    scheduler_thread.start()
    
    print("[OK] Server startup complete - Scheduler initializing in background...")
    
    yield  # App runs here
    
    # Shutdown
    from linkedpilot.scheduler_service import stop_scheduler
    try:
        stop_scheduler()
    except Exception as e:
        print(f"⚠️  WARNING: Failed to stop scheduler: {e}")
    client.close()

# Create the main app without a prefix
app = FastAPI(lifespan=lifespan)

# Add CORS middleware FIRST, before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://192.168.0.101:3000",
        "https://mandi.media",
        "http://mandi.media",
        "https://admin.mandi.media",
        "http://admin.mandi.media",
        "http://localhost:3002",  # Local admin dashboard
        "http://localhost:4001"  # Admin dashboard on port 4001
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Password utilities
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_access_token(token)
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    onboarding_completed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class UserResponse(BaseModel):
    user: User

# Routes
@api_router.get("/")
async def root():
    return {"message": "Social Media Scheduler API"}

@api_router.post("/auth/signup", response_model=Token)
async def signup(user_create: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_create.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user_create.password)
    user = User(
        email=user_create.email,
        full_name=user_create.full_name
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    user_dict['hashed_password'] = hashed_password
    
    # Add subscription and usage tracking fields
    user_dict['role'] = 'user'
    user_dict['status'] = 'active'
    user_dict['subscription_tier'] = 'free'
    user_dict['subscription_status'] = 'active'
    user_dict['ai_tokens_used'] = 0
    user_dict['ai_tokens_limit'] = 1000  # Free tier
    user_dict['posts_this_month'] = 0
    user_dict['post_limit_per_month'] = 50  # Free tier
    user_dict['last_reset_date'] = datetime.now(timezone.utc).isoformat()
    user_dict['linkedin_connected'] = False
    user_dict['onboarding_completed'] = False
    
    await db.users.insert_one(user_dict)
    
    # Create access token
    access_token = create_access_token(data={"user_id": user.id})
    
    return Token(access_token=access_token, user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_login: UserLogin):
    """User login endpoint"""
    try:
        print(f"[LOGIN] Attempting login for email: {user_login.email}")
        
        # Find user
        user_dict = await db.users.find_one({"email": user_login.email})
        if not user_dict:
            print(f"[LOGIN] User not found: {user_login.email}")
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        print(f"[LOGIN] User found: {user_dict.get('id', 'N/A')}")
        
        # Check if user has hashed_password
        if 'hashed_password' not in user_dict:
            print(f"[LOGIN] ERROR: User {user_dict.get('id')} has no hashed_password field")
            raise HTTPException(status_code=500, detail="User account error - please contact support")
        
        # Verify password
        try:
            password_valid = verify_password(user_login.password, user_dict['hashed_password'])
            if not password_valid:
                print(f"[LOGIN] Invalid password for user: {user_login.email}")
                raise HTTPException(status_code=401, detail="Invalid email or password")
            print(f"[LOGIN] Password verified successfully")
        except Exception as e:
            print(f"[LOGIN] Password verification error: {e}")
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Parse datetime
        if isinstance(user_dict.get('created_at'), str):
            user_dict['created_at'] = datetime.fromisoformat(user_dict['created_at'])
        
        # Remove MongoDB _id and hashed_password before creating User model
        user_dict.pop('_id', None)
        user_dict.pop('hashed_password', None)
        
        try:
            user = User(**user_dict)
        except Exception as e:
            print(f"[LOGIN] ERROR creating User model: {e}")
            print(f"[LOGIN] User dict keys: {list(user_dict.keys())}")
            raise HTTPException(status_code=500, detail="User data error")
        
        # Create access token
        try:
            access_token = create_access_token(data={"user_id": user.id})
            print(f"[LOGIN] Access token created successfully")
        except Exception as e:
            print(f"[LOGIN] ERROR creating access token: {e}")
            raise HTTPException(status_code=500, detail="Token generation failed")
        
        print(f"[LOGIN] Login successful for user: {user.id}")
        return Token(access_token=access_token, user=user)
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print(f"[LOGIN] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    # Parse datetime
    if isinstance(current_user.get('created_at'), str):
        current_user['created_at'] = datetime.fromisoformat(current_user['created_at'])
    
    user = User(**current_user)
    return UserResponse(user=user)

@api_router.put("/auth/complete-onboarding")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    """Mark user onboarding as completed"""
    user_id = current_user.get('id')
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"onboarding_completed": True}}
    )
    
    if result.modified_count == 0:
        # Check if already true
        user = await db.users.find_one({"id": user_id})
        if user and user.get('onboarding_completed'):
            return {"status": "success", "message": "Already completed"}
        raise HTTPException(status_code=400, detail="Failed to update status")
        
    return {"status": "success"}

# Include LinkedPilot routes BEFORE including api_router into app
from linkedpilot.routes import (
    org_router,
    campaign_router,
    draft_router,
    scheduled_post_router,
    post_router,
    comment_router,
    linkedin_auth_router,
    settings_router,
    brand_router,
)
from linkedpilot.routes.ai_content import router as ai_content_router

# Import Canva router
from linkedpilot.routes.canva import router as canva_router

# Import Scheduler router
from linkedpilot.routes.scheduler import router as scheduler_router

# Import User Preferences router
from linkedpilot.routes.user_preferences import router as user_prefs_router

# Import Organization Materials router
from linkedpilot.routes.organization_materials import router as org_materials_router

# Import Admin and Billing routers
from linkedpilot.routes.admin import router as admin_router
from linkedpilot.routes.billing import router as billing_router

api_router.include_router(org_router)
api_router.include_router(campaign_router)
api_router.include_router(draft_router)
api_router.include_router(scheduled_post_router)
api_router.include_router(post_router)
api_router.include_router(comment_router)
api_router.include_router(linkedin_auth_router)
api_router.include_router(settings_router)
api_router.include_router(brand_router)
api_router.include_router(canva_router)
api_router.include_router(ai_content_router)
api_router.include_router(scheduler_router)
api_router.include_router(user_prefs_router)
api_router.include_router(org_materials_router)
api_router.include_router(admin_router)
api_router.include_router(billing_router)

# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)