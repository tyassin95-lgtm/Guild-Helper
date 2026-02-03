# Production Deployment Guide

This guide explains how to deploy the Guild Helper bot in a production environment with HTTPS support.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Nginx Reverse Proxy Configuration](#nginx-reverse-proxy-configuration)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [Application Configuration](#application-configuration)
- [Process Management with PM2](#process-management-with-pm2)
- [Troubleshooting](#troubleshooting)

## Overview

The Guild Helper bot consists of:
- **Discord Bot**: Runs in the background to handle Discord interactions
- **Web Server**: Express.js application that serves the web dashboard and OAuth2 authentication

In production, you need:
1. The Node.js application running on a local port (default: 3001)
2. A reverse proxy (nginx) to handle HTTPS and forward requests to the application
3. SSL certificates for HTTPS
4. A process manager (PM2) to keep the application running

## Prerequisites

- **Server**: A Linux server (Ubuntu 20.04+ recommended) with at least 1GB RAM
- **Domain Name**: A domain pointed to your server's IP address (e.g., oathly.net)
- **Node.js**: Version 16 or higher
- **MongoDB**: A MongoDB instance (local or remote like MongoDB Atlas)
- **Root Access**: Ability to install system packages and configure nginx

## Server Setup

### 1. Update System and Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install nginx
sudo apt install -y nginx

# Install certbot for SSL certificates
sudo apt install -y certbot python3-certbot-nginx

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Clone and Setup Application

```bash
# Clone the repository
cd /opt
sudo git clone https://github.com/tyassin95-lgtm/Guild-Helper.git
cd Guild-Helper

# Install dependencies
sudo npm install

# Create .env file
sudo cp .env.example .env
sudo nano .env
```

### 3. Configure Environment Variables

Edit the `.env` file with production values:

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_CALLBACK_URL=https://yourdomain.com/auth/discord/callback

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/guildhelper
# Or use MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/guildhelper

# Session Configuration
SESSION_SECRET=GENERATE_A_LONG_RANDOM_STRING_HERE

# Web Server Configuration
WEB_PORT=3001
WEB_BASE_URL=https://yourdomain.com

# Environment
NODE_ENV=production
```

**Important Notes:**
- Replace `yourdomain.com` with your actual domain (e.g., `oathly.net`)
- Generate a strong random string for `SESSION_SECRET`: `openssl rand -base64 32`
- The `DISCORD_CALLBACK_URL` must match exactly in Discord Developer Portal

## Nginx Reverse Proxy Configuration

### 1. Create Nginx Configuration

Create a new nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/guild-helper
```

Add the following configuration (replace `yourdomain.com` with your domain):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS (will be configured after SSL setup)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/guild-helper.access.log;
    error_log /var/log/nginx/guild-helper.error.log;

    # Proxy settings
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
        
        # Increase timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Increase body size for image uploads
    client_max_body_size 10M;
}
```

### 2. Enable the Configuration

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/guild-helper /etc/nginx/sites-enabled/

# Remove default site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

## SSL Certificate Setup

### 1. Obtain SSL Certificate with Let's Encrypt

**Important**: Before running certbot, make sure:
- Your domain's DNS A record points to your server's IP address
- Port 80 is open in your firewall
- Nginx is running

```bash
# Obtain certificate (replace yourdomain.com with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts:
# - Enter your email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: yes)
```

Certbot will automatically:
- Obtain the SSL certificate
- Update your nginx configuration
- Set up automatic renewal

### 2. Verify Auto-Renewal

```bash
# Test renewal process
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer
```

Certificates will automatically renew before they expire.

## Application Configuration

### 1. Update Discord Developer Portal

Go to [Discord Developer Portal](https://discord.com/developers/applications):

1. Select your application
2. Navigate to **OAuth2** section
3. Add redirect URI: `https://yourdomain.com/auth/discord/callback`
4. Click **Save Changes**

### 2. Verify Environment Variables

Double-check your `.env` file:

```bash
sudo nano /opt/Guild-Helper/.env
```

Ensure:
- `WEB_BASE_URL=https://yourdomain.com` (no trailing slash)
- `DISCORD_CALLBACK_URL=https://yourdomain.com/auth/discord/callback`
- `NODE_ENV=production`
- `SESSION_SECRET` is set to a strong random string

## Process Management with PM2

### 1. Start Application with PM2

```bash
cd /opt/Guild-Helper

# Start the application
sudo pm2 start src/index.js --name guild-helper

# Save PM2 process list
sudo pm2 save

# Set PM2 to start on system boot
sudo pm2 startup systemd
# Follow the command it outputs (usually starts with 'sudo env...')
```

### 2. Verify Application is Running

```bash
# Check PM2 status
sudo pm2 status

# View application logs
sudo pm2 logs guild-helper

# View last 50 lines of logs
sudo pm2 logs guild-helper --lines 50
```

You should see output like:
```
🌐 Web server running on https://yourdomain.com
Logged in as YourBot#1234!
✅ All systems initialized and running
```

### 3. PM2 Management Commands

```bash
# Restart application
sudo pm2 restart guild-helper

# Stop application
sudo pm2 stop guild-helper

# View detailed info
sudo pm2 info guild-helper

# Monitor resources
sudo pm2 monit
```

## Firewall Configuration

Configure your firewall to allow necessary ports:

```bash
# Allow SSH (if using UFW)
sudo ufw allow 22/tcp

# Allow HTTP (for Let's Encrypt and redirects)
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Enable firewall (if not already enabled)
sudo ufw enable

# Check status
sudo ufw status
```

## Verification Steps

1. **Check Application Logs**:
   ```bash
   sudo pm2 logs guild-helper --lines 100
   ```
   Look for: "Web server running on https://yourdomain.com"

2. **Test nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   ```

3. **Test Local Connection**:
   ```bash
   # Test root route (should redirect to /login)
   curl -L http://localhost:3001
   
   # Or test health endpoint
   curl http://localhost:3001/health
   ```
   Health endpoint should return: `{"status":"ok","timestamp":"..."}`
   Root URL should redirect to login page

4. **Test Public HTTPS**:
   - Open browser and go to `https://yourdomain.com`
   - Should automatically redirect to `https://yourdomain.com/login`
   - Should see the Guild Helper login page
   - Certificate should be valid (green padlock icon)

5. **Test OAuth Flow**:
   - Click "Sign in with Discord"
   - Should redirect to Discord authorization
   - After authorization, should redirect back to your site

## Troubleshooting

### Issue: "Page Not Found" or Connection Refused

**Possible Causes:**
1. Application not running on port 3001
2. Discord bot not logged in (web server starts after bot login)
3. MongoDB not connected
4. Nginx not configured correctly
5. Firewall blocking ports
6. DNS not pointing to correct IP

**Diagnosis Steps:**

```bash
# 1. Check if application is running
sudo pm2 status

# 2. Check application logs for errors
sudo pm2 logs guild-helper --lines 50

# Look for these key messages:
# - "Logged in as YourBot#1234!" (Discord bot connected)
# - "🌐 Web server running on..." (Web server started)
# - "✅ All systems initialized and running"

# 3. Check if port 3001 is listening
sudo netstat -tlnp | grep 3001

# 4. Test the application directly
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}

# 5. Test with redirect following
curl -L http://localhost:3001
# Should return login page HTML

# 6. Check nginx status and logs
sudo systemctl status nginx
sudo tail -f /var/log/nginx/guild-helper.error.log

# 7. Check nginx can reach the app
curl -H "Host: yourdomain.com" http://localhost:80
```

**Common Issues:**

1. **Discord bot authentication failed**: Check `DISCORD_TOKEN` in `.env` is correct
2. **MongoDB connection failed**: Check `MONGODB_URI` in `.env` and verify MongoDB is running
3. **Environment variables not loaded**: Restart PM2 after changing `.env`:
   ```bash
   sudo pm2 restart guild-helper
   ```

**Solutions:**

```bash
# Check if application is running
sudo pm2 status

# Check if port 3001 is listening
sudo netstat -tlnp | grep 3001

# Check nginx error logs
sudo tail -f /var/log/nginx/guild-helper.error.log

# Check application logs
sudo pm2 logs guild-helper

# Restart services
sudo pm2 restart guild-helper
sudo systemctl restart nginx
```

### Issue: SSL Certificate Errors

**Solutions:**

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check nginx SSL configuration
sudo nginx -t
```

### Issue: "Invalid OAuth2 redirect_uri"

**Solutions:**
1. Verify `DISCORD_CALLBACK_URL` in `.env` matches Discord Developer Portal exactly
2. Ensure you saved changes in Discord Developer Portal
3. Restart application after changing `.env`:
   ```bash
   sudo pm2 restart guild-helper
   ```

### Issue: Application Crashes or Restarts

**Solutions:**

```bash
# Check error logs
sudo pm2 logs guild-helper --err --lines 100

# Check MongoDB connection
# Test with: mongo or mongosh
# Or check MongoDB Atlas connection string

# Check memory usage
sudo pm2 monit

# Increase memory limit if needed
sudo pm2 delete guild-helper
sudo pm2 start src/index.js --name guild-helper --max-memory-restart 500M
sudo pm2 save
```

### Issue: DNS TTL Confusion

**Note**: DNS TTL (Time To Live) is measured in **seconds**, not port numbers.

Common TTL values:
- `300` = 5 minutes (good for testing)
- `3600` = 1 hour (standard)
- `86400` = 24 hours (production)

If your DNS shows `TTL: 3001`, change it to a proper value like `3600`.

### Issue: Port 3001 Not Accessible Externally

This is **expected behavior**. The application binds to `localhost:3001`, which means:
- ✅ Accessible from the same server (nginx → app)
- ❌ NOT accessible directly from the internet

This is a security feature. External traffic should go through nginx (port 443) which proxies to the application.

## Security Best Practices

1. **Never expose port 3001 to the internet** - Always use nginx as a reverse proxy
2. **Use strong SESSION_SECRET** - Generate with `openssl rand -base64 32`
3. **Keep dependencies updated** - Run `npm audit fix` regularly
4. **Use MongoDB authentication** - Don't use MongoDB without a password in production
5. **Monitor logs** - Regularly check `pm2 logs` for errors or suspicious activity
6. **Keep SSL certificates valid** - Let's Encrypt auto-renewal should handle this
7. **Use firewall** - Only allow necessary ports (22, 80, 443)
8. **Regular backups** - Back up MongoDB database regularly
9. **Update .gitignore** - Ensure `.env` is never committed to git

## Maintenance

### Update Application

```bash
cd /opt/Guild-Helper
sudo git pull origin main
sudo npm install
sudo pm2 restart guild-helper
```

### Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo pm2 update
```

### View Logs

```bash
# Application logs
sudo pm2 logs guild-helper

# Nginx access logs
sudo tail -f /var/log/nginx/guild-helper.access.log

# Nginx error logs
sudo tail -f /var/log/nginx/guild-helper.error.log
```

## Support

For issues or questions:
- Check the [OAUTH_SETUP.md](OAUTH_SETUP.md) for OAuth2 configuration
- Review application logs with `sudo pm2 logs guild-helper`
- Open an issue on the GitHub repository

## Summary

To deploy Guild Helper in production:

1. ✅ Install nginx, certbot, and PM2
2. ✅ Clone repository and install dependencies
3. ✅ Configure `.env` with production values
4. ✅ Set up nginx reverse proxy configuration
5. ✅ Obtain SSL certificate with Let's Encrypt
6. ✅ Update Discord Developer Portal redirect URI
7. ✅ Start application with PM2
8. ✅ Configure firewall
9. ✅ Test HTTPS access and OAuth flow

**The key point**: Your application runs on localhost:3001, and nginx (on port 443) forwards HTTPS requests to it. Never try to access port 3001 directly from the internet.
