# LinkedIn Pilot - Production Deployment Guide

This guide will help you deploy LinkedIn Pilot to your DigitalOcean server at `138.197.35.30`.

## 📋 Prerequisites

- Server: Ubuntu 22.04 or Debian 11+
- Root access via SSH
- At least 2GB RAM (4GB recommended)
- 20GB disk space

## 🚀 Quick Deployment (Automated)

### Step 1: Connect to Your Server

```bash
ssh root@138.197.35.30
# Password: Hhwj65377068Hhwj
```

### Step 2: Run Server Setup Script

Copy the `deploy.sh` script to your server and run it:

```bash
# On your local machine (from project root)
scp deploy.sh root@138.197.35.30:/root/

# On the server
ssh root@138.197.35.30
chmod +x /root/deploy.sh
/root/deploy.sh
```

This will install:
- Node.js 20.x
- Python 3.11
- MongoDB 7.0
- Nginx
- PM2
- Required system packages

### Step 3: Transfer Application Files

From your local machine, transfer the application:

```bash
# Create a clean deployment package (exclude node_modules, venv, etc.)
cd "H:\VIBE\Linkedin App\Linkedin-Pilot"

# Option A: Using rsync (recommended - faster, excludes unnecessary files)
rsync -avz --exclude 'node_modules' --exclude 'venv' --exclude '__pycache__' --exclude '.git' --exclude 'backend/uploads' . root@138.197.35.30:/var/www/linkedin-pilot/

# Option B: Using tar and scp (if rsync not available on Windows)
tar --exclude='node_modules' --exclude='venv' --exclude='__pycache__' --exclude='.git' --exclude='backend/uploads' -czf linkedin-pilot.tar.gz .
scp linkedin-pilot.tar.gz root@138.197.35.30:/var/www/
ssh root@138.197.35.30 "cd /var/www && tar -xzf linkedin-pilot.tar.gz -C linkedin-pilot && rm linkedin-pilot.tar.gz"
```

### Step 4: Configure Environment Variables

```bash
ssh root@138.197.35.30

cd /var/www/linkedin-pilot

# Backend environment
cp production.env.backend backend/.env

# IMPORTANT: Edit backend/.env and change JWT_SECRET_KEY
nano backend/.env
# Change JWT_SECRET_KEY to a random string (32+ characters)
# Example: JWT_SECRET_KEY=8f9d7c6b5a4e3d2c1b0a9f8e7d6c5b4a3e2d1c0b9a8f7e6d5c4b3a2e1d0c9b8a

# Frontend environment
cp production.env.frontend frontend/.env
```

### Step 5: Install Backend Dependencies

```bash
cd /var/www/linkedin-pilot/backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Deactivate
deactivate
```

### Step 6: Install Frontend Dependencies and Build

```bash
cd /var/www/linkedin-pilot/frontend

# Install dependencies
npm install

# Build for production
npm run build

# This creates a 'build' directory with optimized production files
```

### Step 7: Create Logs Directory

```bash
mkdir -p /var/www/linkedin-pilot/logs
mkdir -p /var/www/linkedin-pilot/backend/uploads
```

### Step 8: Set Up PM2 Process Manager

```bash
cd /var/www/linkedin-pilot

# Copy the ecosystem config
cp ecosystem.config.js /var/www/linkedin-pilot/

# Start the application
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs linkedin-pilot-backend

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Follow the command it outputs
```

### Step 9: Configure Nginx

```bash
# Copy nginx configuration
cp /var/www/linkedin-pilot/nginx.conf /etc/nginx/sites-available/linkedin-pilot

# Create symlink
ln -s /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx
```

### Step 10: Verify Deployment

1. **Check Backend**: 
   ```bash
   curl http://localhost:8000/api/health
   ```

2. **Check Frontend**: 
   Open browser to `http://138.197.35.30`

3. **Check PM2**:
   ```bash
   pm2 status
   pm2 logs
   ```

## 🔧 Manual Deployment Steps

If you prefer to deploy manually or the automated script doesn't work, follow these detailed steps:

### 1. Update System

```bash
apt-get update
apt-get upgrade -y
```

### 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v  # Should show v20.x
```

### 3. Install Python

```bash
apt-get install -y python3.11 python3.11-venv python3-pip
python3 --version
```

### 4. Install MongoDB

```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update
apt-get install -y mongodb-org
systemctl start mongod
systemctl enable mongod
systemctl status mongod
```

### 5. Install Nginx

```bash
apt-get install -y nginx
systemctl enable nginx
```

### 6. Install PM2

```bash
npm install -g pm2
```

### 7. Configure Firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Then proceed with Steps 3-10 from the Quick Deployment section above.

## 🔐 SSL/HTTPS Setup (Optional but Recommended)

If you have a domain name, you can set up free SSL with Let's Encrypt:

```bash
# Install certbot
apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate (replace your-domain.com)
certbot --nginx -d your-domain.com

# Certificate will auto-renew
```

## 🔍 Troubleshooting

### Backend not starting:

```bash
pm2 logs linkedin-pilot-backend
# Check for errors in environment variables or dependencies
```

### Frontend shows blank page:

```bash
# Check if build was successful
ls -la /var/www/linkedin-pilot/frontend/build/

# Check nginx logs
tail -f /var/log/nginx/error.log
```

### MongoDB connection issues:

```bash
# Check MongoDB status
systemctl status mongod

# Check MongoDB logs
tail -f /var/log/mongodb/mongod.log

# Test connection
mongosh
```

### Can't connect to API:

```bash
# Check if backend is running
pm2 status

# Test backend directly
curl http://localhost:8000/api/health

# Check nginx configuration
nginx -t
```

## 📝 Useful Commands

### PM2 Commands:

```bash
pm2 status                           # Show all processes
pm2 logs                             # Show all logs
pm2 logs linkedin-pilot-backend      # Show backend logs
pm2 restart linkedin-pilot-backend   # Restart backend
pm2 stop linkedin-pilot-backend      # Stop backend
pm2 delete linkedin-pilot-backend    # Remove process
pm2 monit                            # Monitor resources
```

### Nginx Commands:

```bash
systemctl status nginx      # Check status
systemctl restart nginx     # Restart nginx
nginx -t                    # Test configuration
tail -f /var/log/nginx/error.log   # View errors
```

### MongoDB Commands:

```bash
systemctl status mongod     # Check status
systemctl restart mongod    # Restart MongoDB
mongosh                     # MongoDB shell
```

## 🔄 Updating the Application

When you need to deploy updates:

```bash
# 1. Transfer updated files
rsync -avz --exclude 'node_modules' --exclude 'venv' . root@138.197.35.30:/var/www/linkedin-pilot/

# 2. SSH into server
ssh root@138.197.35.30

cd /var/www/linkedin-pilot

# 3. Update backend dependencies (if requirements.txt changed)
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

# 4. Rebuild frontend (if frontend changed)
cd ../frontend
npm install
npm run build

# 5. Restart backend
pm2 restart linkedin-pilot-backend

# 6. Reload nginx (if config changed)
systemctl reload nginx
```

## 📊 Monitoring

### Set up PM2 monitoring:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Monitor system resources:

```bash
htop
df -h
free -h
```

## 🆘 Support

If you encounter issues:

1. Check PM2 logs: `pm2 logs`
2. Check Nginx logs: `tail -f /var/log/nginx/error.log`
3. Check MongoDB: `systemctl status mongod`
4. Verify ports: `netstat -tulpn | grep LISTEN`

## 🎉 Post-Deployment

After successful deployment:

1. **Create first admin user** via the signup page
2. **Configure API keys** in Settings > API Providers
3. **Test LinkedIn OAuth** (optional)
4. **Set up backups** for MongoDB
5. **Monitor logs** regularly

---

Your LinkedIn Pilot application should now be live at: **http://138.197.35.30**

Enjoy your automated LinkedIn posting! 🚀



