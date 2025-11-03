# Quick Deployment Script

## Frontend Deployment
```bash
cd frontend
npm run build
scp -r build/* root@138.197.35.30:/var/www/linkedin-pilot/frontend/build/
ssh root@138.197.35.30 "nginx -s reload"
```

## Backend Deployment
```bash
# Single file
scp backend/path/to/file.py root@138.197.35.30:/var/www/linkedin-pilot/backend/path/to/

# Restart backend
ssh root@138.197.35.30 "cd /var/www/linkedin-pilot/backend ; pm2 restart linkedin-pilot-backend"
```

## Important Notes
- **Frontend:** Always deploy to `/var/www/linkedin-pilot/frontend/build/` (not `/frontend/`)
- **Cache Busting:** index.html has meta tags to prevent aggressive browser caching
- **Nginx Cache:** Configured to never cache index.html, 30-day cache for JS/CSS, 90-day for images

## Frontend Deployment
```bash
cd frontend
npm run build
scp -r build/* root@138.197.35.30:/var/www/linkedin-pilot/frontend/build/
ssh root@138.197.35.30 "nginx -s reload"
```

## Backend Deployment
```bash
# Single file
scp backend/path/to/file.py root@138.197.35.30:/var/www/linkedin-pilot/backend/path/to/

# Restart backend
ssh root@138.197.35.30 "cd /var/www/linkedin-pilot/backend ; pm2 restart linkedin-pilot-backend"
```

## Important Notes
- **Frontend:** Always deploy to `/var/www/linkedin-pilot/frontend/build/` (not `/frontend/`)
- **Cache Busting:** index.html has meta tags to prevent aggressive browser caching
- **Nginx Cache:** Configured to never cache index.html, 30-day cache for JS/CSS, 90-day for images

## Frontend Deployment
```bash
cd frontend
npm run build
scp -r build/* root@138.197.35.30:/var/www/linkedin-pilot/frontend/build/
ssh root@138.197.35.30 "nginx -s reload"
```

## Backend Deployment
```bash
# Single file
scp backend/path/to/file.py root@138.197.35.30:/var/www/linkedin-pilot/backend/path/to/

# Restart backend
ssh root@138.197.35.30 "cd /var/www/linkedin-pilot/backend ; pm2 restart linkedin-pilot-backend"
```

## Important Notes
- **Frontend:** Always deploy to `/var/www/linkedin-pilot/frontend/build/` (not `/frontend/`)
- **Cache Busting:** index.html has meta tags to prevent aggressive browser caching
- **Nginx Cache:** Configured to never cache index.html, 30-day cache for JS/CSS, 90-day for images
