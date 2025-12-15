# Text Editor Deployment Steps

## Summary of Changes

1. ✅ **Removed old TextOverlayModal.js** - Only Konva version remains
2. ✅ **Updated all imports** - All components now use TextOverlayModalKonva directly
3. ✅ **Created backend endpoints** - `/api/text-editor/projects` for saving/loading projects
4. ✅ **Created standalone editor page** - `/text-editor/:projectId?` route
5. ✅ **Updated navigation** - BeeBotDraftsView and CalendarView now navigate to standalone editor

## Files Changed

### Frontend:
- ✅ Deleted: `frontend/src/pages/linkedpilot/components/TextOverlayModal.js`
- ✅ Updated: `frontend/src/pages/linkedpilot/components/BeeBotDraftsView.js`
- ✅ Updated: `frontend/src/pages/linkedpilot/components/CalendarView.js`
- ✅ Updated: `frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js`
- ✅ Created: `frontend/src/pages/linkedpilot/components/TextEditorPage.js`
- ✅ Updated: `frontend/src/App.js` (added route)

### Backend:
- ✅ Created: `backend/linkedpilot/routes/text_editor.py`
- ✅ Updated: `backend/server.py` (added router)

## Deployment Steps

### Step 1: Deploy Backend Changes
```bash
# Copy backend files
pscp -P 22 backend/linkedpilot/routes/text_editor.py user@server:/path/to/backend/linkedpilot/routes/
pscp -P 22 backend/server.py user@server:/path/to/backend/

# Restart backend service
plink -P 22 user@server "pm2 restart linkedpilot-backend"
```

### Step 2: Deploy Frontend Changes
```bash
# Copy frontend files
pscp -P 22 frontend/src/pages/linkedpilot/components/TextEditorPage.js user@server:/path/to/frontend/src/pages/linkedpilot/components/
pscp -P 22 frontend/src/pages/linkedpilot/components/TextOverlayModalKonva.js user@server:/path/to/frontend/src/pages/linkedpilot/components/
pscp -P 22 frontend/src/pages/linkedpilot/components/BeeBotDraftsView.js user@server:/path/to/frontend/src/pages/linkedpilot/components/
pscp -P 22 frontend/src/pages/linkedpilot/components/CalendarView.js user@server:/path/to/frontend/src/pages/linkedpilot/components/
pscp -P 22 frontend/src/App.js user@server:/path/to/frontend/src/

# Build and restart frontend
plink -P 22 user@server "cd /path/to/frontend && npm run build && pm2 restart linkedpilot-frontend"
```

### Step 3: Verify Deployment
1. Test backend endpoint: `GET /api/text-editor/projects/{project_id}`
2. Test frontend route: Navigate to `/text-editor` with image URL
3. Test save functionality: Create a project and verify it saves
4. Test load functionality: Load an existing project by ID

## Testing Checklist

- [ ] Backend endpoints respond correctly
- [ ] Standalone editor page loads
- [ ] Editor opens with image from URL params
- [ ] Save creates new project with ID
- [ ] Load retrieves project by ID
- [ ] Navigation from BeeBotDraftsView works
- [ ] Navigation from CalendarView works
- [ ] All Konva features work in standalone mode








