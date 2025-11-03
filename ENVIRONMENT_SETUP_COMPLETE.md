# Environment Variables Setup - COMPLETE ✅

## Issue
Both frontend and backend had empty `.env` files causing:
- **Backend:** `KeyError: 'MONGO_URL'` - server couldn't start
- **Frontend:** `undefined/api/auth/login` - couldn't connect to backend

---

## Solution - Created Proper Environment Files

### Backend `.env` Created
**Location:** `backend/.env`

```env
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=linkedpilot

# JWT Secret Key
JWT_SECRET_KEY=your-secret-key-change-in-production-make-it-long-and-random

# LLM Configuration
LLM_MODEL=anthropic/claude-3.5-sonnet
IMAGE_MODEL=google/gemini-2.5-flash-image  # Gemini Nano Banana 🍌

# Mock Mode
MOCK_LLM=false
MOCK_IMAGE=false
```

### Frontend `.env` Created
**Location:** `frontend/.env`

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

---

## Status

✅ **MongoDB:** Running (Process ID: 5980)
✅ **Backend `.env`:** Created with all required variables
✅ **Frontend `.env`:** Created with backend URL
✅ **Backend:** Restarting with new environment variables
⚠️ **Frontend:** Needs restart to pick up new environment variables

---

## Next Steps

### 1. Restart Frontend (Required)
The frontend is currently running but doesn't have the new `REACT_APP_BACKEND_URL`. You need to restart it:

**Stop the current frontend:**
- Press `Ctrl+C` in the frontend terminal

**Restart it:**
```bash
cd frontend
npm start
```

Or use the batch file:
```bash
START_FRONTEND.bat
```

### 2. Verify Backend Started
Check the backend terminal - it should now show:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## What These Variables Do

### Backend Variables

| Variable | Purpose | Value |
|----------|---------|-------|
| `MONGO_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `DB_NAME` | Database name | `linkedpilot` |
| `JWT_SECRET_KEY` | JWT token encryption | (random secret) |
| `LLM_MODEL` | Default AI model for text | Claude 3.5 Sonnet |
| `IMAGE_MODEL` | Default image model | Gemini 2.5 Flash Image 🍌 |
| `MOCK_LLM` | Use mock AI responses | `false` (real AI) |
| `MOCK_IMAGE` | Use mock images | `false` (real images) |

### Frontend Variables

| Variable | Purpose | Value |
|----------|---------|-------|
| `REACT_APP_BACKEND_URL` | Backend API URL | `http://localhost:8000` |

---

## User API Keys

Users can add their own API keys in the Settings UI:
- **OpenAI API Key** - For GPT models
- **OpenRouter API Key** - For Claude, Gemini, and other models
- **LinkedIn Access Token** - For posting to LinkedIn

These are stored encrypted in MongoDB and take precedence over environment variables.

---

## Troubleshooting

### Backend Still Won't Start?
1. Make sure MongoDB is running: `Get-Process -Name mongod`
2. Check `.env` file exists: `Get-Content backend\.env`
3. Check for typos in environment variable names

### Frontend Still Shows "undefined/api..."?
1. **Restart the frontend** - environment variables are only loaded on startup
2. Check `.env` file: `Get-Content frontend\.env`
3. Make sure `REACT_APP_BACKEND_URL=http://localhost:8000` (no trailing slash)

### MongoDB Not Running?
Start MongoDB:
```bash
# Method 1: As a service
net start MongoDB

# Method 2: Directly
mongod --dbpath="C:\data\db"
```

---

## Date Created
October 14, 2025

**Status:** ✅ Environment variables configured
**Next:** Restart frontend to apply changes

