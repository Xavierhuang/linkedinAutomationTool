# LinkedIn Pilot - AI-Powered LinkedIn Campaign Manager

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- MongoDB

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Environment Variables

Create `backend/.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=linkedpilot
JWT_SECRET_KEY=your-secret-key-here
```

## 🎯 Features

- **Organizations** - Manage multiple LinkedIn organizations
- **AI Campaigns** - Auto-generate LinkedIn campaigns from company materials
- **Content Generation** - AI-powered post creation
- **Review Queue** - Review and approve AI-generated posts
- **Calendar** - Visual scheduling with drag & drop
- **Analytics** - Track post performance
- **Organizational Materials** - Upload materials for AI brand analysis

## 📚 Documentation

- [Organizational Materials Setup](ORGANIZATIONAL_MATERIALS_SETUP.md)
- [Quick Start Guide](QUICK_START_ORGANIZATIONAL_MATERIALS.md)
- [UX Improvements](UX_IMPROVEMENTS_SUMMARY.md)

## 🔑 API Keys Required

Configure in Settings > API Providers:
- OpenAI API Key (recommended)
- OR OpenRouter API Key
- OR Google AI API Key

## 📝 License

[Your License Here]
