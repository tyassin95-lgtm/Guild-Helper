# Discord OAuth2 Setup Guide

This guide explains how to set up Discord OAuth2 authentication for the Oathly Guild Helper.

## Prerequisites

- A Discord application with bot functionality
- Access to the Discord Developer Portal
- MongoDB instance running

## Step 1: Configure Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application (or create a new one)
3. Navigate to the **OAuth2** section in the left sidebar

## Step 2: Add Redirect URIs

In the OAuth2 settings, add the following redirect URI:

- **Development**: `http://localhost:3001/auth/discord/callback`
- **Production**: `https://yourdomain.com/auth/discord/callback`

Click **Save Changes** after adding the redirect URI.

## Step 3: Get Your Credentials

From the OAuth2 section, copy:
- **Client ID** (already visible)
- **Client Secret** (click "Reset Secret" if needed and copy the new secret)

## Step 4: Configure Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_CALLBACK_URL=http://localhost:3001/auth/discord/callback

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/guildhelper

# Session Configuration
SESSION_SECRET=change-this-to-a-random-secret-string

# Web Server Configuration
WEB_PORT=3001
WEB_BASE_URL=http://localhost:3001

# Environment
NODE_ENV=development
```

### Environment Variable Descriptions

- `DISCORD_TOKEN`: Your bot token (from Bot section)
- `DISCORD_CLIENT_ID`: OAuth2 Client ID
- `DISCORD_CLIENT_SECRET`: OAuth2 Client Secret
- `DISCORD_CALLBACK_URL`: OAuth2 redirect URI (must match Developer Portal)
- `MONGODB_URI`: MongoDB connection string
- `SESSION_SECRET`: Random string for session encryption (generate a strong one for production)
- `WEB_PORT`: Port for the web server (default: 3001)
- `WEB_BASE_URL`: Base URL for the web application
- `NODE_ENV`: Environment (`development` or `production`)

## Step 5: OAuth2 Scopes

The application requests the following scopes:
- `identify`: Access to user's basic Discord profile
- `guilds`: Access to user's guild list

## Step 6: Start the Application

```bash
npm start
```

The web server will start on port 3001 (or your configured port).

## Step 7: Test the Login Flow

1. Navigate to `http://localhost:3001/login`
2. Click "Sign in with Discord"
3. Authorize the application
4. You should be redirected to your profile dashboard

## Security Notes

### Production Deployment

⚠️ **Important**: For production deployment with HTTPS, you need to set up a reverse proxy (nginx) and SSL certificates. See the **[DEPLOYMENT.md](DEPLOYMENT.md)** guide for complete instructions.

For production deployment, ensure:

1. **Use HTTPS**: Set `NODE_ENV=production` to enable secure cookies
2. **Strong Session Secret**: Generate a cryptographically strong random string for `SESSION_SECRET`
3. **Update Redirect URI**: Set `DISCORD_CALLBACK_URL` to your production domain
4. **Secure MongoDB**: Use authentication and secure connection string
5. **Environment Variables**: Never commit `.env` file to version control
6. **Reverse Proxy**: Set up nginx with SSL certificates (see [DEPLOYMENT.md](DEPLOYMENT.md))

### Session Configuration

Sessions are configured with:
- **HTTP-only cookies**: Prevents XSS attacks
- **SameSite=Lax**: Prevents CSRF attacks
- **Secure flag**: HTTPS-only in production
- **7-day expiration**: Users stay logged in for 7 days
- **MongoDB storage**: Sessions persist across server restarts

## Troubleshooting

### "Invalid OAuth2 redirect_uri"

- Ensure the `DISCORD_CALLBACK_URL` in `.env` matches exactly with the redirect URI in Discord Developer Portal
- Check that you saved changes in the Developer Portal

### "Authentication failed"

- Verify `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are correct
- Ensure the OAuth2 credentials haven't been reset in the Developer Portal

### "Cannot find guild"

- The bot must be in the same guild as the user
- User must have at least one mutual guild with the bot

### Session not persisting

- Check MongoDB connection
- Verify `SESSION_SECRET` is set
- Ensure cookies are enabled in the browser

## Migration from Token-Based Auth

The application now uses session-based authentication instead of temporary tokens:

### What Changed

- ✅ Profile dashboard: No longer needs token in URL (`/profile` instead of `/profile/:token`)
- ✅ Admin panel: No longer needs token in URL (`/admin-panel` instead of `/admin-panel/:token`)
- ✅ Persistent sessions: Users stay logged in across browser sessions
- ✅ Secure cookies: HTTP-only, SameSite protection
- ⚠️ Party editors: Still use token-based access (for now)

### Benefits

- **Better UX**: Users don't need new links for each session
- **More Secure**: Session-based auth with secure cookies
- **Persistent**: Sessions survive server restarts (stored in MongoDB)
- **Standard**: Uses industry-standard OAuth2 + Passport.js

## Support

For issues or questions, please open an issue on the GitHub repository.

## Known Issues

### Passport-Discord Deprecation

The `passport-discord` package is deprecated. While it still works, consider migrating to a maintained alternative in the future:
- `discord-strategy`
- `passport-discord-auth`

The current implementation will continue to work, but future Node.js versions may require an update to a maintained package.
