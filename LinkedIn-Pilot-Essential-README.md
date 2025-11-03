# LinkedIn Pilot - Essential Code Package

**Package Size:** ~0.24 MB (WhatsApp-ready)

## 📦 What's Included

### Frontend (React)
- All React components in `frontend/src/pages/linkedpilot/components/`
- `package.json` - Dependencies list
- `craco.config.js` - Build configuration

### Backend (FastAPI/Python)
- API routes in `backend/linkedpilot/routes/`
- Database models in `backend/linkedpilot/models/`
- Adapters (LinkedIn, AI, Images) in `backend/linkedpilot/adapters/`
- Utils and middleware
- `requirements.txt` - Python dependencies
- `server.py` - Main application entry point

### Documentation
- `README.md` - Main project README
- `SETUP_INSTRUCTIONS.md` - Quick setup guide
- `README_ESSENTIAL_FILES.md` - Package overview

## ⚡ Quick Start

### Frontend
```bash
cd frontend
yarn install
yarn start
# Runs on http://localhost:3000
```

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### MongoDB
```bash
mongod
# Or use MongoDB Atlas (cloud)
```

## 🔧 Environment Setup

**frontend/.env:**
```
REACT_APP_BACKEND_URL=http://localhost:8000
```

**backend/.env:**
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=linkedpilot
JWT_SECRET_KEY=your-secret-key-here
```

## ✨ Key Features

- ✅ AI Content Generation
- ✅ LinkedIn Integration
- ✅ Campaign Automation
- ✅ Calendar Scheduling
- ✅ Analytics Dashboard
- ✅ Multi-Organization Support

## 🐛 Recent Fixes (Latest Updates)

1. **React Hooks** - Fixed Rules of Hooks violations
2. **ESLint** - Added eslint-plugin-react-hooks
3. **Text Scaling** - Fixed zoom affecting text size
4. **Events** - Fixed passive event listener warnings

## 📝 Notes

- This package contains **only essential code files**
- No `node_modules`, `venv`, or build artifacts
- All backup files excluded
- Ready for WhatsApp sharing (under 25MB limit)

## 📞 Questions?

Refer to `SETUP_INSTRUCTIONS.md` for detailed setup help.

---

**Total Package:** ~240 KB  
**Last Updated:** November 1, 2025


