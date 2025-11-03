# One-Click Deployment - LinkedIn Pilot

## 🚀 Simplest Way to Deploy (Windows)

### Option 1: PowerShell Script (Recommended)

Open **PowerShell** in the project directory and run:

```powershell
.\deploy-to-server.ps1
```

This script will:
1. ✅ Create a deployment package
2. ✅ Compress files into a zip
3. ✅ Transfer to your server
4. ✅ Show you the exact commands to run on the server

---

### Option 2: Manual but Simple

#### Step 1: Package the App (On Windows)

```powershell
# Open PowerShell and navigate to project
cd "H:\VIBE\Linkedin App\Linkedin-Pilot"

# Create deployment zip
Compress-Archive -Path * -DestinationPath linkedin-pilot.zip -Force
```

#### Step 2: Transfer to Server

**Using Command Line:**
```powershell
scp linkedin-pilot.zip root@138.197.35.30:/root/
# Password: Hhwj65377068Hhwj
```

**Or using WinSCP (GUI):**
1. Download from https://winscp.net/
2. Connect to `138.197.35.30` with username `root` and password `Hhwj65377068Hhwj`
3. Upload `linkedin-pilot.zip` to `/root/`

#### Step 3: Deploy on Server

Connect to server:
```bash
ssh root@138.197.35.30
# Password: Hhwj65377068Hhwj
```

Run these commands:
```bash
# Extract and setup
cd /root
apt-get update ; apt-get install -y unzip
unzip -o linkedin-pilot.zip -d /var/www/linkedin-pilot/
cd /var/www/linkedin-pilot

# Run automated setup
chmod +x deploy.sh
./deploy.sh

# Configure environment
cp production.env.backend backend/.env
cp production.env.frontend frontend/.env

# IMPORTANT: Edit backend/.env and change JWT_SECRET_KEY
nano backend/.env
# Change JWT_SECRET_KEY to something random like: 
# JWT_SECRET_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0

# Install backend dependencies
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Build frontend
cd ../frontend
npm install
npm run build

# Create directories
cd ..
mkdir -p logs backend/uploads

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Run the command it outputs

# Setup Nginx
cp nginx.conf /etc/nginx/sites-available/linkedin-pilot
ln -s /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

#### Step 4: Access Your App

Open browser to: **http://138.197.35.30**

---

## ⚡ Super Quick Deploy (Copy-Paste)

If you're comfortable with command line, copy and paste this entire block into your server SSH session:

```bash
cd /root && \
apt-get update && apt-get install -y unzip && \
unzip -o linkedin-pilot.zip -d /var/www/linkedin-pilot/ && \
cd /var/www/linkedin-pilot && \
chmod +x deploy.sh && \
./deploy.sh && \
cp production.env.backend backend/.env && \
cp production.env.frontend frontend/.env && \
echo "Now edit backend/.env to change JWT_SECRET_KEY, then run:" && \
echo "cd /var/www/linkedin-pilot && ./complete-deploy.sh"
```

Then create and run this helper script:

```bash
cat > /var/www/linkedin-pilot/complete-deploy.sh << 'EOF'
#!/bin/bash
set -e
cd /var/www/linkedin-pilot

# Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Frontend build
cd ../frontend
npm install
npm run build

# Directories
cd ..
mkdir -p logs backend/uploads

# PM2
pm2 start ecosystem.config.js
pm2 save

# Nginx
cp nginx.conf /etc/nginx/sites-available/linkedin-pilot
ln -sf /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "======================================"
echo "✓ Deployment Complete!"
echo "======================================"
echo "Access your app at: http://138.197.35.30"
echo ""
echo "Run 'pm2 startup' and execute the command it outputs"
echo "Then your app will auto-start on system reboot"
EOF

chmod +x /var/www/linkedin-pilot/complete-deploy.sh
nano /var/www/linkedin-pilot/backend/.env  # Edit JWT_SECRET_KEY
/var/www/linkedin-pilot/complete-deploy.sh
pm2 startup  # Run the command it outputs
```

---

## 🎯 Verification Checklist

After deployment, verify everything works:

- [ ] Backend running: `pm2 status`
- [ ] MongoDB running: `systemctl status mongod`
- [ ] Nginx running: `systemctl status nginx`
- [ ] Backend responds: `curl http://localhost:8000/api/health`
- [ ] Frontend loads: Visit `http://138.197.35.30` in browser
- [ ] Can create account and login

---

## 🆘 Quick Fixes

**Backend not starting?**
```bash
pm2 logs linkedin-pilot-backend
```

**Frontend blank page?**
```bash
ls -la /var/www/linkedin-pilot/frontend/build/
# Should see index.html and static/ directory
```

**Can't connect from browser?**
```bash
ufw status
# Make sure ports 80 and 443 are allowed
```

**MongoDB not running?**
```bash
systemctl start mongod
systemctl enable mongod
```

---

## 📞 Full Documentation

For detailed information, see:
- **QUICK_DEPLOY.md** - Step-by-step guide (5 minutes)
- **DEPLOYMENT_GUIDE.md** - Complete guide with troubleshooting

---

**Your LinkedIn Pilot will be live in under 10 minutes! 🚀**







