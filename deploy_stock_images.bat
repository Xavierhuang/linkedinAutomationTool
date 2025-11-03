@echo off
echo Deploying Stock Image Integration...
echo.

echo Step 1: Uploading backend files...
scp backend\linkedpilot\routes\drafts.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/routes/
scp backend\linkedpilot\utils\stock_image_fetcher.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/utils/

echo.
echo Step 2: Restarting backend...
ssh root@138.197.35.30 "pm2 restart linkedin-pilot-backend"

echo.
echo Step 3: Building frontend...
cd frontend
call npm run build

echo.
echo Step 4: Uploading frontend...
scp -r build/* root@138.197.35.30:/var/www/linkedin-pilot/frontend/build/

echo.
echo Step 5: Reloading nginx...
ssh root@138.197.35.30 "nginx -s reload"

echo.
echo ✅ Deployment complete!
echo.
echo IMPORTANT: Add API keys to environment variables:
echo - UNSPLASH_ACCESS_KEY=your_key (get from https://unsplash.com/developers)
echo - PEXELS_API_KEY=your_key (get from https://www.pexels.com/api/)
pause



echo Deploying Stock Image Integration...
echo.

echo Step 1: Uploading backend files...
scp backend\linkedpilot\routes\drafts.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/routes/
scp backend\linkedpilot\utils\stock_image_fetcher.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/utils/

echo.
echo Step 2: Restarting backend...
ssh root@138.197.35.30 "pm2 restart linkedin-pilot-backend"

echo.
echo Step 3: Building frontend...
cd frontend
call npm run build

echo.
echo Step 4: Uploading frontend...
scp -r build/* root@138.197.35.30:/var/www/linkedin-pilot/frontend/build/

echo.
echo Step 5: Reloading nginx...
ssh root@138.197.35.30 "nginx -s reload"

echo.
echo ✅ Deployment complete!
echo.
echo IMPORTANT: Add API keys to environment variables:
echo - UNSPLASH_ACCESS_KEY=your_key (get from https://unsplash.com/developers)
echo - PEXELS_API_KEY=your_key (get from https://www.pexels.com/api/)
pause



echo Deploying Stock Image Integration...
echo.

echo Step 1: Uploading backend files...
scp backend\linkedpilot\routes\drafts.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/routes/
scp backend\linkedpilot\utils\stock_image_fetcher.py root@138.197.35.30:/var/www/linkedin-pilot/backend/linkedpilot/utils/

echo.
echo Step 2: Restarting backend...
ssh root@138.197.35.30 "pm2 restart linkedin-pilot-backend"

echo.
echo Step 3: Building frontend...
cd frontend
call npm run build

echo.
echo Step 4: Uploading frontend...
scp -r build/* root@138.197.35.30:/var/www/linkedin-pilot/frontend/build/

echo.
echo Step 5: Reloading nginx...
ssh root@138.197.35.30 "nginx -s reload"

echo.
echo ✅ Deployment complete!
echo.
echo IMPORTANT: Add API keys to environment variables:
echo - UNSPLASH_ACCESS_KEY=your_key (get from https://unsplash.com/developers)
echo - PEXELS_API_KEY=your_key (get from https://www.pexels.com/api/)
pause






