# 📋 Deployment Cheat Sheet - LinkedIn Pilot

## Server Credentials
```
IP: 138.197.35.30
User: root
Password: Hhwj65377068Hhwj
```

## 🚀 Quick Deploy Commands

### 1️⃣ On Windows (PowerShell)
```powershell
cd "H:\VIBE\Linkedin App\Linkedin-Pilot"
Compress-Archive -Path * -DestinationPath linkedin-pilot.zip -Force
scp linkedin-pilot.zip root@138.197.35.30:/root/
```

### 2️⃣ On Server (Copy & Paste This Block)
```bash
cd /root ; apt-get update ; apt-get install -y unzip ; unzip -o linkedin-pilot.zip -d /var/www/linkedin-pilot/ ; cd /var/www/linkedin-pilot ; chmod +x deploy.sh ; ./deploy.sh
```

### 3️⃣ Configure Environment
```bash
cd /var/www/linkedin-pilot
cp production.env.backend backend/.env
cp production.env.frontend frontend/.env
nano backend/.env  # Change JWT_SECRET_KEY!
```

### 4️⃣ Install Backend
```bash
cd /var/www/linkedin-pilot/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
```

### 5️⃣ Build Frontend
```bash
cd /var/www/linkedin-pilot/frontend
npm install
npm run build
```

### 6️⃣ Create Directories
```bash
mkdir -p /var/www/linkedin-pilot/logs /var/www/linkedin-pilot/backend/uploads
```

### 7️⃣ Start Services
```bash
cd /var/www/linkedin-pilot
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Run the command it outputs
```

### 8️⃣ Setup Nginx
```bash
cp /var/www/linkedin-pilot/nginx.conf /etc/nginx/sites-available/linkedin-pilot
ln -s /etc/nginx/sites-available/linkedin-pilot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t ; systemctl reload nginx
```

### 9️⃣ Verify
```bash
pm2 status
curl http://localhost:8000/api/health
```

### 🔟 Access
```
http://138.197.35.30
```

---

## 🔧 Useful Commands

### Status
```bash
pm2 status                  # Backend
systemctl status nginx      # Web server
systemctl status mongod     # Database
```

### Logs
```bash
pm2 logs                    # Backend logs
pm2 logs --lines 100        # Last 100 lines
tail -f /var/log/nginx/error.log
```

### Restart
```bash
pm2 restart linkedin-pilot-backend
systemctl restart nginx
systemctl restart mongod
```

### Stop
```bash
pm2 stop linkedin-pilot-backend
```

---

## 🆘 Troubleshooting

### Backend won't start
```bash
pm2 logs linkedin-pilot-backend
pm2 restart linkedin-pilot-backend
```

### Can't connect
```bash
ufw status
netstat -tulpn | grep -E '(80|8000)'
```

### MongoDB issues
```bash
systemctl status mongod
systemctl restart mongod
mongosh  # Test connection
```

### Frontend blank
```bash
ls /var/www/linkedin-pilot/frontend/build/
cd /var/www/linkedin-pilot/frontend ; npm run build
```

---

## 🔄 Update App

```bash
# Transfer files
scp -r * root@138.197.35.30:/var/www/linkedin-pilot/

# On server
cd /var/www/linkedin-pilot/frontend
npm run build
pm2 restart linkedin-pilot-backend
```

---

## 📝 Important Notes

- ⚠️ **Change JWT_SECRET_KEY** in `backend/.env`
- ⚠️ MongoDB runs on **localhost:27017**
- ⚠️ Backend API on **port 8000**
- ⚠️ Nginx serves on **port 80**
- ✅ Frontend at: `http://138.197.35.30`
- ✅ Backend at: `http://138.197.35.30/api`

---

## 🔐 Security Checklist

- [ ] Changed JWT_SECRET_KEY
- [ ] Firewall configured (ports 22, 80, 443)
- [ ] MongoDB not exposed externally
- [ ] PM2 startup configured
- [ ] Regular backups planned

---

**Full Guide**: See `ONE_CLICK_DEPLOY.md` or `DEPLOYMENT_GUIDE.md`







