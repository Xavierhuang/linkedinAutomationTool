# SSL Certificate Fix Guide for mandi.media

## Current Issue
- **Error**: `NET::ERR_CERT_AUTHORITY_INVALID`
- **Domain**: mandi.media
- **Server**: 138.197.35.30
- **Status**: SSL certificate is invalid or expired

## Problem
The SSL certificate from Let's Encrypt has expired or become invalid, causing browsers to show a security warning.

## Solution Methods

### Method 1: SSH Access (If Available)

If you can connect via SSH, run these commands on the server:

```bash
# 1. Check certificate status
sudo certbot certificates

# 2. Check certificate expiration
sudo openssl x509 -in /etc/letsencrypt/live/mandi.media/fullchain.pem -noout -dates

# 3. Renew certificate
sudo certbot renew --force-renewal

# 4. If renewal fails, obtain new certificate
sudo certbot certonly --nginx -d mandi.media -d www.mandi.media

# 5. Test nginx configuration
sudo nginx -t

# 6. Reload nginx
sudo systemctl reload nginx
```

### Method 2: Web Console Access (DigitalOcean/AWS/etc)

If SSH is not accessible, use your cloud provider's web console:

1. **Log into your cloud provider dashboard** (DigitalOcean, AWS, etc.)
2. **Open the web console/terminal** for your server
3. **Run the commands from Method 1**

### Method 3: Using PuTTY/plink (Windows)

If plink works, use the provided `fix_ssl_certificate.bat` script:

```batch
.\fix_ssl_certificate.bat
```

### Method 4: Manual Certificate Renewal

If automatic renewal fails, manually obtain a new certificate:

```bash
# Stop nginx temporarily
sudo systemctl stop nginx

# Obtain certificate using standalone mode
sudo certbot certonly --standalone -d mandi.media -d www.mandi.media

# Start nginx
sudo systemctl start nginx

# Reload nginx
sudo systemctl reload nginx
```

## Troubleshooting

### If Certificate Files Are Missing

```bash
# Check if certificate directory exists
ls -la /etc/letsencrypt/live/mandi.media/

# If missing, obtain new certificate
sudo certbot certonly --nginx -d mandi.media -d www.mandi.media
```

### If Nginx Configuration is Invalid

```bash
# Test nginx configuration
sudo nginx -t

# If errors, check the configuration file
sudo nano /etc/nginx/sites-available/linkedin-pilot

# Ensure SSL paths are correct:
# ssl_certificate /etc/letsencrypt/live/mandi.media/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/mandi.media/privkey.pem;
```

### If Port 80 is Blocked

Certbot needs port 80 open for validation. Check firewall:

```bash
# Check firewall status
sudo ufw status

# Allow HTTP and HTTPS if needed
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Verification

After fixing, verify the certificate:

1. **Check certificate status**:
   ```bash
   sudo certbot certificates
   ```

2. **Test in browser**: Visit `https://mandi.media`
   - Should show a valid SSL certificate
   - No security warnings

3. **Check certificate details**:
   ```bash
   sudo openssl x509 -in /etc/letsencrypt/live/mandi.media/fullchain.pem -noout -text | grep -A 2 "Validity"
   ```

## Auto-Renewal Setup

To prevent future issues, ensure auto-renewal is enabled:

```bash
# Check certbot timer status
sudo systemctl status certbot.timer

# Enable auto-renewal if not enabled
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run
```

## Expected Certificate Paths

- **Certificate**: `/etc/letsencrypt/live/mandi.media/fullchain.pem`
- **Private Key**: `/etc/letsencrypt/live/mandi.media/privkey.pem`
- **Chain**: `/etc/letsencrypt/live/mandi.media/chain.pem`

## Nginx Configuration

Ensure your nginx config includes:

```nginx
listen 443 ssl;
ssl_certificate /etc/letsencrypt/live/mandi.media/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/mandi.media/privkey.pem;
include /etc/letsencrypt/options-ssl-nginx.conf;
ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
```

## Contact Information

If you continue to have issues:
1. Check server logs: `sudo journalctl -u nginx -n 50`
2. Check certbot logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`
3. Verify DNS: `nslookup mandi.media`






