# Manual Deployment to mandi.media

## ✅ Server Confirmed Active

**Server**: 138.197.35.30  
**Domain**: mandi.media  
**Status**: Online ✅

---

## 📤 Step-by-Step Deployment

### Method 1: Using WinSCP (Easiest - GUI)

1. **Download WinSCP**: https://winscp.net/eng/download.php

2. **Connect**:
   - Protocol: SFTP
   - Host: `138.197.35.30`
   - Port: `22`
   - Username: `root`
   - Password: `Hhwj65377068Hhwj`

3. **Upload Files**:
   - Navigate to remote directory: `/var/www/linkedin-pilot/`
   - Upload these folders from your local project:
     - `backend/` (entire folder with all files)
     - `frontend/` (entire folder with all files)
     - `deploy.sh`
     - `nginx.conf`
     - `ecosystem.config.js`
     - `production.env.backend`
     - `production.env.frontend`

4. **Continue to "On The Server" section below**

---

### Method 2: Using Git (If you have Git repo)

```bash
ssh root@138.197.35.30
# Password: Hhwj65377068Hhwj

cd /var/www/linkedin-pilot
git clone <your-repo-url> .
```

---

### Method 3: Manual ZIP Transfer

1. **Create ZIP** (on Windows):
   - Right-click project folder → Send to → Compressed folder
   - Or use 7-Zip to create linkedin-pilot.zip

2. **Transfer using FileZilla**:
   - Download: https://filezilla-project.org/
   - Host: `sftp://138.197.35.30`
   - Username: `root`
   - Password: `Hhwj65377068Hhwj`
   - Upload zip to `/root/`

3. **Extract on server**:
```bash
ssh root@138.197.35.30
cd /root
unzip linkedin-pilot.zip -d /var/www/linkedin-pilot/
```

---

## 🔧 On The Server (After File Transfer)

Connect via SSH:
```bash
ssh root@138.197.35.30
# Password: Hhwj65377068Hhwj
```

### 1. Setup Environment

```bash
cd /var/www/linkedin-pilot

# Backend environment
cp production.env.backend backend/.env

# Frontend environment
cp production.env.frontend frontend/.env

# IMPORTANT: Generate secure JWT secret
nano backend/.env
# Change this line:
# JWT_SECRET_KEY=CHANGE_THIS_TO_A_VERY_LONG_RANDOM_STRING_FOR_PRODUCTION
# To something like:
# JWT_SECRET_KEY=$(openssl rand -hex 32)
```

### 2. Install Backend Dependencies

```bash
cd /var/www/linkedin-pilot/backend

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install packages
pip install --upgrade pip
pip install -r requirements.txt

# Deactivate
deactivate
```

### 3. Build Frontend

```bash
cd /var/www/linkedin-pilot/frontend

# Install dependencies
npm install

# Build for production
npm run build

# This creates the 'build' directory
```

### 4. Create Required Directories

```bash
mkdir -p /var/www/linkedin-pilot/logs
mkdir -p /var/www/linkedin-pilot/backend/uploads
```

### 5. Start Backend with PM2

```bash
cd /var/www/linkedin-pilot

# Start the app
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Save configuration
pm2 save

# Enable auto-start on boot
pm2 startup
# Run the command it outputs!
```

### 6. Configure Nginx

```bash
# Copy configuration
cp /var/www/linkedin-pilot/nginx.conf /etc/nginx/sites-available/linkedin-pilot

# Enable site
ln -s /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/

# Remove default
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

### 7. Verify Everything Works

```bash
# Check services
pm2 status
systemctl status nginx
systemctl status mongod

# Test backend
curl http://localhost:8000/api/health

# Should return: {"status":"healthy"}
```

---

## 🌐 Configure Domain DNS

To make **mandi.media** work, you need to:

1. **Go to your domain registrar** (where you bought mandi.media)

2. **Add/Update DNS A Record**:
   - Type: `A`
   - Name: `@` (or leave blank)
   - Value: `138.197.35.30`
   - TTL: `3600` (or automatic)

3. **Add WWW subdomain** (optional):
   - Type: `A`
   - Name: `www`
   - Value: `138.197.35.30`
   - TTL: `3600`

4. **Wait for DNS propagation** (5-30 minutes)

5. **Test**: Visit http://mandi.media in browser

---

## 🔒 Setup SSL/HTTPS (Recommended)

Once DNS is working:

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d mandi.media -d www.mandi.media

# Follow the prompts
# Certbot will automatically configure Nginx for HTTPS
```

Your site will be available at: **https://mandi.media**

---

## ✅ Access Your Application

- **Without DNS**: http://138.197.35.30
- **With DNS**: http://mandi.media
- **With SSL**: https://mandi.media

---

## 🔍 Troubleshooting

### Can't access website

```bash
# Check if Nginx is running
systemctl status nginx

# Check if port 80 is open
ufw status
netstat -tulpn | grep :80
```

### Backend not starting

```bash
# View logs
pm2 logs linkedin-pilot-backend

# Restart
pm2 restart linkedin-pilot-backend
```

### MongoDB issues

```bash
# Check status
systemctl status mongod

# Start if stopped
systemctl start mongod
systemctl enable mongod
```

### DNS not working

```bash
# Check DNS propagation
nslookup mandi.media
# Should return 138.197.35.30

# Or use online tool: https://dnschecker.org/
```

---

## 📞 Quick Commands Reference

```bash
# View logs
pm2 logs
pm2 logs linkedin-pilot-backend --lines 100

# Restart services
pm2 restart linkedin-pilot-backend
systemctl restart nginx

# Check status
pm2 status
systemctl status nginx
systemctl status mongod

# Monitor resources
pm2 monit
htop
```

---

## 🎉 Post-Deployment

1. ✅ Visit your site: http://mandi.media
2. ✅ Create admin account
3. ✅ Configure API keys in Settings
4. ✅ Test LinkedIn OAuth
5. ✅ Create your first campaign!

---

**Your LinkedIn Pilot is now live on mandi.media! 🚀**

Need help? Check the logs with `pm2 logs`







