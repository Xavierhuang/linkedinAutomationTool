# Quick Deployment Guide - LinkedIn Pilot

## 🚀 Fast Track Deployment (5 Minutes)

### Prerequisites
- Windows PowerShell or Git Bash
- SSH client (built into Windows 10+)

### Step 1: Transfer Files to Server

Open **PowerShell** and run:

```powershell
# Navigate to your project directory
cd "H:\VIBE\Linkedin App\Linkedin-Pilot"

# Create archive excluding unnecessary files
Compress-Archive -Path * -DestinationPath linkedin-pilot.zip -Force

# Transfer to server (you'll be prompted for password: Hhwj65377068Hhwj)
scp linkedin-pilot.zip root@138.197.35.30:/root/
```

### Step 2: SSH into Server

```powershell
ssh root@138.197.35.30
# Password: Hhwj65377068Hhwj
```

### Step 3: Run Setup Script

```bash
# Extract files
cd /root
apt-get install -y unzip
unzip linkedin-pilot.zip -d /var/www/linkedin-pilot/
cd /var/www/linkedin-pilot

# Run setup script
chmod +x deploy.sh
./deploy.sh

# This will take 5-10 minutes to install everything
```

### Step 4: Configure Environment

```bash
# Set up backend environment
cp production.env.backend backend/.env

# IMPORTANT: Generate a secure JWT secret
nano backend/.env
# Change JWT_SECRET_KEY to a random string like:
# JWT_SECRET_KEY=$(openssl rand -hex 32)

# Set up frontend environment
cp production.env.frontend frontend/.env
```

### Step 5: Install Dependencies

```bash
# Backend
cd /var/www/linkedin-pilot/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Frontend
cd /var/www/linkedin-pilot/frontend
npm install
npm run build
```

### Step 6: Create Required Directories

```bash
mkdir -p /var/www/linkedin-pilot/logs
mkdir -p /var/www/linkedin-pilot/backend/uploads
```

### Step 7: Start Application

```bash
cd /var/www/linkedin-pilot

# Start with PM2
pm2 start ecosystem.config.js

# Save configuration
pm2 save

# Enable startup on boot
pm2 startup
# Run the command it outputs
```

### Step 8: Configure Nginx

```bash
# Copy nginx config
cp /var/www/linkedin-pilot/nginx.conf /etc/nginx/sites-available/linkedin-pilot

# Enable site
ln -s /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx
```

### Step 9: Verify

```bash
# Check services
pm2 status
systemctl status nginx
systemctl status mongod

# Test backend
curl http://localhost:8000/api/health
```

### Step 10: Access Your App

Open browser to: **http://138.197.35.30**

---

## 🔧 Quick Troubleshooting

**Backend won't start?**
```bash
pm2 logs linkedin-pilot-backend
```

**Frontend shows blank?**
```bash
ls -la /var/www/linkedin-pilot/frontend/build/
```

**Can't connect?**
```bash
ufw status
netstat -tulpn | grep -E '(80|8000)'
```

---

## 📞 Need Help?

See the full **DEPLOYMENT_GUIDE.md** for detailed instructions and troubleshooting.

---

**That's it! Your LinkedIn Pilot should now be live! 🎉**







