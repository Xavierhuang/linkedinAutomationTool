# Centralized LinkedIn OAuth Implementation Guide

## Overview
Convert from per-user LinkedIn apps to ONE centralized LinkedIn app that handles OAuth for all users.

## Architecture Changes

### Before (Current)
```
User Settings Table:
- user_id
- linkedin_client_id (user provides)
- linkedin_client_secret (user provides)
- linkedin_access_token
```

### After (Centralized)
```
Environment Variables:
- LINKEDIN_CLIENT_ID (you provide, shared)
- LINKEDIN_CLIENT_SECRET (you provide, shared)
- LINKEDIN_REDIRECT_URI (you provide, shared)

User Settings Table:
- user_id
- linkedin_access_token (unique per user)
- linkedin_refresh_token (unique per user)
- linkedin_expires_at
- linkedin_connected (boolean)
```

## Implementation Steps

### Step 1: Create Centralized LinkedIn App

1. Go to https://developer.linkedin.com/
2. Create new app: "LinkedPilot" (or your app name)
3. Fill in details:
   - App name: LinkedPilot
   - Company: Your company
   - Privacy policy URL: Your URL
   - App logo: Your logo
4. Get credentials:
   - Client ID: `78xxxxxxxxxxxxx`
   - Client Secret: `xxxxxxxxxxxxxxxx`
5. Add Products:
   - Sign In with LinkedIn using OpenID Connect
   - Share on LinkedIn
   - Advertising API (if needed)
6. Set OAuth 2.0 redirect URLs:
   - Development: `http://localhost:8000/api/linkedin/callback`
   - Production: `https://yourdomain.com/api/linkedin/callback`

### Step 2: Update Backend Environment

**backend/.env:**
```env
# Centralized LinkedIn OAuth
LINKEDIN_CLIENT_ID=78xxxxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxxxxxxxxxx
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/linkedin/callback

# For production, use:
# LINKEDIN_REDIRECT_URI=https://yourdomain.com/api/linkedin/callback
```

### Step 3: Update Backend Code

**backend/linkedpilot/routes/linkedin_auth.py:**

```python
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
import os
import httpx
from datetime import datetime, timedelta

router = APIRouter(prefix="/linkedin", tags=["linkedin"])

# Centralized credentials from environment
LINKEDIN_CLIENT_ID = os.getenv('LINKEDIN_CLIENT_ID')
LINKEDIN_CLIENT_SECRET = os.getenv('LINKEDIN_CLIENT_SECRET')
LINKEDIN_REDIRECT_URI = os.getenv('LINKEDIN_REDIRECT_URI')

@router.get("/connect")
async def connect_linkedin(user_id: str):
    """
    Initiate LinkedIn OAuth flow
    User clicks "Connect LinkedIn" → This endpoint
    """
    if not LINKEDIN_CLIENT_ID:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth not configured")
    
    # Build authorization URL
    auth_url = (
        f"https://www.linkedin.com/oauth/v2/authorization"
        f"?response_type=code"
        f"&client_id={LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={LINKEDIN_REDIRECT_URI}"
        f"&state={user_id}"  # Pass user_id to identify user after callback
        f"&scope=openid profile email w_member_social"
    )
    
    return {"authorization_url": auth_url}

@router.get("/callback")
async def linkedin_callback(code: str, state: str):
    """
    LinkedIn redirects here after user approves
    Exchange code for access token
    """
    user_id = state  # Get user_id from state parameter
    
    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": LINKEDIN_CLIENT_ID,
                "client_secret": LINKEDIN_CLIENT_SECRET,
                "redirect_uri": LINKEDIN_REDIRECT_URI
            }
        )
        
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get access token")
        
        token_data = token_response.json()
        access_token = token_data['access_token']
        expires_in = token_data.get('expires_in', 5184000)  # Default 60 days
        
        # Get user's LinkedIn profile
        profile_response = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        profile_data = profile_response.json()
        linkedin_id = profile_data.get('sub')
        
        # Store in database
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_client = AsyncIOMotorClient(os.environ['MONGO_URL'])
        db = mongo_client[os.environ['DB_NAME']]
        
        await db.user_settings.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "linkedin_access_token": access_token,
                    "linkedin_expires_at": (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat(),
                    "linkedin_connected": True,
                    "linkedin_id": linkedin_id,
                    "linkedin_profile": profile_data,
                    "updated_at": datetime.utcnow().isoformat()
                }
            },
            upsert=True
        )
    
    # Redirect back to frontend
    return RedirectResponse(url=f"http://localhost:3000/dashboard/settings?linkedin=connected")

@router.post("/disconnect")
async def disconnect_linkedin(user_id: str):
    """
    Disconnect LinkedIn account
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = mongo_client[os.environ['DB_NAME']]
    
    await db.user_settings.update_one(
        {"user_id": user_id},
        {
            "$unset": {
                "linkedin_access_token": "",
                "linkedin_expires_at": "",
                "linkedin_id": "",
                "linkedin_profile": ""
            },
            "$set": {
                "linkedin_connected": False,
                "updated_at": datetime.utcnow().isoformat()
            }
        }
    )
    
    return {"success": True, "message": "LinkedIn disconnected"}

@router.get("/status")
async def linkedin_status(user_id: str):
    """
    Check if user has LinkedIn connected
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo_client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = mongo_client[os.environ['DB_NAME']]
    
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    
    if not settings:
        return {"connected": False}
    
    connected = settings.get('linkedin_connected', False)
    expires_at = settings.get('linkedin_expires_at')
    
    # Check if token expired
    if connected and expires_at:
        if datetime.fromisoformat(expires_at) < datetime.utcnow():
            connected = False
    
    return {
        "connected": connected,
        "profile": settings.get('linkedin_profile', {}) if connected else None,
        "expires_at": expires_at if connected else None
    }
```

### Step 4: Update Frontend

**frontend/src/pages/linkedpilot/components/SettingsView.js:**

Add LinkedIn connection section:

```javascript
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Linkedin, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LinkedInConnection = () => {
  const { user } = useAuth();
  const [linkedInStatus, setLinkedInStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLinkedInStatus();
  }, [user]);

  const checkLinkedInStatus = async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/linkedin/status?user_id=${user.id}`
      );
      setLinkedInStatus(response.data);
    } catch (error) {
      console.error('Error checking LinkedIn status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/linkedin/connect?user_id=${user.id}`
      );
      // Redirect to LinkedIn OAuth
      window.location.href = response.data.authorization_url;
    } catch (error) {
      console.error('Error connecting LinkedIn:', error);
      alert('Failed to connect LinkedIn');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect LinkedIn account?')) return;
    
    try {
      await axios.post(
        `${BACKEND_URL}/api/linkedin/disconnect?user_id=${user.id}`
      );
      setLinkedInStatus({ connected: false });
      alert('LinkedIn disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error);
      alert('Failed to disconnect LinkedIn');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
          <Linkedin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">LinkedIn Connection</h3>
          <p className="text-sm text-gray-600">
            Connect your LinkedIn account to post content
          </p>
        </div>
      </div>

      {linkedInStatus?.connected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Connected</span>
          </div>
          
          {linkedInStatus.profile && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <strong>Name:</strong> {linkedInStatus.profile.name}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Email:</strong> {linkedInStatus.profile.email}
              </p>
            </div>
          )}

          <Button
            onClick={handleDisconnect}
            variant="outline"
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            Disconnect LinkedIn
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-500">
            <XCircle className="w-5 h-5" />
            <span className="font-medium">Not Connected</span>
          </div>

          <Button
            onClick={handleConnect}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Linkedin className="w-4 h-4" />
            Connect LinkedIn Account
          </Button>
        </div>
      )}
    </div>
  );
};

export default LinkedInConnection;
```

### Step 5: Remove Old LinkedIn Settings UI

**Remove from Settings:**
- LinkedIn Client ID input field
- LinkedIn Client Secret input field
- LinkedIn Redirect URI input field

**Keep:**
- "Connect LinkedIn" button (new)
- Connection status display (new)

### Step 6: Update Posting Logic

**When posting, use user's stored token:**

```python
# backend/linkedpilot/routes/posts.py

async def post_to_linkedin(user_id: str, content: str):
    # Get user's LinkedIn token from database
    settings = await db.user_settings.find_one({"user_id": user_id})
    
    if not settings or not settings.get('linkedin_access_token'):
        raise HTTPException(status_code=400, detail="LinkedIn not connected")
    
    access_token = settings['linkedin_access_token']
    
    # Check if token expired
    expires_at = settings.get('linkedin_expires_at')
    if expires_at and datetime.fromisoformat(expires_at) < datetime.utcnow():
        raise HTTPException(status_code=401, detail="LinkedIn token expired. Please reconnect.")
    
    # Post to LinkedIn using the token
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json={
                "author": f"urn:li:person:{settings['linkedin_id']}",
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": content},
                        "shareMediaCategory": "NONE"
                    }
                },
                "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
            }
        )
    
    return response.json()
```

## Benefits

### For Users:
✅ One-click LinkedIn connection
✅ No need to create LinkedIn app
✅ No need to understand OAuth
✅ Simpler onboarding

### For You:
✅ Control the OAuth flow
✅ Better user experience
✅ Easier support
✅ Can add features centrally

### Security:
✅ Each user's token is separate
✅ Users only access their own LinkedIn
✅ Tokens stored securely per user
✅ Can revoke access anytime

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ 1. User clicks "Connect LinkedIn" in Settings           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Backend generates OAuth URL with YOUR app credentials│
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. User redirected to LinkedIn                          │
│    "LinkedPilot wants to access your LinkedIn"          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. User clicks "Allow"                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. LinkedIn redirects to YOUR callback URL              │
│    with authorization code                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Backend exchanges code for access token              │
│    Stores token in database for THIS user               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 7. User redirected back to Settings                     │
│    Shows "✓ LinkedIn Connected"                         │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

```javascript
// user_settings collection
{
  user_id: "user123",
  
  // OLD (remove these):
  // linkedin_client_id: "...",
  // linkedin_client_secret: "...",
  
  // NEW (keep these):
  linkedin_access_token: "AQV...",  // Unique per user
  linkedin_refresh_token: "AQW...", // For token refresh
  linkedin_expires_at: "2025-12-31T23:59:59Z",
  linkedin_connected: true,
  linkedin_id: "abc123",
  linkedin_profile: {
    name: "John Doe",
    email: "john@example.com",
    picture: "https://..."
  },
  
  // AI keys (still per-user)
  openai_api_key: "...",
  openrouter_api_key: "..."
}
```

## Next Steps

1. Create LinkedIn app at developer.linkedin.com
2. Add credentials to backend/.env
3. Implement new OAuth routes
4. Update frontend Settings UI
5. Test OAuth flow
6. Remove old LinkedIn settings fields
7. Deploy and test with real users

## Important Notes

- **LinkedIn API Review**: For production, you may need LinkedIn to review your app
- **Rate Limits**: LinkedIn has rate limits per app (not per user)
- **Token Expiry**: Tokens expire after 60 days, implement refresh logic
- **Scopes**: Request only necessary permissions
- **Privacy**: Update privacy policy to mention LinkedIn integration

