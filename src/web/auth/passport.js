/**
 * Passport Discord OAuth2 Configuration
 */
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

/**
 * Configure Passport with Discord OAuth2 strategy
 */
function configurePassport(collections, client) {
  // Serialize user to session (only store userId and guildId)
  passport.serializeUser((user, done) => {
    done(null, { userId: user.id, guildId: user.guildId });
  });

  // Deserialize user from session
  passport.deserializeUser(async (sessionData, done) => {
    try {
      // User data is already enriched in session
      done(null, sessionData);
    } catch (error) {
      done(error, null);
    }
  });

  // Discord OAuth2 Strategy
  const callbackURL = process.env.DISCORD_CALLBACK_URL;
  if (!callbackURL) {
    console.warn('⚠️  WARNING: DISCORD_CALLBACK_URL not set. Using localhost default.');
  }

  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: callbackURL || 'http://localhost:3001/auth/discord/callback',
    scope: ['identify', 'guilds']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Store access token for later use
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
      
      // Return profile to be serialized
      return done(null, profile);
    } catch (error) {
      return done(error, null);
    }
  }));

  return passport;
}

/**
 * Enrich session with Discord user and guild data
 */
async function enrichSessionData(req, collections, client) {
  if (!req.user || !req.user.id) {
    return;
  }

  try {
    // Store basic user info in session
    req.session.userId = req.user.id;
    req.session.username = req.user.username;
    req.session.discriminator = req.user.discriminator;
    req.session.avatar = req.user.avatar;
    req.session.accessToken = req.user.accessToken;
    
    // Get user's guilds from Discord
    const userGuilds = req.user.guilds || [];
    
    // Find a guild that the bot is also in
    let selectedGuild = null;
    for (const guild of userGuilds) {
      try {
        // Check if bot is in this guild
        const botGuild = await client.guilds.fetch(guild.id).catch(() => null);
        if (botGuild) {
          selectedGuild = guild;
          req.session.guildId = guild.id;
          req.session.guildName = guild.name;
          req.session.guildIcon = guild.icon;
          
          // Check if user is admin in this guild (permission check)
          // Discord permission bits: 0x8 = ADMINISTRATOR, 0x20 = MANAGE_GUILD
          const isAdmin = (guild.permissions & 0x8) === 0x8 || 
                         (guild.permissions & 0x20) === 0x20;
          req.session.isAdmin = isAdmin;
          
          // Fetch user's roles in this guild
          try {
            const member = await botGuild.members.fetch(req.user.id).catch(() => null);
            if (member) {
              // Store user's role IDs in session
              req.session.userRoles = member.roles.cache.map(role => role.id);
            } else {
              req.session.userRoles = [];
            }
          } catch (roleError) {
            console.error(`Error fetching user roles for guild ${guild.id}:`, roleError);
            req.session.userRoles = [];
          }
          
          break;
        }
      } catch (error) {
        console.error(`Error checking guild ${guild.id}:`, error);
      }
    }
    
    // If no common guild found, use the first guild
    if (!selectedGuild && userGuilds.length > 0) {
      selectedGuild = userGuilds[0];
      req.session.guildId = selectedGuild.id;
      req.session.guildName = selectedGuild.name;
      req.session.guildIcon = selectedGuild.icon;
      req.session.isAdmin = false;
    }
    
    // Fetch additional user data from database if exists
    if (req.session.guildId && collections.guildSettings) {
      const guildSettings = await collections.guildSettings.findOne({ 
        guildId: req.session.guildId 
      });
      
      if (guildSettings) {
        req.session.guildSettings = guildSettings;
      }
    }
    
  } catch (error) {
    console.error('Error enriching session data:', error);
  }
}

module.exports = {
  configurePassport,
  enrichSessionData
};
