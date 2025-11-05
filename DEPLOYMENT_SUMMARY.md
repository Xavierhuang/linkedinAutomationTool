# Deployment Summary - Campaign Image Model Updates

## Files Changed

### Backend Files (Need to be deployed):
1. `backend/linkedpilot/services/campaign_generator.py` - Default changed to `google/gemini-2.5-flash-image`
2. `backend/linkedpilot/routes/settings.py` - Default changed to `google/gemini-2.5-flash-image`
3. `backend/linkedpilot/scheduler_service.py` - Default changed to `google/gemini-2.5-flash-image`
4. `backend/linkedpilot/routes/ai_content.py` - Default changed to `google/gemini-2.5-flash-image`

### Frontend Files:
- `frontend/src/pages/linkedpilot/components/CampaignConfigModal.js` - Default and fallback changed to `google/gemini-2.5-flash-image`
- Frontend build completed successfully

### Admin Dashboard:
- Admin dashboard built successfully
- Ready to deploy

## Deployment Paths (per nginx config):

- **Admin Dashboard**: `/var/www/linkedin-pilot/admin-dashboard/build/`
- **Frontend**: `/var/www/linkedin-pilot/frontend/build/`
- **Backend**: `/var/www/linkedin-pilot/backend/`

## Manual Deployment Commands

If automated deployment fails, run these commands manually (password: Hhwj65377068Hhwj):

### 1. Deploy Admin Dashboard
```bash
scp -r admin-dashboard/build/* root@138.197.35.30:/var/www/linkedin-pilot/admin-dashboard/build/
```

### 2. Deploy Backend Files
```bash
scp backend/linkedpilot/services/campaign_generator.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/services/
scp backend/linkedpilot/routes/settings.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/routes/
scp backend/linkedpilot/scheduler_service.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/
scp backend/linkedpilot/routes/ai_content.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/routes/
```

### 3. Reload Nginx
```bash
ssh root@138.197.35.30 "nginx -s reload"
```

### 4. Restart Backend
```bash
ssh root@138.197.35.30 "cd /var/www/linkedin-pilot/backend ; pm2 restart linkedin-pilot-backend"
```

## Verification

After deployment, verify:
1. Check admin dashboard at: https://mandi.media/admin
2. Create a new campaign and verify default image model is "google/gemini-2.5-flash-image"
3. Edit existing campaign - saved image_model should persist
4. Check backend logs: `pm2 logs linkedin-pilot-backend`
