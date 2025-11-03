# Organizational Materials System - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Backend Setup

- [ ] **Install Python Dependencies**
  ```bash
  cd backend
  pip install -r requirements.txt
  ```
  
  New dependencies installed:
  - beautifulsoup4==4.12.3
  - aiofiles==24.1.0
  - python-docx==1.1.2
  - pdfplumber==0.11.4

- [ ] **Create Upload Directory**
  ```bash
  mkdir -p backend/uploads/materials
  ```

- [ ] **Verify MongoDB Connection**
  - Check MONGO_URL environment variable
  - Verify DB_NAME environment variable
  - Test connection

- [ ] **Configure API Keys**
  - Add OpenRouter API key OR
  - Add OpenAI API key OR
  - Add Google AI API key
  - Test API key validity

### 2. File Verification

- [ ] **New Backend Files Created**
  - `backend/linkedpilot/services/content_extractor.py` ✓
  - `backend/linkedpilot/services/campaign_generator.py` ✓
  - `backend/linkedpilot/services/README.md` ✓

- [ ] **Modified Backend Files**
  - `backend/linkedpilot/routes/organization_materials.py` ✓
  - `backend/linkedpilot/adapters/llm_adapter.py` ✓
  - `backend/requirements.txt` ✓

- [ ] **Modified Frontend Files**
  - `frontend/src/pages/linkedpilot/components/OrganizationMaterialsModal.js` ✓

- [ ] **Documentation Files**
  - `ORGANIZATIONAL_MATERIALS_SETUP.md` ✓
  - `QUICK_START_ORGANIZATIONAL_MATERIALS.md` ✓
  - `IMPLEMENTATION_SUMMARY.md` ✓
  - `SYSTEM_ARCHITECTURE.md` ✓
  - `DEPLOYMENT_CHECKLIST.md` ✓

### 3. Database Setup

- [ ] **Collections Created** (Auto-created on first use)
  - `organization_materials`
  - `brand_analysis`
  - `campaigns` (existing, enhanced)

- [ ] **Indexes** (Optional but recommended)
  ```javascript
  // MongoDB shell commands
  db.organization_materials.createIndex({ "org_id": 1 })
  db.organization_materials.createIndex({ "status": 1 })
  db.brand_analysis.createIndex({ "org_id": 1 }, { unique: true })
  ```

### 4. Environment Variables

- [ ] **Required Variables**
  ```bash
  MONGO_URL=mongodb://localhost:27017
  DB_NAME=linkedpilot
  ```

- [ ] **Optional Variables**
  ```bash
  OPENROUTER_API_KEY=your-key-here
  OPENAI_API_KEY=your-key-here
  GOOGLE_AI_API_KEY=your-key-here
  MOCK_LLM=false  # Set to true for testing without API
  ```

### 5. Frontend Build

- [ ] **Install Dependencies** (if needed)
  ```bash
  cd frontend
  npm install
  ```

- [ ] **Build for Production**
  ```bash
  npm run build
  ```

- [ ] **Verify Environment Variables**
  ```bash
  REACT_APP_BACKEND_URL=http://localhost:8000
  ```

## 🧪 Testing Checklist

### 1. Unit Tests

- [ ] **Test Content Extraction**
  ```python
  # Test website extraction
  from linkedpilot.services.content_extractor import ContentExtractor
  extractor = ContentExtractor()
  result = await extractor.extract_from_url("https://example.com")
  assert "content" in result
  ```

- [ ] **Test Campaign Generation**
  ```python
  # Test campaign generation
  from linkedpilot.services.campaign_generator import CampaignGenerator
  generator = CampaignGenerator(api_key="test-key")
  # Test with mock data
  ```

### 2. Integration Tests

- [ ] **Test Material Upload**
  ```bash
  curl -X POST "http://localhost:8000/api/organization-materials/upload" \
    -F "org_id=test-org" \
    -F "file=@test.pdf"
  ```

- [ ] **Test URL Addition**
  ```bash
  curl -X POST "http://localhost:8000/api/organization-materials/add-url?org_id=test-org&url=https://example.com&material_type=website"
  ```

- [ ] **Test Analysis**
  ```bash
  curl -X POST "http://localhost:8000/api/organization-materials/analyze?org_id=test-org"
  ```

- [ ] **Test Campaign Generation**
  ```bash
  curl -X POST "http://localhost:8000/api/organization-materials/generate-campaign" \
    -H "Content-Type: application/json" \
    -d '{"org_id":"test-org","campaign_name":"Test Campaign","use_analysis":true}'
  ```

### 3. End-to-End Tests

- [ ] **Complete User Flow**
  1. Open application
  2. Navigate to Campaigns tab
  3. Click "Organizational Materials"
  4. Upload a PDF file
  5. Add a website URL
  6. Click "Analyze & Generate Insights"
  7. Wait for analysis to complete
  8. Review suggested campaigns
  9. Click "Generate" on a campaign
  10. Verify campaign created in Campaigns tab

### 4. Error Handling Tests

- [ ] **Test without API key**
  - Should show clear error message
  - Should not crash

- [ ] **Test with invalid file**
  - Should reject invalid file types
  - Should show error message

- [ ] **Test with invalid URL**
  - Should handle gracefully
  - Should continue with other materials

- [ ] **Test with no materials**
  - Should show appropriate message
  - Should prevent analysis

## 🚀 Deployment Steps

### 1. Backend Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd backend
pip install -r requirements.txt

# 3. Create upload directory
mkdir -p uploads/materials

# 4. Set environment variables
export MONGO_URL="your-mongo-url"
export DB_NAME="linkedpilot"
export OPENROUTER_API_KEY="your-api-key"

# 5. Start backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend Deployment

```bash
# 1. Build frontend
cd frontend
npm run build

# 2. Deploy build folder
# Copy build/ to your web server
```

### 3. Verify Deployment

- [ ] Backend health check: `http://your-domain:8000/health`
- [ ] Frontend loads: `http://your-domain`
- [ ] API endpoints accessible
- [ ] File uploads work
- [ ] Analysis completes successfully
- [ ] Campaigns generate correctly

## 📊 Monitoring Setup

### 1. Application Logs

- [ ] **Backend Logs**
  ```bash
  # Check logs for errors
  tail -f backend/logs/app.log
  ```

- [ ] **Monitor Key Events**
  - Material uploads
  - Content extraction
  - Analysis requests
  - Campaign generation
  - Errors and failures

### 2. Performance Metrics

- [ ] **Track Response Times**
  - Upload: < 1 second
  - Extraction: 1-5 seconds
  - Analysis: 10-30 seconds
  - Campaign generation: 5-15 seconds

- [ ] **Monitor Resource Usage**
  - CPU usage
  - Memory usage
  - Disk space (uploads folder)
  - Database connections

### 3. Business Metrics

- [ ] **Track Usage**
  - Materials uploaded per day
  - Analyses performed
  - Campaigns generated
  - Success rate

## 🔒 Security Checklist

- [ ] **File Upload Security**
  - File type validation enabled
  - File size limits enforced
  - Unique file naming
  - No file execution

- [ ] **API Security**
  - API keys encrypted in database
  - HTTPS enabled (production)
  - CORS configured correctly
  - Rate limiting (optional)

- [ ] **Data Security**
  - Sensitive data encrypted
  - Proper access controls
  - Regular backups
  - Audit logging

## 📝 Post-Deployment Tasks

### 1. User Documentation

- [ ] Share `QUICK_START_ORGANIZATIONAL_MATERIALS.md` with users
- [ ] Create video tutorial (optional)
- [ ] Update main documentation
- [ ] Add to help center

### 2. Team Training

- [ ] Train support team on new features
- [ ] Document common issues
- [ ] Create troubleshooting guide
- [ ] Set up monitoring alerts

### 3. Feedback Collection

- [ ] Set up user feedback mechanism
- [ ] Monitor usage patterns
- [ ] Track error rates
- [ ] Collect feature requests

## 🐛 Troubleshooting Guide

### Common Issues

**Issue: "No API key configured"**
- Solution: Add API key in Settings > API Providers
- Verify: Check user_settings collection in MongoDB

**Issue: "Analysis failed"**
- Check: Backend logs for specific error
- Verify: API key is valid
- Try: Reduce number of materials

**Issue: "Content extraction failed"**
- Check: File is not corrupted
- Verify: URL is accessible
- Try: Different file format

**Issue: "Campaign generation failed"**
- Check: Brand analysis exists
- Verify: API key has sufficient credits
- Try: Simpler campaign name

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Run backend with verbose output
uvicorn main:app --log-level debug
```

## ✅ Final Verification

Before marking deployment complete:

- [ ] All tests passing
- [ ] Documentation updated
- [ ] Team trained
- [ ] Monitoring active
- [ ] Backup configured
- [ ] Rollback plan ready
- [ ] Users notified
- [ ] Support ready

## 📞 Support Contacts

- **Technical Issues**: [Your support email]
- **API Issues**: Check provider status pages
- **Database Issues**: [Your DBA contact]
- **Emergency**: [Your emergency contact]

## 🎉 Success Criteria

Deployment is successful when:

1. ✅ Users can upload materials
2. ✅ Content extraction works for all types
3. ✅ Analysis completes in < 30 seconds
4. ✅ Campaigns generate correctly
5. ✅ No critical errors in logs
6. ✅ Performance meets targets
7. ✅ Users report positive feedback

---

**Deployment Date**: _____________

**Deployed By**: _____________

**Version**: 1.0.0

**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete

**Notes**:
_____________________________________________
_____________________________________________
_____________________________________________
