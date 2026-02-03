# Guild Helper Bot

A Discord bot for managing guilds, parties, events, and more in Throne and Liberty.

## 🚨 Important: Website "Not Found" Error?

If your bot is running but visiting your website shows **"Page Not Found"**, you need to set up a reverse proxy. The bot runs on `localhost:3001` and is not accessible from the internet without nginx.

**Quick Solution**: See **[QUICKFIX.md](QUICKFIX.md)** for immediate steps.  
**Full Guide**: See **[DEPLOYMENT.md](DEPLOYMENT.md)** for complete production setup.

## Features

- **Party Management**: Create and manage party compositions
- **Event Calendar**: Track PvP events and attendance
- **Wishlist System**: Track item wishlists for guild members
- **Gear Checking**: Upload and verify gear for party requirements
- **Auto Moderation**: Translation support and content moderation
- **Polls & Voting**: Create polls for guild decisions
- **Item Rolling**: Fair loot distribution system
- **OAuth Dashboard**: Web interface for managing settings

## Quick Start

### Prerequisites

- Node.js 16 or higher
- MongoDB (local or MongoDB Atlas)
- Discord Bot Token and OAuth2 credentials

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tyassin95-lgtm/Guild-Helper.git
   cd Guild-Helper
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your Discord tokens and MongoDB URI
   ```

4. **Set up Discord OAuth2** (see [OAUTH_SETUP.md](OAUTH_SETUP.md)):
   - Create a Discord application in the [Developer Portal](https://discord.com/developers/applications)
   - Add OAuth2 redirect URI: `http://localhost:3001/auth/discord/callback`
   - Copy Client ID and Client Secret to `.env`

5. **Start the bot**:
   ```bash
   npm start
   ```

6. **Access the web dashboard**:
   - Open `http://localhost:3001` in your browser
   - Sign in with Discord to manage settings

## Production Deployment

For production deployment with HTTPS and a custom domain, follow the comprehensive guide in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

This guide covers:
- Setting up nginx as a reverse proxy
- Installing SSL certificates with Let's Encrypt
- Process management with PM2
- Security best practices
- Troubleshooting common issues

**Quick Summary**: The application runs on `localhost:3001`, and you need nginx to handle HTTPS on port 443 and forward requests to the application.

## Documentation

- **[OAUTH_SETUP.md](OAUTH_SETUP.md)** - Complete OAuth2 setup guide for Discord authentication
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide with nginx and SSL
- **[PRIVACY_POLICY.md](PRIVACY_POLICY.md)** - Privacy policy for the bot
- **[TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md)** - Terms of service

## Configuration

Key environment variables (see `.env.example`):

```bash
# Discord Configuration
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_CALLBACK_URL=http://localhost:3001/auth/discord/callback

# MongoDB
MONGODB_URI=mongodb://localhost:27017/guildhelper

# Web Server
WEB_PORT=3001
WEB_BASE_URL=http://localhost:3001
NODE_ENV=development

# Session Security
SESSION_SECRET=change-this-to-random-string
```

## Support

- Open an issue on GitHub for bug reports or feature requests
- Check the troubleshooting sections in [OAUTH_SETUP.md](OAUTH_SETUP.md) and [DEPLOYMENT.md](DEPLOYMENT.md)

## License

This project is open source and available for use according to the repository license.

## Contributing

Contributions are welcome! Please open an issue or pull request for any improvements.
