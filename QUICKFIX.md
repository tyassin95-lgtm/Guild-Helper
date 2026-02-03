# Quick Fix: Website Not Found Error

## Problem

You've set up your bot with:
- `WEB_BASE_URL=https://oathly.net`
- DNS pointing to your server
- Bot says "Web server running on https://oathly.net"

But when visiting the website, you get **"Page Not Found"** or connection errors.

## Root Cause

The bot application only listens on **localhost:3001**, which is not accessible from the internet. You need a **reverse proxy** (nginx) to handle HTTPS traffic on port 443 and forward it to your application.

## Quick Solution

Follow these steps in order:

### 1. Install nginx and certbot
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Create nginx configuration
```bash
sudo nano /etc/nginx/sites-available/guild-helper
```

Paste this configuration (replace `oathly.net` with your domain):
```nginx
server {
    listen 80;
    server_name oathly.net www.oathly.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name oathly.net www.oathly.net;

    ssl_certificate /etc/letsencrypt/live/oathly.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/oathly.net/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 10M;
}
```

### 3. Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/guild-helper /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Get SSL certificate
```bash
sudo certbot --nginx -d oathly.net -d www.oathly.net
```

Follow the prompts to complete SSL setup.

### 5. Open firewall ports
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 6. Verify it works
```bash
# Check app is running
curl http://localhost:3001

# Check nginx is forwarding
curl https://oathly.net
```

## Common Issues

### DNS TTL is set to 3001
**Issue**: TTL should be in seconds, not a port number.

**Fix**: Change DNS TTL from `3001` to `3600` (1 hour) or `300` (5 minutes for testing).

### Port 3001 not accessible from internet
**This is correct!** The application should only be accessible via nginx on ports 80/443. Port 3001 should NEVER be exposed to the internet.

### Certificate errors
```bash
# Check certificate
sudo certbot certificates

# Renew if needed
sudo certbot renew
```

## Full Documentation

For complete setup instructions including:
- Process management with PM2
- Security best practices
- MongoDB setup
- Troubleshooting guide

See the **[DEPLOYMENT.md](DEPLOYMENT.md)** guide.

## Summary

✅ App runs on localhost:3001 (not accessible from internet)  
✅ Nginx listens on port 443 (HTTPS)  
✅ Nginx forwards requests to localhost:3001  
✅ SSL certificates enable HTTPS  
✅ Your website is now accessible at https://oathly.net

**Key Point**: Never try to access port 3001 directly from the internet. Always go through nginx on port 443.
