const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { EmbedBuilder } = require('discord.js');
const session = require('express-session');
const { default: MongoStore } = require('connect-mongo');
const passport = require('passport');
const { configurePassport, enrichSessionData } = require('./auth/passport');
const { requireAuth, requireAdmin, checkRoleLock } = require('./middleware/auth');

// Import roster and embed update functions
const { updateGuildRoster } = require('../features/parties/commands/guildroster');
const { updateEventEmbed } = require('../features/pvp/embed');
const { uploadToDiscordStorage } = require('../utils/discordStorage');
const { postGearCheckEmbed } = require('../features/parties/handlers/gearUploadHandler');
const { updateWishlistPanels } = require('../features/wishlist/commands/wishlists');

// Event type name mapping
const EVENT_TYPE_NAMES = {
  siege: 'Siege',
  riftstone: 'Riftstone Fight',
  boonstone: 'Boonstone Fight',
  wargames: 'Wargames',
  warboss: 'War Boss',
  guildevent: 'Guild Event'
};

class WebServer {
  constructor() {
    this.app = express();
    this.port = process.env.WEB_PORT || 3001; // Changed to 3001 to avoid conflict with StreamServer (port 3000)
    this.activeTokens = new Map(); // In-memory token storage
    this.staticPartyTokens = new Map(); // Tokens for static party editor
    this.profileTokens = new Map(); // Tokens for profile dashboard
    this.adminPanelTokens = new Map(); // Tokens for admin panel
    this.collections = null;
    this.client = null;
    this.server = null;
  }

  /**
   * Initialize the web server with database collections and Discord client
   */
  initialize(collections, client) {
    this.collections = collections;
    this.client = client;

    // Middleware
    this.app.use(cors());
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

    // Trust proxy - required when behind nginx reverse proxy
    // This ensures secure cookies work properly and req.protocol is correct
    if (process.env.NODE_ENV === 'production') {
      this.app.set('trust proxy', 1);
    }

    // Session configuration
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET environment variable is required in production');
      }
      console.warn('⚠️  WARNING: Using default SESSION_SECRET. Set SESSION_SECRET in .env for production!');
    }

    const sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      dbName: 'guildhelper',
      collectionName: 'sessions',
      touchAfter: 24 * 3600 // lazy session update - update session once per 24 hours
    });

    this.app.use(session({
      secret: sessionSecret || 'oathly-guild-helper-secret-change-me',
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
      }
    }));

    // Initialize Passport
    const passportInstance = configurePassport(collections, client);
    this.app.use(passportInstance.initialize());
    this.app.use(passportInstance.session());

    // Sync deserialized user data from req.user to req.session
    // This ensures req.session.userId is available after passport deserializes the user
    // Passport stores minimal data during serialize/deserialize, but we need it in req.session for auth checks
    // Note: This middleware performs a database query but rate limiting is not needed because:
    // 1. It only runs once per session (when req.session.userId is missing)
    // 2. It requires authentication (req.user must exist)
    // 3. After first run, req.session.userId is set and prevents further queries
    this.app.use(async (req, res, next) => {
      if (req.user && req.user.userId) {
        // User was deserialized by passport, ensure session has the userId
        if (!req.session.userId) {
          // Session data is missing, need to re-enrich from passport user data
          // This can happen if session store fails or session was cleared
          console.info(`Re-enriching session for user ${req.user.userId}`);
          req.session.userId = req.user.userId;
          req.session.guildId = req.user.guildId;
          
          // Try to get additional user data from database if available
          try {
            if (req.session.guildId && collections && collections.guildSettings) {
              const guildSettings = await collections.guildSettings.findOne({ 
                guildId: req.session.guildId 
              });
              if (guildSettings) {
                req.session.guildSettings = guildSettings;
              }
            }
          } catch (error) {
            // Log error but continue - missing guild settings is not critical
            // User can still access the dashboard with basic session data
            console.error('Error re-enriching session data:', error);
          }
        }
      }
      next();
    });

    // Disable caching for API routes to ensure fresh data
    this.app.use('/api', (req, res, next) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
      next();
    });

    // Serve static files
    this.app.use('/static', express.static(path.join(__dirname, 'public')));

    // Set view engine
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, 'views'));

    // Apply role lock check middleware globally (after authentication)
    this.app.use(checkRoleLock);

    // Register routes
    this.registerRoutes();

    console.log('✅ Web server initialized');
  }

  /**
   * Generate a secure token for party editor access
   */
  generateToken(eventId, userId, expiresIn = 3600000) { // 1 hour default
    const token = crypto.randomBytes(32).toString('hex');

    this.activeTokens.set(token, {
      eventId,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn
    });

    // Auto-cleanup expired token
    setTimeout(() => {
      this.activeTokens.delete(token);
    }, expiresIn);

    return token;
  }

  /**
   * Validate token and return associated data
   */
  validateToken(token) {
    const tokenData = this.activeTokens.get(token);

    if (!tokenData) {
      return { valid: false, error: 'Token not found' };
    }

    if (tokenData.expiresAt < Date.now()) {
      this.activeTokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, data: tokenData };
  }

  /**
   * Generate a secure token for static party editor access
   */
  generateStaticPartyToken(guildId, userId, expiresIn = 3600000) { // 1 hour default
    const token = crypto.randomBytes(32).toString('hex');

    this.staticPartyTokens.set(token, {
      guildId,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn
    });

    // Auto-cleanup expired token
    setTimeout(() => {
      this.staticPartyTokens.delete(token);
    }, expiresIn);

    return token;
  }

  /**
   * Validate static party token and return associated data
   */
  validateStaticPartyToken(token) {
    const tokenData = this.staticPartyTokens.get(token);

    if (!tokenData) {
      return { valid: false, error: 'Token not found' };
    }

    if (tokenData.expiresAt < Date.now()) {
      this.staticPartyTokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, data: tokenData };
  }

  /**
   * Generate a secure token for profile dashboard access
   */
  generateProfileToken(guildId, userId, expiresIn = 3600000) { // 1 hour default
    const token = crypto.randomBytes(32).toString('hex');

    this.profileTokens.set(token, {
      guildId,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn
    });

    // Auto-cleanup expired token
    setTimeout(() => {
      this.profileTokens.delete(token);
    }, expiresIn);

    return token;
  }

  /**
   * Validate profile token and return associated data
   */
  validateProfileToken(token) {
    const tokenData = this.profileTokens.get(token);

    if (!tokenData) {
      return { valid: false, error: 'Token not found' };
    }

    if (tokenData.expiresAt < Date.now()) {
      this.profileTokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, data: tokenData };
  }

  /**
   * Generate a secure token for admin panel access
   */
  generateAdminPanelToken(guildId, userId, expiresIn = 3600000) { // 1 hour default
    const token = crypto.randomBytes(32).toString('hex');

    this.adminPanelTokens.set(token, {
      guildId,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn
    });

    // Auto-cleanup expired token
    setTimeout(() => {
      this.adminPanelTokens.delete(token);
    }, expiresIn);

    return token;
  }

  /**
   * Validate admin panel token and return associated data
   */
  validateAdminPanelToken(token) {
    const tokenData = this.adminPanelTokens.get(token);

    if (!tokenData) {
      return { valid: false, error: 'Token not found' };
    }

    if (tokenData.expiresAt < Date.now()) {
      this.adminPanelTokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, data: tokenData };
  }

  /**
   * Register all routes
   */
  registerRoutes() {
    // ==========================================
    // Root and Authentication Routes
    // ==========================================

    // Root route - redirect to login
    this.app.get('/', (req, res) => {
      // If already logged in, redirect to profile
      if (req.session && req.session.userId) {
        return res.redirect('/profile');
      }
      res.redirect('/login');
    });

    // Login page
    this.app.get('/login', (req, res) => {
      // If already logged in, redirect to profile
      if (req.session && req.session.userId) {
        return res.redirect('/profile');
      }
      res.render('login');
    });

    // Initiate Discord OAuth
    this.app.get('/auth/discord', passport.authenticate('discord'));

    // Discord OAuth callback
    this.app.get('/auth/discord/callback',
      passport.authenticate('discord', { failureRedirect: '/login' }),
      async (req, res) => {
        try {
          // Enrich session with user data
          await enrichSessionData(req, this.collections, this.client);
          
          // Save session to persist the enriched data
          req.session.save((err) => {
            if (err) {
              console.error('Session save error during OAuth callback:', err, {
                userId: req.session.userId,
                sessionID: req.sessionID
              });
              return res.redirect('/login');
            }
            
            // Redirect to return URL or profile
            const returnTo = req.session.returnTo || '/profile';
            delete req.session.returnTo;
            res.redirect(returnTo);
          });
        } catch (error) {
          console.error('Error in OAuth callback:', error);
          res.redirect('/login');
        }
      }
    );

    // Logout
    this.app.get('/logout', (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        res.redirect('/login');
      });
    });

    // ==========================================
    // Protected Routes
    // ==========================================

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Party editor page
    this.app.get('/party-editor/:token', async (req, res) => {
      await this.handlePartyEditorPage(req, res);
    });

    // API: Get party data
    this.app.get('/api/party-editor/:token/data', async (req, res) => {
      await this.handleGetPartyData(req, res);
    });

    // API: Submit party changes
    this.app.post('/api/party-editor/:token/submit', async (req, res) => {
      await this.handleSubmitParties(req, res);
    });

    // API: Preview DM for a member
    this.app.post('/api/party-editor/:token/preview', async (req, res) => {
      await this.handlePreviewDM(req, res);
    });

    // Static Party Editor routes
    this.app.get('/static-party-editor/:token', async (req, res) => {
      await this.handleStaticPartyEditorPage(req, res);
    });

    // API: Get static party data
    this.app.get('/api/static-party-editor/:token/data', async (req, res) => {
      await this.handleGetStaticPartyData(req, res);
    });

    // API: Save static party changes
    this.app.post('/api/static-party-editor/:token/save', async (req, res) => {
      await this.handleSaveStaticParties(req, res);
    });

    // Profile dashboard page
    this.app.get('/profile', requireAuth, async (req, res) => {
      await this.handleProfilePage(req, res);
    });

    // API: Get profile data
    this.app.get('/api/profile/data', requireAuth, async (req, res) => {
      await this.handleGetProfileData(req, res);
    });

    // API: Update player info
    this.app.post('/api/profile/update-info', requireAuth, async (req, res) => {
      await this.handleUpdatePlayerInfo(req, res);
    });

    // API: Get events data
    this.app.get('/api/profile/events', requireAuth, async (req, res) => {
      await this.handleGetProfileEvents(req, res);
    });

    // API: Update event RSVP
    this.app.post('/api/profile/event-rsvp', requireAuth, async (req, res) => {
      await this.handleProfileEventRsvp(req, res);
    });

    // API: Record event attendance
    this.app.post('/api/profile/event-attendance', requireAuth, async (req, res) => {
      await this.handleProfileEventAttendance(req, res);
    });

    // API: Get wishlist data
    this.app.get('/api/profile/wishlist', requireAuth, async (req, res) => {
      await this.handleGetProfileWishlist(req, res);
    });

    // API: Update wishlist
    this.app.post('/api/profile/update-wishlist', requireAuth, async (req, res) => {
      await this.handleUpdateProfileWishlist(req, res);
    });

    // API: Upload gear screenshot
    this.app.post('/api/profile/upload-gear', requireAuth, async (req, res) => {
      await this.handleUploadGearScreenshot(req, res);
    });

    // API: Get roster data
    this.app.get('/api/profile/roster', requireAuth, async (req, res) => {
      await this.handleGetRosterData(req, res);
    });

    // API: Get party members data
    this.app.get('/api/profile/party-members', requireAuth, async (req, res) => {
      await this.handleGetPartyMembers(req, res);
    });

    // API: Get item rolls data
    this.app.get('/api/profile/item-rolls', requireAuth, async (req, res) => {
      await this.handleGetItemRolls(req, res);
    });

    // API: Check if user has admin access (for profile dashboard)
    this.app.get('/api/profile/admin-access', requireAuth, async (req, res) => {
      await this.handleProfileCheckAdminAccess(req, res);
    });

    // API: Get admin panel link (for profile dashboard)
    this.app.get('/api/profile/admin-panel-link', requireAuth, async (req, res) => {
      await this.handleProfileGetAdminPanelLink(req, res);
    });

    // ==========================================
    // Guild Support Routes (User)
    // ==========================================

    // API: Get guild support information content
    this.app.get('/api/guild-support/info', requireAuth, async (req, res) => {
      await this.handleGetGuildSupportInfo(req, res);
    });

    // API: Submit a support request
    this.app.post('/api/guild-support/request', requireAuth, async (req, res) => {
      await this.handleSubmitSupportRequest(req, res);
    });

    // API: Get current user's support requests
    this.app.get('/api/guild-support/my-requests', requireAuth, async (req, res) => {
      await this.handleGetMyRequests(req, res);
    });

    // API: Get public priority queue (approved requests only)
    this.app.get('/api/guild-support/queue', requireAuth, async (req, res) => {
      await this.handleGetSupportQueue(req, res);
    });

    // API: Get fulfilled requests history
    this.app.get('/api/guild-support/fulfilled-history', requireAuth, async (req, res) => {
      await this.handleGetFulfilledHistory(req, res);
    });

    // ==========================================
    // Admin Panel Routes
    // ==========================================

    // Admin panel page
    this.app.get('/admin-panel', requireAdmin, async (req, res) => {
      await this.handleAdminPanelPage(req, res);
    });

    // API: Check admin access
    this.app.get('/api/admin-panel/check-access', requireAdmin, async (req, res) => {
      await this.handleCheckAdminAccess(req, res);
    });

    // API: Get guild members
    this.app.get('/api/admin-panel/members', requireAdmin, async (req, res) => {
      await this.handleAdminGetMembers(req, res);
    });

    // API: Get events
    this.app.get('/api/admin-panel/events', requireAdmin, async (req, res) => {
      await this.handleAdminGetEvents(req, res);
    });

    // API: Get text channels for item rolls
    this.app.get('/api/admin-panel/channels', requireAdmin, async (req, res) => {
      await this.handleAdminGetChannels(req, res);
    });

    // API: Get static party editor token (redirects to existing editor)
    this.app.get('/api/admin-panel/static-party-token', requireAdmin, async (req, res) => {
      await this.handleAdminGetStaticPartyToken(req, res);
    });

    // API: Get event party editor token
    this.app.get('/api/admin-panel/event-party-token/:eventId', requireAdmin, async (req, res) => {
      await this.handleAdminGetEventPartyToken(req, res);
    });

    // API: Reset user party info
    this.app.post('/api/admin-panel/reset-party', requireAdmin, async (req, res) => {
      await this.handleAdminResetParty(req, res);
    });

    // API: Reset user wishlist
    this.app.post('/api/admin-panel/reset-wishlist', requireAdmin, async (req, res) => {
      await this.handleAdminResetWishlist(req, res);
    });

    // API: Get item categories
    this.app.get('/api/admin-panel/item-categories', requireAdmin, async (req, res) => {
      await this.handleAdminGetItemCategories(req, res);
    });

    // API: Get item subcategories
    this.app.get('/api/admin-panel/item-subcategories/:category', requireAdmin, async (req, res) => {
      await this.handleAdminGetItemSubcategories(req, res);
    });

    // API: Get items
    this.app.get('/api/admin-panel/items/:category/:subcategory', requireAdmin, async (req, res) => {
      await this.handleAdminGetItems(req, res);
    });

    // API: Create item roll
    this.app.post('/api/admin-panel/create-item-roll', requireAdmin, async (req, res) => {
      await this.handleAdminCreateItemRoll(req, res);
    });

    // API: Get wishlisted items for give item feature
    this.app.get('/api/admin-panel/wishlisted-items', requireAdmin, async (req, res) => {
      await this.handleAdminGetWishlistedItems(req, res);
    });

    // API: Give item to users
    this.app.post('/api/admin-panel/give-item', requireAdmin, async (req, res) => {
      await this.handleAdminGiveItem(req, res);
    });

    // API: Get wishlist submissions grouped by user
    this.app.get('/api/admin-panel/wishlist-submissions', requireAdmin, async (req, res) => {
      await this.handleAdminGetWishlistSubmissions(req, res);
    });

    // API: Get given items history
    this.app.get('/api/admin-panel/given-items', requireAdmin, async (req, res) => {
      await this.handleAdminGetGivenItems(req, res);
    });

    // API: Send party info reminders
    this.app.post('/api/admin-panel/remind-parties', requireAdmin, async (req, res) => {
      await this.handleAdminRemindParties(req, res);
    });

    // API: Send wishlist reminders
    this.app.post('/api/admin-panel/remind-wishlist', requireAdmin, async (req, res) => {
      await this.handleAdminRemindWishlist(req, res);
    });

    // API: Cancel event
    this.app.post('/api/admin-panel/cancel-event', requireAdmin, async (req, res) => {
      await this.handleAdminCancelEvent(req, res);
    });

    // API: View event code
    this.app.get('/api/admin-panel/event-code/:eventId', requireAdmin, async (req, res) => {
      await this.handleAdminViewEventCode(req, res);
    });

    // API: Get profile link from admin panel
    this.app.get('/api/admin-panel/profile-link', requireAdmin, async (req, res) => {
      await this.handleAdminGetProfileLink(req, res);
    });

    // API: Create event
    this.app.post('/api/admin-panel/create-event', requireAdmin, async (req, res) => {
      await this.handleAdminCreateEvent(req, res);
    });

    // API: Get description templates
    this.app.get('/api/admin-panel/description-templates', requireAdmin, async (req, res) => {
      await this.handleAdminGetDescriptionTemplates(req, res);
    });

    // API: Save description template
    this.app.post('/api/admin-panel/description-templates', requireAdmin, async (req, res) => {
      await this.handleAdminSaveDescriptionTemplate(req, res);
    });

    // API: Delete description template
    this.app.delete('/api/admin-panel/description-templates/:templateId', requireAdmin, async (req, res) => {
      await this.handleAdminDeleteDescriptionTemplate(req, res);
    });

    // API: Get party history
    this.app.get('/api/admin-panel/party-history', requireAdmin, async (req, res) => {
      await this.handleAdminGetPartyHistory(req, res);
    });

    // API: Get party details
    this.app.get('/api/admin-panel/party-details/:eventPartyId', requireAdmin, async (req, res) => {
      await this.handleAdminGetPartyDetails(req, res);
    });

    // ==========================================
    // Guild Support Admin Routes
    // ==========================================

    // API: Get guild support configuration
    this.app.get('/api/admin/guild-support/config', requireAdmin, async (req, res) => {
      await this.handleAdminGetGuildSupportConfig(req, res);
    });

    // API: Update guild support configuration
    this.app.post('/api/admin/guild-support/config', requireAdmin, async (req, res) => {
      await this.handleAdminUpdateGuildSupportConfig(req, res);
    });

    // API: Get all support requests (admin)
    this.app.get('/api/admin/guild-support/requests', requireAdmin, async (req, res) => {
      await this.handleAdminGetAllRequests(req, res);
    });

    // API: Get specific support request details (admin)
    this.app.get('/api/admin/guild-support/request/:id', requireAdmin, async (req, res) => {
      await this.handleAdminGetRequestDetails(req, res);
    });

    // API: Update support request (approve/deny/update)
    this.app.patch('/api/admin/guild-support/request/:id', requireAdmin, async (req, res) => {
      await this.handleAdminUpdateRequest(req, res);
    });

    // API: Reorder priority queue
    this.app.post('/api/admin/guild-support/queue/reorder', requireAdmin, async (req, res) => {
      await this.handleAdminReorderQueue(req, res);
    });

    // API: Mark request as fulfilled
    this.app.post('/api/admin/guild-support/queue/fulfill/:id', requireAdmin, async (req, res) => {
      await this.handleAdminFulfillRequest(req, res);
    });

    // API: Add partial fulfillment to request
    this.app.post('/api/admin/guild-support/request/:id/fulfill-partial', requireAdmin, async (req, res) => {
      await this.handleAdminPartialFulfillRequest(req, res);
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).send('Page not found');
    });
  }

  /**
   * Handle party editor page request
   */
  async handlePartyEditorPage(req, res) {
    try {
      const validation = this.validateToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).render('error', { 
          message: validation.error === 'Token expired' 
            ? 'This link has expired (links are valid for 1 hour)' 
            : 'Invalid or expired link'
        });
      }

      const { eventId, userId } = validation.data;

      // Fetch party formation data
      const formation = await this.collections.eventParties.findOne({ 
        eventId: new ObjectId(eventId) 
      });

      if (!formation) {
        return res.status(404).render('error', { 
          message: 'Party formation not found' 
        });
      }

      // Fetch event data
      const event = await this.collections.pvpEvents.findOne({ 
        _id: new ObjectId(eventId) 
      });

      if (!event) {
        return res.status(404).render('error', { 
          message: 'Event not found' 
        });
      }

      // Fetch guild
      const guild = await this.client.guilds.fetch(event.guildId);

      // Enrich formation data with avatars
      const enrichedFormation = { ...formation };

      if (enrichedFormation.processedParties) {
        enrichedFormation.processedParties = await Promise.all(
          enrichedFormation.processedParties.map(async (party) => ({
            ...party,
            members: await Promise.all((party.members || []).map(async (member) => {
              const discordMember = await guild.members.fetch(member.userId).catch(() => null);
              return {
                ...member,
                avatarUrl: discordMember?.user?.displayAvatarURL({ size: 64, format: 'png' }) || null
              };
            }))
          }))
        );
      }

      if (enrichedFormation.availableMembers) {
        enrichedFormation.availableMembers = await Promise.all(
          enrichedFormation.availableMembers.map(async (member) => {
            const discordMember = await guild.members.fetch(member.userId).catch(() => null);
            return {
              ...member,
              avatarUrl: discordMember?.user?.displayAvatarURL({ size: 64, format: 'png' }) || null
            };
          })
        );
      }

      // Fetch static party titles to use as defaults in the event party editor
      const staticParties = await this.collections.parties.find({
        guildId: event.guildId,
        isReserve: { $ne: true }
      }).toArray();
      const staticPartyTitles = {};
      for (const sp of staticParties) {
        staticPartyTitles[sp.partyNumber] = sp.titles || [];
      }

      // Render the party editor page
      res.render('party-editor', {
        token: req.params.token,
        eventId,
        guildName: guild.name,
        eventType: event.eventType,
        eventLocation: event.location,
        eventTime: event.eventTime,
        formation: JSON.stringify(enrichedFormation),
        summary: JSON.stringify(formation.summary),
        staticPartyTitles: JSON.stringify(staticPartyTitles)
      });

    } catch (error) {
      console.error('Error loading party editor page:', error);
      res.status(500).render('error', { 
        message: 'Failed to load party editor. Please try again.' 
      });
    }
  }

  /**
   * Handle get party data API request
   */
  async handleGetPartyData(req, res) {
    try {
      const validation = this.validateToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { eventId } = validation.data;

      const formation = await this.collections.eventParties.findOne({ 
        eventId: new ObjectId(eventId) 
      });

      if (!formation) {
        return res.status(404).json({ error: 'Party formation not found' });
      }

      const event = await this.collections.pvpEvents.findOne({ 
        _id: new ObjectId(eventId) 
      });

      res.json({
        formation,
        event: {
          eventType: event.eventType,
          location: event.location,
          eventTime: event.eventTime
        }
      });

    } catch (error) {
      console.error('Error getting party data:', error);
      res.status(500).json({ error: 'Failed to get party data' });
    }
  }

  /**
   * Handle submit parties API request
   */
  async handleSubmitParties(req, res) {
    try {
      const validation = this.validateToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { eventId, userId } = validation.data;
      const { processedParties, availableMembers } = req.body;

      // Validate data
      if (!processedParties || !Array.isArray(processedParties)) {
        return res.status(400).json({ error: 'Invalid party data' });
      }

      // Update formation in database
      await this.collections.eventParties.updateOne(
        { eventId: new ObjectId(eventId) },
        {
          $set: {
            processedParties,
            availableMembers: availableMembers || [],
            lastModified: new Date(),
            approved: true,
            approvedBy: userId,
            approvedAt: new Date()
          }
        }
      );

      // Update event status
      await this.collections.pvpEvents.updateOne(
        { _id: new ObjectId(eventId) },
        {
          $set: {
            partiesFormed: true,
            partiesFormedAt: new Date()
          }
        }
      );

      // Send DMs to all party members
      const event = await this.collections.pvpEvents.findOne({ 
        _id: new ObjectId(eventId) 
      });

      const eventInfo = {
        eventType: event.eventType,
        location: event.location,
        eventTime: event.eventTime
      };

      const dmResults = await this.sendPartyDMs(processedParties, eventInfo);

      // Invalidate token (one-time use)
      this.activeTokens.delete(req.params.token);

      res.json({ 
        success: true, 
        dmResults,
        message: 'Party assignments sent successfully!'
      });

    } catch (error) {
      console.error('Error submitting parties:', error);
      res.status(500).json({ error: 'Failed to submit parties' });
    }
  }

  /**
   * Handle preview DM API request
   */
  async handlePreviewDM(req, res) {
    try {
      const validation = this.validateToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { eventId } = validation.data;
      const { member, party } = req.body;

      const event = await this.collections.pvpEvents.findOne({ 
        _id: new ObjectId(eventId) 
      });

      const eventInfo = {
        eventType: event.eventType,
        location: event.location,
        eventTime: event.eventTime
      };

      const dmMessage = this.createPartyAssignmentDM(member, party, eventInfo);

      res.json({ dmMessage });

    } catch (error) {
      console.error('Error previewing DM:', error);
      res.status(500).json({ error: 'Failed to preview DM' });
    }
  }

  /**
   * Create DM message for party member - modern embed style
   */
  createPartyAssignmentDM(member, party, eventInfo) {
    const eventTypeNames = {
      siege: 'Siege',
      riftstone: 'Riftstone',
      boonstone: 'Boonstone',
      wargames: 'Wargames',
      warboss: 'War Boss',
      guildevent: 'Guild Event'
    };

    const eventTypeColors = {
      siege: '#E74C3C',
      riftstone: '#9B59B6',
      boonstone: '#F1C40F',
      wargames: '#E67E22',
      warboss: '#C0392B',
      guildevent: '#3498DB'
    };

    const getRoleEmoji = (role) => {
      switch (role) {
        case 'tank': return '🛡️';
        case 'healer': return '💚';
        case 'dps': return '⚔️';
        default: return '❓';
      }
    };

    const eventName = eventTypeNames[eventInfo.eventType] || eventInfo.eventType;
    const eventColor = eventTypeColors[eventInfo.eventType] || '#5865F2';
    const location = eventInfo.location ? eventInfo.location : null;
    const timestamp = Math.floor(eventInfo.eventTime.getTime() / 1000);

    // Create party member list with better formatting
    const partyList = party.members.map(m => {
      const roleIcon = getRoleEmoji(m.role);
      const leaderMark = m.isLeader ? ' ⭐' : '';
      const isYou = m.userId === member.userId ? ' **← you**' : '';
      return `${roleIcon} ${m.displayName}${leaderMark}${isYou}`;
    }).join('\n');

    // Role composition
    const comp = party.composition;
    const roleComp = `🛡️ ${comp.tank}  ·  💚 ${comp.healer}  ·  ⚔️ ${comp.dps}`;

    // Build the embed
    const titleRoleLine = (party.titles && party.titles.length > 0)
      ? `\n**🏷️ ${party.titles.join(' · ')}**`
      : '';

    const embed = new EmbedBuilder()
      .setColor(eventColor)
      .setTitle(`🎮 Party ${party.partyNumber} Assignment`)
      .setDescription(`You've been assigned to **Party ${party.partyNumber}** for the upcoming event.${titleRoleLine}`)
      .addFields(
        {
          name: '📅 Event',
          value: `**${eventName}**${location ? `\n📍 ${location}` : ''}`,
          inline: true
        },
        {
          name: '⏰ Time',
          value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`,
          inline: true
        },
        {
          name: '\u200B',
          value: '\u200B',
          inline: true
        },
        {
          name: '👥 Party Members',
          value: partyList,
          inline: false
        },
        {
          name: '⚖️ Composition',
          value: roleComp,
          inline: false
        }
      )
      .setFooter({ text: 'Good luck! See you at the event.' })
      .setTimestamp();

    return { embeds: [embed] };
  }

  /**
   * Send party assignment DMs to all members
   */
  async sendPartyDMs(processedParties, eventInfo) {
    const results = {
      successful: [],
      failed: []
    };

    console.log(`\n=== Sending Party Assignment DMs ===`);
    console.log(`Total parties: ${processedParties.length}`);

    for (const party of processedParties) {
      console.log(`\nProcessing Party ${party.partyNumber} (${party.members.length} members):`);

      for (const member of party.members) {
        try {
          if (!member.userId || !/^\d+$/.test(member.userId)) {
            console.error(`❌ Invalid user ID for ${member.displayName}: "${member.userId}"`);
            results.failed.push({
              userId: member.userId || 'unknown',
              displayName: member.displayName,
              error: 'Invalid user ID format'
            });
            continue;
          }

          console.log(`  Sending DM to ${member.displayName} (${member.userId})...`);

          const user = await this.client.users.fetch(member.userId);
          const dmMessage = this.createPartyAssignmentDM(member, party, eventInfo);

          await user.send(dmMessage);

          results.successful.push({
            userId: member.userId,
            displayName: member.displayName
          });

          console.log(`  ✅ DM sent successfully`);

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`  ❌ Failed to send DM: ${error.message}`);
          results.failed.push({
            userId: member.userId,
            displayName: member.displayName,
            error: error.message
          });
        }
      }
    }

    console.log(`\n=== DM Summary: ${results.successful.length} successful, ${results.failed.length} failed ===\n`);

    return results;
  }

  /**
   * Handle static party editor page request
   */
  async handleStaticPartyEditorPage(req, res) {
    try {
      const validation = this.validateStaticPartyToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).render('error', {
          message: validation.error === 'Token expired'
            ? 'This link has expired (links are valid for 1 hour)'
            : 'Invalid or expired link'
        });
      }

      const { guildId, userId } = validation.data;

      // Fetch all parties for this guild
      const allParties = await this.collections.parties.find({
        guildId,
        isReserve: { $ne: true }
      }).sort({ partyNumber: 1 }).toArray();

      // Fetch reserve party
      const reserveParty = await this.collections.parties.findOne({
        guildId,
        isReserve: true
      });

      // Fetch all party players for this guild (available members pool)
      const allPlayers = await this.collections.partyPlayers.find({ guildId }).toArray();

      // Find players not in any party
      const assignedUserIds = new Set();
      for (const party of allParties) {
        for (const member of (party.members || [])) {
          assignedUserIds.add(member.userId);
        }
      }
      if (reserveParty) {
        for (const member of (reserveParty.members || [])) {
          assignedUserIds.add(member.userId);
        }
      }

      const availablePlayers = allPlayers.filter(p => !assignedUserIds.has(p.userId));

      // Fetch guild
      const guild = await this.client.guilds.fetch(guildId);

      // Enrich party members and available players with display names and avatars
      const enrichedParties = await Promise.all(allParties.map(async (party) => {
        const enrichedMembers = await Promise.all((party.members || []).map(async (member) => {
          const discordMember = await guild.members.fetch(member.userId).catch(() => null);
          return {
            ...member,
            displayName: discordMember?.displayName || member.displayName || 'Unknown',
            avatarUrl: discordMember?.user?.displayAvatarURL({ size: 64, format: 'png' }) || null
          };
        }));
        return {
          ...party,
          members: enrichedMembers
        };
      }));

      const enrichedAvailable = await Promise.all(availablePlayers.map(async (player) => {
        const discordMember = await guild.members.fetch(player.userId).catch(() => null);
        return {
          userId: player.userId,
          displayName: discordMember?.displayName || 'Unknown',
          avatarUrl: discordMember?.user?.displayAvatarURL({ size: 64, format: 'png' }) || null,
          weapon1: player.weapon1,
          weapon2: player.weapon2,
          role: player.role || 'dps',
          cp: player.cp || 0
        };
      }));

      // Render the static party editor page
      res.render('static-party-editor', {
        token: req.params.token,
        guildId,
        guildName: guild.name,
        parties: JSON.stringify(enrichedParties),
        availableMembers: JSON.stringify(enrichedAvailable),
        reserveParty: JSON.stringify(reserveParty ? {
          ...reserveParty,
          members: await Promise.all((reserveParty.members || []).map(async (member) => {
            const discordMember = await guild.members.fetch(member.userId).catch(() => null);
            return {
              ...member,
              displayName: discordMember?.displayName || member.displayName || 'Unknown',
              avatarUrl: discordMember?.user?.displayAvatarURL({ size: 64, format: 'png' }) || null
            };
          }))
        } : null)
      });

    } catch (error) {
      console.error('Error loading static party editor page:', error);
      res.status(500).render('error', {
        message: 'Failed to load party editor. Please try again.'
      });
    }
  }

  /**
   * Handle get static party data API request
   */
  async handleGetStaticPartyData(req, res) {
    try {
      const validation = this.validateStaticPartyToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;

      const parties = await this.collections.parties.find({
        guildId,
        isReserve: { $ne: true }
      }).sort({ partyNumber: 1 }).toArray();

      const reserveParty = await this.collections.parties.findOne({
        guildId,
        isReserve: true
      });

      res.json({ parties, reserveParty });

    } catch (error) {
      console.error('Error getting static party data:', error);
      res.status(500).json({ error: 'Failed to get party data' });
    }
  }

  /**
   * Handle save static parties API request
   * Supports creating, updating, and deleting parties
   */
  async handleSaveStaticParties(req, res) {
    try {
      const validation = this.validateStaticPartyToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
      const { parties, reserveMembers } = req.body;

      // Validate data
      if (!parties || !Array.isArray(parties)) {
        return res.status(400).json({ error: 'Invalid party data' });
      }

      console.log(`\n=== Saving Static Parties for Guild ${guildId} ===`);
      console.log(`Total parties from client: ${parties.length}`);

      // Get current parties from database
      const existingParties = await this.collections.parties.find({
        guildId,
        isReserve: { $ne: true }
      }).toArray();

      const existingPartyNumbers = new Set(existingParties.map(p => p.partyNumber));
      const newPartyNumbers = new Set(parties.map(p => p.partyNumber));

      // Find parties to delete (exist in DB but not in new data)
      const partiesToDelete = [...existingPartyNumbers].filter(num => !newPartyNumbers.has(num));

      // Delete removed parties
      if (partiesToDelete.length > 0) {
        await this.collections.parties.deleteMany({
          guildId,
          partyNumber: { $in: partiesToDelete },
          isReserve: { $ne: true }
        });
        console.log(`  Deleted parties: ${partiesToDelete.join(', ')}`);
      }

      // Update or create each party
      for (const party of parties) {
        // Calculate composition
        const composition = { tank: 0, healer: 0, dps: 0 };
        for (const member of (party.members || [])) {
          if (composition[member.role] !== undefined) {
            composition[member.role]++;
          }
        }

        // Calculate total CP
        const totalCP = (party.members || []).reduce((sum, m) => sum + (m.cp || 0), 0);

        const isNew = party.isNew || !existingPartyNumbers.has(party.partyNumber);

        if (isNew) {
          // Create new party
          await this.collections.parties.insertOne({
            guildId,
            partyNumber: party.partyNumber,
            members: party.members || [],
            titles: party.titles || [],
            roleComposition: composition,
            totalCP,
            isReserve: false,
            createdAt: new Date(),
            createdBy: userId,
            lastModified: new Date(),
            lastModifiedBy: userId
          });
          console.log(`  Created Party ${party.partyNumber}: ${(party.members || []).length} members`);
        } else {
          // Update existing party
          await this.collections.parties.updateOne(
            { guildId, partyNumber: party.partyNumber, isReserve: { $ne: true } },
            {
              $set: {
                members: party.members || [],
                titles: party.titles || [],
                roleComposition: composition,
                totalCP,
                lastModified: new Date(),
                lastModifiedBy: userId
              }
            }
          );
          console.log(`  Updated Party ${party.partyNumber}: ${(party.members || []).length} members`);
        }
      }

      // Update reserve party if provided
      if (reserveMembers !== undefined) {
        const reserveComposition = { tank: 0, healer: 0, dps: 0 };
        for (const member of (reserveMembers || [])) {
          if (reserveComposition[member.role] !== undefined) {
            reserveComposition[member.role]++;
          }
        }

        const reserveTotalCP = (reserveMembers || []).reduce((sum, m) => sum + (m.cp || 0), 0);

        await this.collections.parties.updateOne(
          { guildId, isReserve: true },
          {
            $set: {
              members: reserveMembers || [],
              roleComposition: reserveComposition,
              totalCP: reserveTotalCP,
              lastModified: new Date(),
              lastModifiedBy: userId
            }
          },
          { upsert: false }
        );

        console.log(`  Updated Reserve: ${(reserveMembers || []).length} members`);
      }

      console.log(`=== Save Complete ===\n`);

      res.json({
        success: true,
        message: 'Parties saved successfully!'
      });

    } catch (error) {
      console.error('Error saving static parties:', error);
      res.status(500).json({ error: 'Failed to save parties' });
    }
  }

  /**
   * Handle profile dashboard page request
   */
  async handleProfilePage(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Check if user is in a guild where the bot is present
      if (!guildId) {
        // Get list of guilds where the bot is present
        const botGuilds = this.client.guilds.cache.map(g => ({
          id: g.id,
          name: g.name,
          icon: g.iconURL({ size: 128, format: 'png' }),
          memberCount: g.memberCount
        }));

        return res.status(403).render('error', {
          message: 'You are not a member of any server where this bot is active.',
          showGuildLinks: true,
          botGuilds: botGuilds
        });
      }

      // Fetch guild
      let guild;
      try {
        guild = await this.client.guilds.fetch(guildId);
      } catch (guildError) {
        // If guild fetch fails (e.g., bot is not in that guild), show available guilds
        if (guildError.code === 10004) {
          console.log(`Guild ${guildId} not found (bot not in guild). Showing available guilds.`);
          const botGuilds = this.client.guilds.cache.map(g => ({
            id: g.id,
            name: g.name,
            icon: g.iconURL({ size: 128, format: 'png' }),
            memberCount: g.memberCount
          }));

          return res.status(403).render('error', {
            message: 'The guild in your session is no longer available. Please select a server where this bot is active.',
            showGuildLinks: true,
            botGuilds: botGuilds
          });
        }
        throw guildError; // Re-throw if it's a different error
      }

      const member = await guild.members.fetch(userId).catch(() => null);

      // Render the profile page
      res.render('profile-dashboard', {
        guildId,
        userId,
        guildName: guild.name,
        userName: member?.displayName || 'Unknown User',
        userAvatar: member?.user?.displayAvatarURL({ size: 128, format: 'png' }) || null,
        hasExcludedRole: req.hasExcludedRole || false
      });

    } catch (error) {
      console.error('Error loading profile page:', error);
      res.status(500).render('error', {
        message: 'Failed to load profile dashboard. Please try again.'
      });
    }
  }

  /**
   * Handle get profile data API request
   */
  async handleGetProfileData(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Get player info
      const playerInfo = await this.collections.partyPlayers.findOne({
        userId,
        guildId
      });

      // Get party assignment
      const party = await this.collections.parties.findOne({
        guildId,
        'members.userId': userId,
        isReserve: { $ne: true }
      });

      // Get PvP bonuses
      const bonuses = await this.collections.pvpBonuses.findOne({
        userId,
        guildId
      });

      // Get activity ranking
      const activity = await this.collections.pvpActivityRanking.findOne({
        userId,
        guildId
      });

      // Get guild settings for weekly total
      const guildSettings = await this.collections.guildSettings.findOne({
        guildId
      });

      // Get user avatar
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId).catch(() => null);

      res.json({
        playerInfo: playerInfo || {},
        partyNumber: party?.partyNumber || null,
        bonuses: bonuses || { bonusCount: 0, eventsAttended: 0 },
        totalEvents: activity?.totalEvents || 0,
        weeklyTotalEvents: guildSettings?.weeklyTotalEvents || 0,
        userName: member?.displayName || 'Unknown',
        userAvatar: member?.user?.displayAvatarURL({ size: 128, format: 'png' }) || null
      });

    } catch (error) {
      console.error('Error getting profile data:', error);
      res.status(500).json({ error: 'Failed to get profile data' });
    }
  }

  /**
   * Handle update player info API request
   */
  async handleUpdatePlayerInfo(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { weapon1, weapon2, cp, buildLink } = req.body;

      // Validate CP
      if (cp !== undefined && (isNaN(cp) || cp < 0 || cp > 10000000)) {
        return res.status(400).json({ error: 'Invalid CP value (0-10,000,000)' });
      }

      // Validate build link
      if (buildLink !== undefined && buildLink.length > 500) {
        return res.status(400).json({ error: 'Build link too long (max 500 characters)' });
      }

      // Determine role based on weapons
      const determineRole = (w1, w2) => {
        const weapons = [w1, w2].filter(Boolean);
        if (weapons.includes('SnS')) return 'tank';
        if ((weapons.includes('Orb') && weapons.includes('Wand')) ||
            (weapons.includes('Wand') && weapons.includes('Bow'))) {
          return 'healer';
        }
        return 'dps';
      };

      const updateData = {
        updatedAt: new Date()
      };

      if (weapon1 !== undefined) updateData.weapon1 = weapon1;
      if (weapon2 !== undefined) updateData.weapon2 = weapon2;
      if (cp !== undefined) updateData.cp = parseInt(cp, 10);
      if (buildLink !== undefined) {
        updateData.buildLink = buildLink;
        updateData.buildLinkUpdatedAt = new Date();
      }

      // Calculate role if weapons changed
      if (weapon1 !== undefined || weapon2 !== undefined) {
        const currentPlayer = await this.collections.partyPlayers.findOne({ userId, guildId });
        const newW1 = weapon1 !== undefined ? weapon1 : currentPlayer?.weapon1;
        const newW2 = weapon2 !== undefined ? weapon2 : currentPlayer?.weapon2;
        updateData.role = determineRole(newW1, newW2);
      }

      await this.collections.partyPlayers.updateOne(
        { userId, guildId },
        { $set: updateData },
        { upsert: true }
      );

      // Update party member data if in a party
      if (updateData.cp !== undefined || updateData.role !== undefined) {
        await this.collections.parties.updateMany(
          { guildId, 'members.userId': userId },
          {
            $set: {
              'members.$[elem].cp': updateData.cp,
              'members.$[elem].role': updateData.role,
              'members.$[elem].weapon1': updateData.weapon1,
              'members.$[elem].weapon2': updateData.weapon2
            }
          },
          { arrayFilters: [{ 'elem.userId': userId }] }
        );
      }

      // Trigger roster update if roster exists for this guild
      try {
        const rosterRecord = await this.collections.guildRosters.findOne({ guildId });
        if (rosterRecord && rosterRecord.channelId) {
          const guild = await this.client.guilds.fetch(guildId);
          await updateGuildRoster(guild, rosterRecord.channelId, this.collections);
          console.log(`✅ Roster updated after profile change for user ${userId}`);
        }
      } catch (rosterErr) {
        console.error('Failed to update roster after profile change:', rosterErr);
        // Don't fail the request if roster update fails
      }

      // Post gear check embed if build link was updated
      if (buildLink !== undefined) {
        try {
          const guild = await this.client.guilds.fetch(guildId);
          const member = await guild.members.fetch(userId).catch(() => null);
          const playerInfo = await this.collections.partyPlayers.findOne({ userId, guildId });
          if (member && playerInfo && playerInfo.gearScreenshotUrl) {
            await postGearCheckEmbed(guild, member, playerInfo, this.collections);
            console.log(`✅ Gear check embed posted after build link update for user ${userId}`);
          }
        } catch (embedErr) {
          console.error('Failed to post gear check embed after build link update:', embedErr);
        }
      }

      res.json({ success: true, message: 'Profile updated successfully' });

    } catch (error) {
      console.error('Error updating player info:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  /**
   * Handle get profile events API request
   */
  async handleGetProfileEvents(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Get upcoming PvP events (not closed, event time in future or recent past)
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const pvpEvents = await this.collections.pvpEvents.find({
        guildId,
        eventTime: { $gte: cutoffTime },
        closed: { $ne: true }
      }).sort({ eventTime: 1 }).toArray();

      // Get static events
      const staticEvents = await this.collections.staticEvents.find({
        guildId,
        cancelled: { $ne: true }
      }).toArray();

      // Enrich events with user's signup status
      const enrichedEvents = pvpEvents.map(event => {
        let signupStatus = 'none';
        if (event.rsvpAttending?.includes(userId)) signupStatus = 'attending';
        else if (event.rsvpNotAttending?.includes(userId)) signupStatus = 'not_attending';
        else if (event.rsvpMaybe?.includes(userId)) signupStatus = 'maybe';

        const hasRecordedAttendance = event.attendees?.includes(userId);

        // Check if signup deadline passed (20 min before event)
        const signupDeadline = new Date(event.eventTime.getTime() - 20 * 60 * 1000);
        const signupsClosed = Date.now() > signupDeadline.getTime();

        // Check if attendance can be recorded (5 min before to 2 hour after event)
        const eventTime = event.eventTime.getTime();
        const fiveMinsBefore = eventTime - (5 * 60 * 1000);
        const oneHourAfter = eventTime + (120 * 60 * 1000);
        const now = Date.now();
        const canRecordAttendance = signupStatus !== 'none' &&
                                    now >= fiveMinsBefore &&
                                    now <= oneHourAfter &&
                                    !hasRecordedAttendance &&
                                    !event.closed;

        return {
          _id: event._id.toString(),
          eventType: event.eventType,
          location: event.location,
          eventTime: event.eventTime,
          bonusPoints: event.bonusPoints,
          message: event.message,
          imageUrl: event.imageUrl,
          signupStatus,
          hasRecordedAttendance,
          signupsClosed,
          attendeesCount: event.attendees?.length || 0,
          rsvpAttendingCount: event.rsvpAttending?.length || 0,
          rsvpMaybeCount: event.rsvpMaybe?.length || 0,
          rsvpNotAttendingCount: event.rsvpNotAttending?.length || 0,
          // Users enter the code manually via 4-digit input panel - do not send code to client
          canRecordAttendance,
          isClosed: event.closed || false
        };
      });

      res.json({
        events: enrichedEvents,
        staticEvents: staticEvents.map(se => ({
          _id: se._id.toString(),
          title: se.title,
          dayOfWeek: se.dayOfWeek,
          dayName: se.dayName,
          timeDisplay: se.timeDisplay,
          hour: se.hour,
          minute: se.minute
        }))
      });

    } catch (error) {
      console.error('Error getting profile events:', error);
      res.status(500).json({ error: 'Failed to get events' });
    }
  }

  /**
   * Handle profile event RSVP API request
   */
  async handleProfileEventRsvp(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { eventId, status } = req.body;

      if (!eventId || !['attending', 'not_attending', 'maybe'].includes(status)) {
        return res.status(400).json({ error: 'Invalid event ID or status' });
      }

      // Get the event
      const event = await this.collections.pvpEvents.findOne({
        _id: new ObjectId(eventId),
        guildId
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check if signups are closed
      const signupDeadline = new Date(event.eventTime.getTime() - 20 * 60 * 1000);
      if (Date.now() > signupDeadline.getTime()) {
        return res.status(400).json({ error: 'Signups are closed for this event' });
      }

      // Remove from all lists first
      await this.collections.pvpEvents.updateOne(
        { _id: new ObjectId(eventId) },
        {
          $pull: {
            rsvpAttending: userId,
            rsvpNotAttending: userId,
            rsvpMaybe: userId
          }
        }
      );

      // Add to appropriate list
      const fieldMap = {
        attending: 'rsvpAttending',
        not_attending: 'rsvpNotAttending',
        maybe: 'rsvpMaybe'
      };

      await this.collections.pvpEvents.updateOne(
        { _id: new ObjectId(eventId) },
        { $addToSet: { [fieldMap[status]]: userId } }
      );

      // Trigger embed update
      try {
        const updatedEvent = await this.collections.pvpEvents.findOne({ _id: new ObjectId(eventId) });
        if (updatedEvent) {
          // Create a mock interaction object with the client for embed update
          const mockInteraction = { client: this.client };
          await updateEventEmbed(mockInteraction, updatedEvent, this.collections);
          console.log(`✅ PvP event embed updated after RSVP change for event ${eventId}`);
        }
      } catch (embedErr) {
        console.error('Failed to update event embed after RSVP:', embedErr);
        // Don't fail the request if embed update fails
      }

      res.json({ success: true, message: 'RSVP updated successfully' });

    } catch (error) {
      console.error('Error updating event RSVP:', error);
      res.status(500).json({ error: 'Failed to update RSVP' });
    }
  }

  /**
   * Handle profile event attendance API request
   */
  async handleProfileEventAttendance(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { eventId, code } = req.body;

      if (!eventId || !code) {
        return res.status(400).json({ error: 'Event ID and code are required' });
      }

      // Get the event
      const event = await this.collections.pvpEvents.findOne({
        _id: new ObjectId(eventId),
        guildId
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      if (event.closed) {
        return res.status(400).json({ error: 'Event is closed' });
      }

      // Check if user has signed up
      const hasSignedUp = event.rsvpAttending?.includes(userId) ||
                         event.rsvpMaybe?.includes(userId) ||
                         event.rsvpNotAttending?.includes(userId);

      if (!hasSignedUp) {
        return res.status(400).json({ error: 'You must sign up for the event first' });
      }

      // Verify code first (before checking attendance to save a DB query)
      if (event.password !== code) {
        return res.status(400).json({ error: 'Incorrect attendance code' });
      }

      // Get the bonus points for this event
      const bonusPoints = event.bonusPoints || 10;

      // Check if this is the first attendee for this event
      const isFirstAttendee = !event.attendees || event.attendees.length === 0;

      // Use atomic operation to add user to attendees (prevents race conditions)
      const updateResult = await this.collections.pvpEvents.updateOne(
        {
          _id: new ObjectId(eventId),
          attendees: { $ne: userId },
          closed: false
        },
        {
          $push: { attendees: userId }
        }
      );

      // If matchedCount is 0, either the user already recorded attendance or event was closed
      if (updateResult.matchedCount === 0) {
        const currentEvent = await this.collections.pvpEvents.findOne({ _id: new ObjectId(eventId) });

        if (!currentEvent) {
          return res.status(404).json({ error: 'Event not found' });
        }

        if (currentEvent.closed) {
          return res.status(400).json({ error: 'Event is closed' });
        }

        if (currentEvent.attendees && currentEvent.attendees.includes(userId)) {
          return res.status(400).json({ error: 'You have already recorded attendance' });
        }

        return res.status(400).json({ error: 'Unable to record attendance. Please try again.' });
      }

      // If this is the first attendee, increment the guild's weekly event counter
      if (isFirstAttendee) {
        await this.collections.guildSettings.updateOne(
          { guildId },
          {
            $inc: { weeklyTotalEvents: 1 },
            $set: { lastUpdated: new Date() }
          },
          { upsert: true }
        );
        console.log(`✅ Incremented weeklyTotalEvents for guild ${guildId} (first attendee via web)`);
      }

      // Award bonus points and increment eventsAttended counter
      await this.collections.pvpBonuses.updateOne(
        { userId, guildId },
        {
          $inc: {
            bonusCount: bonusPoints,
            eventsAttended: 1
          },
          $set: { lastUpdated: new Date() }
        },
        { upsert: true }
      );

      // Update activity ranking
      await this.collections.pvpActivityRanking.updateOne(
        { userId, guildId },
        {
          $inc: { totalEvents: 1 },
          $set: { lastEventDate: new Date() }
        },
        { upsert: true }
      );

      // Trigger embed update
      try {
        const updatedEvent = await this.collections.pvpEvents.findOne({ _id: new ObjectId(eventId) });
        if (updatedEvent) {
          const mockInteraction = { client: this.client };
          await updateEventEmbed(mockInteraction, updatedEvent, this.collections);
          console.log(`✅ PvP event embed updated after attendance for event ${eventId}`);
        }
      } catch (embedErr) {
        console.error('Failed to update event embed after attendance:', embedErr);
      }

      res.json({ success: true, message: 'Attendance recorded successfully' });

    } catch (error) {
      console.error('Error recording attendance:', error);
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  }

  /**
   * Handle get profile wishlist API request
   */
  async handleGetProfileWishlist(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Get user's wishlist submission
      const submission = await this.collections.wishlistSubmissions.findOne({
        userId,
        guildId
      });

      // Get given items
      const givenItems = await this.collections.wishlistGivenItems.find({
        userId,
        guildId
      }).toArray();

      // Get wishlist settings (frozen status)
      const settings = await this.collections.wishlistSettings.findOne({
        guildId
      });

      res.json({
        submission: submission || null,
        givenItems: givenItems.map(item => ({
          itemId: item.itemId,
          givenAt: item.givenAt
        })),
        isFrozen: settings?.frozen || false,
        hasSubmitted: !!submission?.submittedAt
      });

    } catch (error) {
      console.error('Error getting wishlist:', error);
      res.status(500).json({ error: 'Failed to get wishlist' });
    }
  }

  /**
   * Handle update profile wishlist API request
   */
  async handleUpdateProfileWishlist(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { archbossWeapon, archbossArmor, t3Weapons, t3Armors, t3Accessories, submit } = req.body;

      // Check if wishlists are frozen
      const settings = await this.collections.wishlistSettings.findOne({ guildId });
      if (settings?.frozen) {
        return res.status(400).json({ error: 'Wishlists are currently frozen' });
      }

      // Check if already submitted
      const existing = await this.collections.wishlistSubmissions.findOne({ userId, guildId });
      if (existing?.submittedAt) {
        return res.status(400).json({ error: 'Wishlist already submitted. Contact an admin to reset.' });
      }

      // Get user's received items to calculate dynamic limits
      const receivedItems = await this.collections.wishlistGivenItems.find({
        userId,
        guildId
      }).toArray();

      const { WISHLIST_ITEMS } = require('../features/wishlist/utils/items');

      // Count received items per category
      const receivedCounts = {
        archbossWeapon: 0,
        archbossArmor: 0,
        t3Weapons: 0,
        t3Armors: 0,
        t3Accessories: 0
      };

      for (const item of receivedItems) {
        if (WISHLIST_ITEMS.archbossWeapons.find(i => i.id === item.itemId)) {
          receivedCounts.archbossWeapon++;
        } else if (WISHLIST_ITEMS.archbossArmors.find(i => i.id === item.itemId)) {
          receivedCounts.archbossArmor++;
        } else if (WISHLIST_ITEMS.t3Weapons.find(i => i.id === item.itemId)) {
          receivedCounts.t3Weapons++;
        } else if (WISHLIST_ITEMS.t3Armors.find(i => i.id === item.itemId)) {
          receivedCounts.t3Armors++;
        } else if (WISHLIST_ITEMS.t3Accessories.find(i => i.id === item.itemId)) {
          receivedCounts.t3Accessories++;
        }
      }

      // Base limits
      const baseLimits = {
        archbossWeapon: 1,
        archbossArmor: 1,
        t3Weapons: 1,
        t3Armors: 4,
        t3Accessories: 2
      };

      // Calculate remaining slots for each category
      const remainingLimits = {
        archbossWeapon: Math.max(0, baseLimits.archbossWeapon - receivedCounts.archbossWeapon),
        archbossArmor: Math.max(0, baseLimits.archbossArmor - receivedCounts.archbossArmor),
        t3Weapons: Math.max(0, baseLimits.t3Weapons - receivedCounts.t3Weapons),
        t3Armors: Math.max(0, baseLimits.t3Armors - receivedCounts.t3Armors),
        t3Accessories: Math.max(0, baseLimits.t3Accessories - receivedCounts.t3Accessories)
      };

      // Validate against remaining limits
      if (archbossWeapon?.length > remainingLimits.archbossWeapon ||
          archbossArmor?.length > remainingLimits.archbossArmor ||
          t3Weapons?.length > remainingLimits.t3Weapons ||
          t3Armors?.length > remainingLimits.t3Armors ||
          t3Accessories?.length > remainingLimits.t3Accessories) {
        return res.status(400).json({ error: 'Wishlist exceeds available item limits (accounting for received items)' });
      }

      const updateData = {
        archbossWeapon: archbossWeapon || [],
        archbossArmor: archbossArmor || [],
        t3Weapons: t3Weapons || [],
        t3Armors: t3Armors || [],
        t3Accessories: t3Accessories || [],
        lastModified: new Date()
      };

      if (submit) {
        updateData.submittedAt = new Date();
      }

      await this.collections.wishlistSubmissions.updateOne(
        { userId, guildId },
        { $set: updateData },
        { upsert: true }
      );

      // Only update wishlist panels in Discord when user fully submits
      if (submit) {
        try {
          await updateWishlistPanels({
            client: this.client,
            guildId,
            collections: this.collections
          });
          console.log(`✅ Wishlist panels updated for guild ${guildId}`);
        } catch (panelErr) {
          console.error('Failed to update wishlist panels:', panelErr);
          // Don't fail the request if panel update fails
        }
      }

      res.json({ success: true, message: submit ? 'Wishlist submitted successfully' : 'Wishlist saved' });

    } catch (error) {
      console.error('Error updating wishlist:', error);
      res.status(500).json({ error: 'Failed to update wishlist' });
    }
  }

  /**
   * Handle gear screenshot upload API request
   */
  async handleUploadGearScreenshot(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { imageData } = req.body;

      if (!imageData) {
        return res.status(400).json({ error: 'No image data provided' });
      }

      // Validate base64 image data
      const matches = imageData.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: 'Invalid image format. Please use PNG, JPG, JPEG, GIF, or WEBP.' });
      }

      const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      // Check file size (max 8MB)
      if (buffer.length > 8 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image is too large. Maximum size is 8MB.' });
      }

      // Get guild
      const guild = await this.client.guilds.fetch(guildId);

      // Get configured storage channel from guildSettings
      const guildSettings = await this.collections.guildSettings.findOne({ guildId });
      let storageChannelId = guildSettings?.gearStorageChannelId;
      let storageChannel = null;

      if (storageChannelId) {
        storageChannel = await guild.channels.fetch(storageChannelId).catch(() => null);
      }

      // Fall back to finding/creating default storage channel
      if (!storageChannel) {
        const STORAGE_CHANNEL_NAME = 'gear-screenshots-storage';
        storageChannel = guild.channels.cache.find(
          ch => ch.name === STORAGE_CHANNEL_NAME && ch.type === 0 // GuildText
        );

        if (!storageChannel) {
          // Try to create storage channel
          try {
            storageChannel = await guild.channels.create({
              name: STORAGE_CHANNEL_NAME,
              type: 0, // GuildText
              topic: 'Bot-only storage for gear screenshots. DO NOT DELETE THIS CHANNEL!',
              permissionOverwrites: [
                {
                  id: guild.id,
                  deny: ['ViewChannel']
                },
                {
                  id: this.client.user.id,
                  allow: ['ViewChannel', 'SendMessages', 'AttachFiles', 'EmbedLinks', 'ReadMessageHistory', 'ManageMessages']
                }
              ]
            });
          } catch (createErr) {
            console.error('Failed to create storage channel:', createErr);
            return res.status(500).json({ error: 'Could not create storage channel. Bot may be missing permissions.' });
          }
        }
      }

      // Check if user already has a stored gear screenshot to delete
      const existingPlayer = await this.collections.partyPlayers.findOne({ userId, guildId });
      if (existingPlayer?.gearStorageMessageId && existingPlayer?.gearStorageChannelId) {
        try {
          const oldChannel = await guild.channels.fetch(existingPlayer.gearStorageChannelId).catch(() => null);
          if (oldChannel) {
            const oldMessage = await oldChannel.messages.fetch(existingPlayer.gearStorageMessageId).catch(() => null);
            if (oldMessage) {
              await oldMessage.delete();
              console.log(`Deleted old gear screenshot for user ${userId}`);
            }
          }
        } catch (deleteErr) {
          console.warn('Could not delete old gear screenshot:', deleteErr.message);
        }
      }

      // Upload to storage channel
      const fileName = `gear_${userId}_${Date.now()}.${extension}`;
      const storedMessage = await storageChannel.send({
        content: `Gear for <@${userId}> | Uploaded: <t:${Math.floor(Date.now() / 1000)}:F>`,
        files: [{
          attachment: buffer,
          name: fileName
        }]
      });

      const attachment = storedMessage.attachments.first();
      if (!attachment) {
        return res.status(500).json({ error: 'Failed to upload screenshot' });
      }

      const screenshotUrl = attachment.url;

      // Update player info with new screenshot and storage info
      await this.collections.partyPlayers.updateOne(
        { userId, guildId },
        {
          $set: {
            gearScreenshotUrl: screenshotUrl,
            gearStorageMessageId: storedMessage.id,
            gearStorageChannelId: storageChannel.id,
            gearScreenshotUpdatedAt: new Date(),
            gearScreenshotSource: 'discord_storage',
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      // Trigger roster update
      try {
        const rosterRecord = await this.collections.guildRosters.findOne({ guildId });
        if (rosterRecord && rosterRecord.channelId) {
          await updateGuildRoster(guild, rosterRecord.channelId, this.collections);
          console.log(`Roster updated after gear screenshot upload for user ${userId}`);
        }
      } catch (rosterErr) {
        console.error('Failed to update roster after gear upload:', rosterErr);
      }

      // Post gear check embed to configured channel
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        const playerInfo = await this.collections.partyPlayers.findOne({ userId, guildId });
        if (member && playerInfo) {
          await postGearCheckEmbed(guild, member, playerInfo, this.collections);
          console.log(`Gear check embed posted for user ${userId}`);
        }
      } catch (embedErr) {
        console.error('Failed to post gear check embed:', embedErr);
      }

      res.json({
        success: true,
        message: 'Gear screenshot uploaded successfully',
        screenshotUrl
      });

    } catch (error) {
      console.error('Error uploading gear screenshot:', error);
      res.status(500).json({ error: 'Failed to upload gear screenshot' });
    }
  }

  /**
   * Handle get roster data API request
   */
  async handleGetRosterData(req, res) {
    try {
      const { guildId } = req.session;

      // Get all players with info submitted
      const players = await this.collections.partyPlayers.find({
        guildId,
        weapon1: { $exists: true },
        weapon2: { $exists: true }
      }).toArray();

      // Get guild settings for weekly total events
      const guildSettings = await this.collections.guildSettings.findOne({ guildId });
      const weeklyTotalEvents = guildSettings?.weeklyTotalEvents || 0;

      // Fetch guild for member info
      const guild = await this.client.guilds.fetch(guildId);

      // Enrich player data with display names, avatars, PvP stats
      const enrichedPlayers = await Promise.all(
        players.map(async (player) => {
          // Get member info
          const member = await guild.members.fetch(player.userId).catch(() => null);
          const displayName = member?.displayName || 'Unknown';
          const avatarUrl = member?.user?.displayAvatarURL({ size: 64, format: 'png' }) || null;

          // Get PvP activity ranking (total events)
          const pvpActivity = await this.collections.pvpActivityRanking.findOne({
            userId: player.userId,
            guildId
          });
          const totalEvents = pvpActivity?.totalEvents || 0;

          // Get PvP bonuses (weekly attendance)
          const pvpBonus = await this.collections.pvpBonuses.findOne({
            userId: player.userId,
            guildId
          });
          const eventsAttended = pvpBonus?.eventsAttended || 0;
          const bonusCount = pvpBonus?.bonusCount || 0;

          // Calculate attendance percentage
          const attendancePercent = weeklyTotalEvents > 0
            ? Math.round((eventsAttended / weeklyTotalEvents) * 100)
            : 0;

          return {
            userId: player.userId,
            displayName,
            avatarUrl,
            weapon1: player.weapon1 || 'Unknown',
            weapon2: player.weapon2 || 'Unknown',
            cp: player.cp || 0,
            role: player.role || 'dps',
            totalEvents,
            eventsAttended,
            bonusCount,
            attendancePercent,
            buildLink: player.buildLink || null,
            gearScreenshotUrl: player.gearScreenshotUrl || null
          };
        })
      );

      // Calculate summary stats
      const summary = {
        totalPlayers: enrichedPlayers.length,
        totalCP: enrichedPlayers.reduce((sum, p) => sum + p.cp, 0),
        tanks: enrichedPlayers.filter(p => p.role === 'tank').length,
        healers: enrichedPlayers.filter(p => p.role === 'healer').length,
        dps: enrichedPlayers.filter(p => p.role === 'dps').length,
        weeklyTotalEvents
      };

      res.json({
        players: enrichedPlayers,
        summary
      });

    } catch (error) {
      console.error('Error getting roster data:', error);
      res.status(500).json({ error: 'Failed to get roster data' });
    }
  }

  /**
   * Handle getting party members data
   * Returns members in the user's static party
   */
  async handleGetPartyMembers(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Find the user's party
      const party = await this.collections.parties.findOne({
        guildId,
        'members.userId': userId,
        isReserve: { $ne: true }
      });

      if (!party) {
        return res.json({ members: [] });
      }

      // Get guild for member info
      const guild = await this.client.guilds.fetch(guildId);

      // Enrich party members with display names and avatars
      const enrichedMembers = await Promise.all(
        (party.members || []).map(async (member) => {
          const guildMember = await guild.members.fetch(member.userId).catch(() => null);
          const displayName = guildMember?.displayName || member.name || 'Unknown';
          const avatarUrl = guildMember?.user?.displayAvatarURL({ size: 64, format: 'png' }) || null;

          // Get player info for weapons and CP
          const playerInfo = await this.collections.partyPlayers.findOne({
            userId: member.userId,
            guildId
          });

          return {
            userId: member.userId,
            displayName,
            avatarUrl,
            weapon1: playerInfo?.weapon1 || member.weapon1 || 'Unknown',
            weapon2: playerInfo?.weapon2 || member.weapon2 || 'Unknown',
            cp: playerInfo?.cp || member.cp || 0,
            role: playerInfo?.role || member.role || 'dps',
            isCurrentUser: member.userId === userId
          };
        })
      );

      res.json({
        partyNumber: party.partyNumber,
        members: enrichedMembers
      });

    } catch (error) {
      console.error('Error getting party members:', error);
      res.status(500).json({ error: 'Failed to get party members' });
    }
  }

  /**
   * Handle getting item rolls data
   * Returns active rolls and user's roll history
   */
  async handleGetItemRolls(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Get all active rolls for this guild
      const activeRolls = await this.collections.itemRolls.find({
        guildId,
        closed: { $ne: true },
        endsAt: { $gt: new Date() }
      }).sort({ endsAt: 1 }).toArray();

      // Get rolls where user participated (rolled or passed) - last 20
      const userRollHistory = await this.collections.itemRolls.find({
        guildId,
        closed: true,
        $or: [
          { 'rolls.userId': userId },
          { 'passes.userId': userId }
        ]
      }).sort({ closedAt: -1 }).limit(20).toArray();

      // Fetch guild for member info
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);

      // Helper to enrich roll data with display names
      const enrichRoll = async (roll) => {
        // Add display names to rolls
        const enrichedRolls = await Promise.all(
          (roll.rolls || []).map(async (r) => {
            const member = guild ? await guild.members.fetch(r.userId).catch(() => null) : null;
            return {
              ...r,
              displayName: member?.displayName || 'Unknown',
              avatarUrl: member?.user?.displayAvatarURL({ size: 32, format: 'png' }) || null
            };
          })
        );

        // Add display names to passes
        const enrichedPasses = await Promise.all(
          (roll.passes || []).map(async (p) => {
            const member = guild ? await guild.members.fetch(p.userId).catch(() => null) : null;
            return {
              ...p,
              displayName: member?.displayName || 'Unknown',
              avatarUrl: member?.user?.displayAvatarURL({ size: 32, format: 'png' }) || null
            };
          })
        );

        return {
          _id: roll._id.toString(),
          itemName: roll.itemName,
          trait: roll.trait,
          imageUrl: roll.imageUrl,
          endsAt: roll.endsAt,
          closedAt: roll.closedAt,
          closed: roll.closed || false,
          winnerId: roll.winnerId,
          eligibleUsers: roll.eligibleUsers || [],
          rolls: enrichedRolls,
          passes: enrichedPasses,
          isTiebreaker: roll.isTiebreaker || false
        };
      };

      // Enrich all rolls
      const enrichedActiveRolls = await Promise.all(activeRolls.map(enrichRoll));
      const enrichedHistory = await Promise.all(userRollHistory.map(enrichRoll));

      res.json({
        activeRolls: enrichedActiveRolls,
        rollHistory: enrichedHistory
      });

    } catch (error) {
      console.error('Error getting item rolls:', error);
      res.status(500).json({ error: 'Failed to get item rolls' });
    }
  }

  /**
   * Check if profile user has admin access
   */
  async handleProfileCheckAdminAccess(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Get guild and member
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      // Check if user has administrator permission
      const isAdmin = member.permissions.has('Administrator');

      // Check if user has any authorized admin roles
      const settings = await this.collections.guildSettings.findOne({ guildId });
      const adminRoles = settings?.adminPanelRoles || settings?.pvpCodeManagers || [];
      const hasAdminRole = adminRoles.some(roleId => member.roles.cache.has(roleId));

      res.json({
        hasAccess: isAdmin || hasAdminRole,
        isAdmin,
        hasAdminRole
      });

    } catch (error) {
      console.error('Error checking admin access:', error);
      res.status(500).json({ error: 'Failed to check admin access' });
    }
  }

  /**
   * Get admin panel link for profile user
   */
  async handleProfileGetAdminPanelLink(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Check admin access first
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      const isAdmin = member.permissions.has('Administrator');
      const settings = await this.collections.guildSettings.findOne({ guildId });
      const adminRoles = settings?.adminPanelRoles || settings?.pvpCodeManagers || [];
      const hasAdminRole = adminRoles.some(roleId => member.roles.cache.has(roleId));

      if (!isAdmin && !hasAdminRole) {
        return res.status(403).json({ error: 'You do not have admin access' });
      }

      // Redirect to admin panel (no token needed with session auth)
      res.json({
        url: `/admin-panel`
      });

    } catch (error) {
      console.error('Error getting admin panel link:', error);
      res.status(500).json({ error: 'Failed to get admin panel link' });
    }
  }

  // ==========================================
  // Admin Panel Handlers
  // ==========================================

  /**
   * Handle admin panel page request
   */
  async handleAdminPanelPage(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Fetch guild
      const guild = await this.client.guilds.fetch(guildId);

      // Render the admin panel page
      res.render('admin-panel', {
        guildId,
        userId,
        guildName: guild.name,
        hasExcludedRole: req.hasExcludedRole || false
      });

    } catch (error) {
      console.error('Error loading admin panel page:', error);
      res.status(500).render('error', {
        message: 'Failed to load admin panel. Please try again.'
      });
    }
  }

  /**
   * Check admin access for a profile user
   * Used to determine if the admin panel button should be shown
   */
  async handleCheckAdminAccess(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Get guild and member
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      // Check if user has administrator permission
      const isAdmin = member.permissions.has('Administrator');

      // Check if user has any authorized admin roles
      const settings = await this.collections.guildSettings.findOne({ guildId });
      const adminRoles = settings?.adminPanelRoles || settings?.pvpCodeManagers || [];
      const hasAdminRole = adminRoles.some(roleId => member.roles.cache.has(roleId));

      res.json({
        hasAccess: isAdmin || hasAdminRole,
        isAdmin,
        hasAdminRole
      });

    } catch (error) {
      console.error('Error checking admin access:', error);
      res.status(500).json({ error: 'Failed to check admin access' });
    }
  }

  /**
   * Get guild members for user selection
   */
  async handleAdminGetMembers(req, res) {
    try {
      const { guildId } = req.session;

      // Get guild - use cache to avoid rate limits
      const guild = await this.client.guilds.fetch(guildId);

      // Get party players for additional info
      const partyPlayers = await this.collections.partyPlayers
        .find({ guildId })
        .toArray();
      const playerMap = new Map(partyPlayers.map(p => [p.userId, p]));

      // Get wishlist submissions
      const wishlists = await this.collections.wishlistSubmissions
        .find({ guildId })
        .toArray();
      const wishlistMap = new Map(wishlists.map(w => [w.userId, w]));

      // Build member list from cache (exclude bots)
      // Use existing cache to avoid rate limit errors
      const members = guild.members.cache
        .filter(m => !m.user.bot)
        .map(m => {
          const playerInfo = playerMap.get(m.id);
          const wishlist = wishlistMap.get(m.id);
          return {
            userId: m.id,
            displayName: m.displayName,
            username: m.user.username,
            avatarUrl: m.user.displayAvatarURL({ size: 32, format: 'png' }),
            hasPartyInfo: !!(playerInfo?.weapon1 && playerInfo?.weapon2 && playerInfo?.cp),
            hasWishlist: !!wishlist,
            weapon1: playerInfo?.weapon1,
            weapon2: playerInfo?.weapon2,
            cp: playerInfo?.cp,
            role: playerInfo?.role
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      res.json({ members });

    } catch (error) {
      console.error('Error getting members:', error);
      res.status(500).json({ error: 'Failed to get members' });
    }
  }

  /**
   * Get events for the guild
   */
  async handleAdminGetEvents(req, res) {
    try {
      const { guildId } = req.session;

      // Get upcoming and recent events
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const events = await this.collections.pvpEvents
        .find({
          guildId,
          eventTime: { $gte: weekAgo }
        })
        .sort({ eventTime: 1 })
        .toArray();

      const formattedEvents = events.map(event => ({
        _id: event._id.toString(),
        eventType: event.eventType,
        eventTypeName: EVENT_TYPE_NAMES[event.eventType] || event.eventType,
        location: event.location,
        eventTime: event.eventTime,
        closed: event.closed || false,
        partiesFormed: event.partiesFormed || false,
        bonusPoints: event.bonusPoints || 10,
        rsvpAttendingCount: (event.rsvpAttending || []).length,
        rsvpMaybeCount: (event.rsvpMaybe || []).length,
        rsvpNotAttendingCount: (event.rsvpNotAttending || []).length,
        attendeesCount: (event.attendees || []).length,
        isPast: event.eventTime < now
      }));

      res.json({ events: formattedEvents });

    } catch (error) {
      console.error('Error getting events:', error);
      res.status(500).json({ error: 'Failed to get events' });
    }
  }

  /**
   * Get text channels for item roll destination
   */
  async handleAdminGetChannels(req, res) {
    try {
      const { guildId } = req.session;

      // Get guild and channels
      const guild = await this.client.guilds.fetch(guildId);

      // Get text channels (type 0) that the bot can send messages to
      const channels = guild.channels.cache
        .filter(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'))
        .map(c => ({
          id: c.id,
          name: c.name,
          category: c.parent?.name || 'No Category'
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      res.json({ channels });

    } catch (error) {
      console.error('Error getting channels:', error);
      res.status(500).json({ error: 'Failed to get channels' });
    }
  }

  /**
   * Get static party editor token
   */
  async handleAdminGetStaticPartyToken(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Generate a static party token
      const token = this.generateStaticPartyToken(guildId, userId);
      const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${this.port}`;

      res.json({
        url: `${baseUrl}/static-party-editor/${token}`,
        token
      });

    } catch (error) {
      console.error('Error generating static party token:', error);
      res.status(500).json({ error: 'Failed to generate static party editor link' });
    }
  }

  /**
   * Get event party editor token and process parties
   */
  async handleAdminGetEventPartyToken(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { eventId } = req.params;

      // Import party manager functions
      const { getRoleFromWeapons } = require('../features/parties/roleDetection');

      // Fetch the event
      const event = await this.collections.pvpEvents.findOne({
        _id: new ObjectId(eventId)
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get attendance data
      const notAttendingSet = new Set(event.rsvpNotAttending || []);
      const attendingSet = new Set([
        ...(event.rsvpAttending || []),
        ...(event.rsvpMaybe || [])
      ]);

      if (attendingSet.size === 0) {
        return res.status(400).json({
          error: 'No members have RSVPd as attending or maybe for this event'
        });
      }

      // Get guild
      const guild = await this.client.guilds.fetch(guildId);

      // Fetch all static parties (exclude reserve)
      const staticParties = await this.collections.parties.find({
        guildId,
        isReserve: { $ne: true }
      }).sort({ partyNumber: 1 }).toArray();

      // Process each static party
      const processedParties = [];
      const availableMembers = [];

      for (const party of staticParties) {
        const removedMembers = [];
        const remainingMembers = [];

        for (const member of party.members || []) {
          const discordMember = await guild.members.fetch(member.userId).catch(() => null);
          const playerInfo = await this.collections.partyPlayers.findOne({
            userId: member.userId,
            guildId
          });

          const enrichedMember = {
            userId: member.userId,
            displayName: discordMember?.displayName || 'Unknown',
            weapon1: member.weapon1 || playerInfo?.weapon1,
            weapon2: member.weapon2 || playerInfo?.weapon2,
            role: member.role || playerInfo?.role || 'dps',
            cp: member.cp || playerInfo?.cp || 0,
            isLeader: member.isLeader || false
          };

          if (notAttendingSet.has(member.userId)) {
            removedMembers.push(enrichedMember);
          } else {
            remainingMembers.push(enrichedMember);
          }
        }

        // Decide if party should be disbanded (less than 3 members remaining)
        if (remainingMembers.length < 3) {
          availableMembers.push(...remainingMembers.map(m => ({
            ...m,
            source: `Party ${party.partyNumber} (disbanded)`
          })));
        } else {
          const status = removedMembers.length > 0 ? 'modified' : 'intact';
          const composition = { tank: 0, healer: 0, dps: 0 };
          remainingMembers.forEach(m => composition[m.role]++);

          processedParties.push({
            partyNumber: party.partyNumber,
            status,
            members: remainingMembers,
            removedMembers,
            composition
          });
        }
      }

      // Find unassigned attendees
      const assignedUserIds = new Set(
        processedParties.flatMap(p => p.members.map(m => m.userId))
      );
      const availableFromDisbanded = new Set(availableMembers.map(m => m.userId));

      for (const usrId of attendingSet) {
        if (!assignedUserIds.has(usrId) && !availableFromDisbanded.has(usrId)) {
          const discordMember = await guild.members.fetch(usrId).catch(() => null);
          const playerInfo = await this.collections.partyPlayers.findOne({
            userId: usrId,
            guildId
          });

          if (playerInfo?.weapon1 && playerInfo?.weapon2) {
            const role = playerInfo.role || getRoleFromWeapons(playerInfo.weapon1, playerInfo.weapon2);
            availableMembers.push({
              userId: usrId,
              displayName: discordMember?.displayName || 'Unknown',
              weapon1: playerInfo.weapon1,
              weapon2: playerInfo.weapon2,
              role,
              cp: playerInfo.cp || 0,
              isLeader: false,
              source: 'Unassigned'
            });
          }
        }
      }

      // Calculate summary
      const summary = {
        totalAttending: attendingSet.size,
        partiesIntact: processedParties.filter(p => p.status === 'intact').length,
        partiesModified: processedParties.filter(p => p.status === 'modified').length,
        partiesDisbanded: staticParties.length - processedParties.length,
        membersAvailable: availableMembers.length
      };

      // Store the formation
      await this.collections.eventParties.updateOne(
        { eventId: new ObjectId(eventId) },
        {
          $set: {
            eventId: new ObjectId(eventId),
            guildId,
            processedParties,
            availableMembers,
            summary,
            status: 'pending',
            createdBy: userId,
            createdAt: new Date(),
            approved: false
          }
        },
        { upsert: true }
      );

      // Generate party editor token
      const token = this.generateToken(eventId, userId);
      const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${this.port}`;

      res.json({
        url: `${baseUrl}/party-editor/${token}`,
        token,
        summary
      });

    } catch (error) {
      console.error('Error generating event party token:', error);
      res.status(500).json({ error: 'Failed to generate event party editor link' });
    }
  }

  /**
   * Reset user party info
   */
  async handleAdminResetParty(req, res) {
    try {
      const { guildId } = req.session;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Delete the player's info
      const deleteResult = await this.collections.partyPlayers.deleteOne({
        guildId,
        userId
      });

      if (deleteResult.deletedCount === 0) {
        return res.status(404).json({ error: 'User has no party info to reset' });
      }

      // Remove the user from all parties
      const party = await this.collections.parties.findOne({
        guildId,
        'members.userId': userId
      });

      if (party) {
        const member = party.members.find(m => m.userId === userId);

        await this.collections.parties.updateOne(
          { _id: party._id },
          {
            $pull: { members: { userId } },
            $inc: {
              totalCP: -(member?.cp || 0),
              [`roleComposition.${member?.role || 'dps'}`]: -1
            }
          }
        );
      }

      // Get user display name for response
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId).catch(() => null);

      res.json({
        success: true,
        message: `Party info reset for ${member?.displayName || userId}`,
        wasInParty: !!party
      });

    } catch (error) {
      console.error('Error resetting party:', error);
      res.status(500).json({ error: 'Failed to reset party info' });
    }
  }

  /**
   * Reset user wishlist
   */
  async handleAdminResetWishlist(req, res) {
    try {
      const { guildId } = req.session;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Check if user has a wishlist
      const existingWishlist = await this.collections.wishlistSubmissions.findOne({
        userId,
        guildId
      });

      // Check if user has received items
      const receivedItems = await this.collections.wishlistGivenItems.find({
        userId,
        guildId
      }).toArray();

      const hasReceivedItems = receivedItems.length > 0;

      if (!existingWishlist && !hasReceivedItems) {
        return res.status(404).json({ error: 'User does not have a submitted wishlist or any received items' });
      }

      if (!existingWishlist) {
        return res.status(404).json({ 
          error: `User does not have a submitted wishlist to reset.${hasReceivedItems ? ` They have ${receivedItems.length} received item(s) on record which will remain visible in the wishlist panel.` : ''}` 
        });
      }

      // Delete the wishlist submission (keep given items as historical record)
      await this.collections.wishlistSubmissions.deleteOne({
        userId,
        guildId
      });

      // Update wishlist panels
      await updateWishlistPanels({
        client: this.client,
        guildId,
        collections: this.collections
      });

      // Send DM to user
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId).catch(() => null);

      if (member) {
        const dmMessage = receivedItems.length > 0
          ? `📋 **Wishlist Reset Notification**\n\nYour wishlist in **${guild.name}** has been reset by an administrator.\n\n✅ **Your ${receivedItems.length} previously received item(s) are preserved.** You can only modify items you haven't received yet.\n\nYou can now update your wishlist using the \`/mywishlist\` command.`
          : `📋 **Wishlist Reset Notification**\n\nYour wishlist in **${guild.name}** has been reset by an administrator.\n\nYou can now submit a new wishlist using the \`/mywishlist\` command.`;

        await member.send({ content: dmMessage }).catch(() => {});
      }

      res.json({
        success: true,
        message: `Wishlist reset for ${member?.displayName || userId}`,
        hadReceivedItems: receivedItems.length > 0,
        receivedItemsCount: receivedItems.length
      });

    } catch (error) {
      console.error('Error resetting wishlist:', error);
      res.status(500).json({ error: 'Failed to reset wishlist' });
    }
  }

  /**
   * Get item categories for item roll
   */
  async handleAdminGetItemCategories(req, res) {
    try {
      const { getCategories } = require('../features/itemroll/data/items');
      res.json({ categories: getCategories() });

    } catch (error) {
      console.error('Error getting item categories:', error);
      res.status(500).json({ error: 'Failed to get item categories' });
    }
  }

  /**
   * Get item subcategories
   */
  async handleAdminGetItemSubcategories(req, res) {
    try {
      const { category } = req.params;
      const { getSubcategories } = require('../features/itemroll/data/items');

      res.json({ subcategories: getSubcategories(category) });

    } catch (error) {
      console.error('Error getting item subcategories:', error);
      res.status(500).json({ error: 'Failed to get item subcategories' });
    }
  }

  /**
   * Get items for a category/subcategory
   */
  async handleAdminGetItems(req, res) {
    try {
      const { category, subcategory } = req.params;
      const { getItems } = require('../features/itemroll/data/items');

      res.json({ items: getItems(category, subcategory) });

    } catch (error) {
      console.error('Error getting items:', error);
      res.status(500).json({ error: 'Failed to get items' });
    }
  }

  /**
   * Create item roll
   */
  async handleAdminCreateItemRoll(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { itemValue, trait, duration, channelId, eligibleUsers } = req.body;

      if (!itemValue || !trait || !duration || !channelId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get item data
      const { getItemFromValue } = require('../features/itemroll/data/items');
      const itemData = getItemFromValue(itemValue);

      if (!itemData) {
        return res.status(400).json({ error: 'Invalid item selection' });
      }

      // Parse duration
      const durationHours = parseInt(duration);
      if (isNaN(durationHours) || durationHours < 1) {
        return res.status(400).json({ error: 'Duration must be at least 1 hour' });
      }

      const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

      // Create item roll
      const itemRoll = {
        itemName: itemData.name,
        imageUrl: itemData.imageUrl,
        trait,
        guildId,
        channelId,
        userId,
        eligibleUsers: eligibleUsers || [], // Empty means everyone
        rolls: [],
        passes: [],
        closed: false,
        createdAt: new Date(),
        endsAt
      };

      const result = await this.collections.itemRolls.insertOne(itemRoll);
      itemRoll._id = result.insertedId;

      // Get channel and send the embed
      const guild = await this.client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (!channel) {
        await this.collections.itemRolls.deleteOne({ _id: itemRoll._id });
        return res.status(400).json({ error: 'Channel not found' });
      }

      // Create and send the embed
      const { createItemRollEmbed } = require('../features/itemroll/itemRollEmbed');
      const { embed, components } = await createItemRollEmbed(
        itemRoll,
        this.client,
        this.collections
      );

      // Create mention string
      let mentions = '';
      if (eligibleUsers && eligibleUsers.length > 0) {
        mentions = eligibleUsers.map(id => `<@${id}>`).join(' ');
      }

      const rollMessage = await channel.send({
        content: mentions || undefined,
        embeds: [embed],
        components,
        allowedMentions: mentions ? { parse: ['users'] } : undefined
      });

      // Save message ID
      await this.collections.itemRolls.updateOne(
        { _id: itemRoll._id },
        { $set: { messageId: rollMessage.id } }
      );

      // Schedule auto-close
      const { scheduleItemRollClose } = require('../features/itemroll/handlers/itemRollButtons');
      scheduleItemRollClose(itemRoll, this.client, this.collections);

      res.json({
        success: true,
        message: 'Item roll created successfully',
        rollId: itemRoll._id.toString(),
        messageUrl: rollMessage.url,
        endsAt
      });

    } catch (error) {
      console.error('Error creating item roll:', error);
      res.status(500).json({ error: 'Failed to create item roll' });
    }
  }

  /**
   * Get wishlisted items for give item feature
   */
  async handleAdminGetWishlistedItems(req, res) {
    try {
      const { guildId } = req.session;

      // Get all wishlist submissions
      const submissions = await this.collections.wishlistSubmissions
        .find({ guildId })
        .toArray();

      if (submissions.length === 0) {
        return res.json({ items: [] });
      }

      // Collect all wishlisted items with users
      const itemUserMap = new Map();

      const processItems = (itemIds, userId) => {
        if (!itemIds) return;
        for (const itemId of itemIds) {
          if (!itemUserMap.has(itemId)) {
            itemUserMap.set(itemId, []);
          }
          itemUserMap.get(itemId).push(userId);
        }
      };

      for (const submission of submissions) {
        processItems(submission.archbossWeapon, submission.userId);
        processItems(submission.archbossArmor, submission.userId);
        processItems(submission.t3Weapons, submission.userId);
        processItems(submission.t3Armors, submission.userId);
        processItems(submission.t3Accessories, submission.userId);
      }

      // Get item details
      const { getItemById } = require('../features/wishlist/utils/items');

      const guild = await this.client.guilds.fetch(guildId);

      const items = [];
      for (const [itemId, userIds] of itemUserMap) {
        const item = getItemById(itemId);
        if (item) {
          // Get user display names
          const users = await Promise.all(userIds.map(async (uid) => {
            const member = await guild.members.fetch(uid).catch(() => null);
            return {
              userId: uid,
              displayName: member?.displayName || 'Unknown'
            };
          }));

          items.push({
            id: item.id,
            name: item.name,
            category: item.category || item.type,
            imageUrl: item.imageUrl,
            users
          });
        }
      }

      // Sort by category, then by name
      items.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
      });

      res.json({ items });

    } catch (error) {
      console.error('Error getting wishlisted items:', error);
      res.status(500).json({ error: 'Failed to get wishlisted items' });
    }
  }

  /**
   * Give item to users
   */
  async handleAdminGiveItem(req, res) {
    try {
      const { guildId, userId: adminUserId } = req.session;
      const { distributions } = req.body;

      if (!distributions || !Array.isArray(distributions) || distributions.length === 0) {
        return res.status(400).json({ error: 'No distributions provided' });
      }

      const now = new Date();
      let totalGiven = 0;

      // Process each distribution
      for (const { itemId, userIds } of distributions) {
        if (!itemId || !userIds || !Array.isArray(userIds)) continue;

        for (const uid of userIds) {
          await this.collections.wishlistGivenItems.updateOne(
            { guildId, userId: uid, itemId },
            {
              $set: {
                givenAt: now,
                givenBy: adminUserId
              }
            },
            { upsert: true }
          );
          totalGiven++;
        }
      }

      // Update wishlist panels
      await updateWishlistPanels({
        client: this.client,
        guildId,
        collections: this.collections
      });

      res.json({
        success: true,
        message: `Successfully distributed ${totalGiven} item(s)`,
        totalGiven
      });

    } catch (error) {
      console.error('Error giving items:', error);
      res.status(500).json({ error: 'Failed to give items' });
    }
  }

  /**
   * Get wishlist submissions grouped by user
   */
  async handleAdminGetWishlistSubmissions(req, res) {
    try {
      const { guildId } = req.session;

      // Get all wishlist submissions
      const submissions = await this.collections.wishlistSubmissions
        .find({ guildId })
        .toArray();

      if (submissions.length === 0) {
        return res.json({ submissions: [] });
      }

      const { getItemById } = require('../features/wishlist/utils/items');
      const guild = await this.client.guilds.fetch(guildId);

      // Get given items for this guild
      const givenItems = await this.collections.wishlistGivenItems
        .find({ guildId })
        .toArray();

      // Create a lookup for given items - Map of userId -> Set of itemIds
      const givenItemsLookup = new Map();
      for (const given of givenItems) {
        if (!givenItemsLookup.has(given.userId)) {
          givenItemsLookup.set(given.userId, new Set());
        }
        givenItemsLookup.get(given.userId).add(given.itemId);
      }

      // Format submissions with user info
      const formattedSubmissions = await Promise.all(
        submissions.map(async (submission) => {
          const member = await guild.members.fetch(submission.userId).catch(() => null);
          
          const userGivenItems = givenItemsLookup.get(submission.userId) || new Set();
          
          const formatItems = (itemIds) => {
            if (!itemIds || itemIds.length === 0) return [];
            return itemIds.map(itemId => {
              const item = getItemById(itemId);
              if (!item) {
                console.warn(`Unknown item ID in wishlist: ${itemId}`);
                return null;
              }
              return {
                id: itemId,
                name: item.name,
                imageUrl: item.icon || '',
                category: item.category || 'Unknown',
                received: userGivenItems.has(itemId)
              };
            }).filter(item => item !== null);
          };

          return {
            userId: submission.userId,
            displayName: member?.displayName || 'Unknown User',
            avatarUrl: member?.user.displayAvatarURL() || '',
            archbossWeapon: formatItems(submission.archbossWeapon),
            archbossArmor: formatItems(submission.archbossArmor),
            t3Weapons: formatItems(submission.t3Weapons),
            t3Armors: formatItems(submission.t3Armors),
            t3Accessories: formatItems(submission.t3Accessories)
          };
        })
      );

      // Sort by display name
      formattedSubmissions.sort((a, b) => a.displayName.localeCompare(b.displayName));

      res.json({ submissions: formattedSubmissions });

    } catch (error) {
      console.error('Error getting wishlist submissions:', error);
      res.status(500).json({ error: 'Failed to get wishlist submissions' });
    }
  }

  /**
   * Get given items history
   */
  async handleAdminGetGivenItems(req, res) {
    try {
      const { guildId } = req.session;

      // Get all given items
      const givenItems = await this.collections.wishlistGivenItems
        .find({ guildId })
        .toArray();

      if (givenItems.length === 0) {
        return res.json({ givenItems: [] });
      }

      const { getItemById } = require('../features/wishlist/utils/items');
      const guild = await this.client.guilds.fetch(guildId);

      // Format given items with user and item info
      const formattedGivenItems = await Promise.all(
        givenItems.map(async (given) => {
          const member = await guild.members.fetch(given.userId).catch(() => null);
          const givenByMember = await guild.members.fetch(given.givenBy).catch(() => null);
          const item = getItemById(given.itemId);

          return {
            userId: given.userId,
            displayName: member?.displayName || 'Unknown User',
            avatarUrl: member?.user.displayAvatarURL() || '',
            itemId: given.itemId,
            itemName: item?.name || 'Unknown Item',
            itemImageUrl: item?.icon || '',
            itemCategory: item?.category || 'Unknown',
            givenAt: given.givenAt,
            givenBy: given.givenBy,
            givenByName: givenByMember?.displayName || 'Unknown Admin'
          };
        })
      );

      // Sort by date (most recent first)
      formattedGivenItems.sort((a, b) => new Date(b.givenAt) - new Date(a.givenAt));

      res.json({ givenItems: formattedGivenItems });

    } catch (error) {
      console.error('Error getting given items:', error);
      res.status(500).json({ error: 'Failed to get given items' });
    }
  }

  /**
   * Send party info reminders
   */
  async handleAdminRemindParties(req, res) {
    try {
      const { guildId, userId: adminUserId } = req.session;

      // Get excluded roles
      const settings = await this.collections.guildSettings.findOne({ guildId });
      const excludedRoles = settings?.excludedRoles || [];

      // Get guild - use cache to avoid rate limits
      const guild = await this.client.guilds.fetch(guildId);

      // Filter out bots and excluded roles using cache
      const humans = guild.members.cache.filter(m => {
        if (m.user.bot) return false;
        if (excludedRoles.length > 0) {
          const hasExcludedRole = m.roles.cache.some(role => excludedRoles.includes(role.id));
          if (hasExcludedRole) return false;
        }
        return true;
      });

      // Get all players who have complete party info
      const playersWithInfo = await this.collections.partyPlayers.find({
        guildId,
        weapon1: { $exists: true },
        weapon2: { $exists: true },
        cp: { $exists: true }
      }).toArray();

      const playersWithCompleteInfo = new Set(playersWithInfo.map(p => p.userId));

      // Find users who haven't set up their party info
      const needsSetup = humans.filter(m => !playersWithCompleteInfo.has(m.id));

      if (needsSetup.size === 0) {
        return res.json({
          success: true,
          message: 'All members have already set up their party info!',
          successCount: 0,
          failCount: 0
        });
      }

      // Prepare reminder embed
      const reminderEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Party Info Setup Reminder')
        .setDescription(
          `Hello! This is a reminder from **${guild.name}**.\n\n` +
          `You haven't set up your party information yet! This information is needed for party assignments.\n\n` +
          `**Please use the \`/myinfo\` command in the server to set up your info:**\n\n` +
          `• Primary Weapon\n` +
          `• Secondary Weapon\n` +
          `• Combat Power (CP)\n` +
          `• Gear Check (mandatory)\n\n` +
          `This will only take a moment and helps us organize our parties better. Thank you!`
        )
        .setTimestamp();

      // Send DMs with longer delay to avoid rate limits (2 seconds between DMs)
      let successCount = 0;
      let failCount = 0;

      for (const member of needsSetup.values()) {
        try {
          await member.send({ embeds: [reminderEmbed] });
          successCount++;
          // Increased delay to 2 seconds to avoid Discord rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          failCount++;
        }
      }

      res.json({
        success: true,
        message: `Sent reminders to ${successCount} user(s)`,
        successCount,
        failCount,
        totalNeeded: needsSetup.size
      });

    } catch (error) {
      console.error('Error sending party reminders:', error);
      res.status(500).json({ error: 'Failed to send party reminders' });
    }
  }

  /**
   * Send wishlist reminders
   */
  async handleAdminRemindWishlist(req, res) {
    try {
      const { guildId } = req.session;

      // Get excluded roles
      const settings = await this.collections.guildSettings.findOne({ guildId });
      const excludedRoles = settings?.excludedRoles || [];

      // Get guild - use cache to avoid rate limits
      const guild = await this.client.guilds.fetch(guildId);

      // Get all users who have submitted wishlists
      const submittedUsers = await this.collections.wishlistSubmissions
        .find({ guildId })
        .toArray();

      const submittedUserIds = new Set(submittedUsers.map(s => s.userId));

      // Filter members who need reminders using cache
      const needReminder = guild.members.cache.filter(member => {
        if (member.user.bot) return false;
        if (submittedUserIds.has(member.id)) return false;
        const memberRoleIds = member.roles.cache.map(r => r.id);
        if (memberRoleIds.some(roleId => excludedRoles.includes(roleId))) return false;
        return true;
      });

      if (needReminder.size === 0) {
        return res.json({
          success: true,
          message: 'All eligible members have already submitted their wishlists!',
          successCount: 0,
          failCount: 0
        });
      }

      // Send reminders with longer delay to avoid rate limits
      let successCount = 0;
      let failCount = 0;

      const reminderMessage = `📋 **Wishlist Reminder**\n\nHello! You haven't submitted your wishlist yet in **${guild.name}**.\n\nPlease use the \`/mywishlist\` command to set up your wishlist and help coordinate gear distribution.\n\nThank you!`;

      for (const [, member] of needReminder) {
        try {
          await member.send({ content: reminderMessage });
          successCount++;
          // Increased delay to 2 seconds to avoid Discord rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          failCount++;
        }
      }

      res.json({
        success: true,
        message: `Sent reminders to ${successCount} user(s)`,
        successCount,
        failCount,
        totalNeeded: needReminder.size
      });

    } catch (error) {
      console.error('Error sending wishlist reminders:', error);
      res.status(500).json({ error: 'Failed to send wishlist reminders' });
    }
  }

  /**
   * Cancel event
   */
  async handleAdminCancelEvent(req, res) {
    try {
      const { guildId } = req.session;
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }

      // Get the event
      const event = await this.collections.pvpEvents.findOne({
        _id: new ObjectId(eventId),
        guildId
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Close the event
      await this.collections.pvpEvents.updateOne(
        { _id: new ObjectId(eventId) },
        { $set: { closed: true } }
      );

      // Update calendar asynchronously
      const { updateCalendar } = require('../features/pvp/calendar/calendarUpdate');
      updateCalendar(this.client, guildId, this.collections).catch(err =>
        console.error('Failed to update calendar after closing event:', err)
      );

      // Update event embed
      try {
        if (event.channelId && event.messageId) {
          const mockInteraction = { client: this.client };
          await updateEventEmbed(mockInteraction, event, this.collections);
          console.log(`✅ PvP event embed updated after canceling event ${eventId}`);
        }
      } catch (err) {
        console.error('Failed to update event embed:', err);
      }

      res.json({
        success: true,
        message: 'Event has been cancelled/closed'
      });

    } catch (error) {
      console.error('Error cancelling event:', error);
      res.status(500).json({ error: 'Failed to cancel event' });
    }
  }

  /**
   * View event code
   */
  async handleAdminViewEventCode(req, res) {
    try {
      const { guildId } = req.session;
      const { eventId } = req.params;

      // Get the event
      const event = await this.collections.pvpEvents.findOne({
        _id: new ObjectId(eventId),
        guildId
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const eventTypeNames = {
        siege: 'Siege',
        riftstone: 'Riftstone Fight',
        boonstone: 'Boonstone Fight',
        wargames: 'Wargames',
        warboss: 'War Boss',
        guildevent: 'Guild Event'
      };

      res.json({
        code: event.password,
        eventType: eventTypeNames[event.eventType] || event.eventType,
        location: event.location,
        eventTime: event.eventTime,
        bonusPoints: event.bonusPoints || 10,
        closed: event.closed || false
      });

    } catch (error) {
      console.error('Error viewing event code:', error);
      res.status(500).json({ error: 'Failed to get event code' });
    }
  }

  /**
   * Get profile link from admin panel
   */
  async handleAdminGetProfileLink(req, res) {
    try {
      // Redirect to profile (no token needed with session auth)
      res.json({
        url: `/profile`
      });

    } catch (error) {
      console.error('Error getting profile link:', error);
      res.status(500).json({ error: 'Failed to get profile link' });
    }
  }

  /**
   * Create a new PvP event
   */
  async handleAdminCreateEvent(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { eventType, location, eventTime, bonusPoints, imageUrl, message, channelId } = req.body;

      // Validate required fields
      if (!eventType) {
        return res.status(400).json({ error: 'Event type is required' });
      }

      if (!eventTime) {
        return res.status(400).json({ error: 'Event time is required' });
      }

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Event description is required' });
      }

      if (!channelId) {
        return res.status(400).json({ error: 'Channel is required' });
      }

      // Validate bonus points
      const parsedBonusPoints = parseInt(bonusPoints) || 10;
      if (parsedBonusPoints < 1 || parsedBonusPoints > 9999) {
        return res.status(400).json({ error: 'Bonus points must be between 1 and 9999' });
      }

      // Validate event type
      const validEventTypes = ['siege', 'riftstone', 'boonstone', 'wargames', 'warboss', 'guildevent'];
      if (!validEventTypes.includes(eventType)) {
        return res.status(400).json({ error: 'Invalid event type' });
      }

      // Check if location is required
      const locationRequired = ['riftstone', 'boonstone', 'warboss', 'guildevent'].includes(eventType);
      if (locationRequired && (!location || location.trim().length === 0)) {
        return res.status(400).json({ error: 'Location is required for this event type' });
      }

      // Parse the event time
      const eventDate = new Date(eventTime);
      if (isNaN(eventDate.getTime())) {
        return res.status(400).json({ error: 'Invalid event time format' });
      }

      // Check if date is in the past
      if (eventDate < new Date()) {
        return res.status(400).json({ error: 'Event time cannot be in the past' });
      }

      // Validate message length
      if (message.length > 2000) {
        return res.status(400).json({ error: 'Description cannot exceed 2000 characters' });
      }

      // Get the channel
      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return res.status(400).json({ error: 'Channel not found' });
      }

      // Verify the channel belongs to the guild
      if (channel.guildId !== guildId) {
        return res.status(403).json({ error: 'Channel does not belong to this guild' });
      }

      // Default event images
      const DEFAULT_EVENT_IMAGES = {
        siege: 'https://i.imgur.com/GVJjTpu.jpeg',
        riftstone: 'https://i.imgur.com/3izMckr.jpeg',
        boonstone: 'https://i.imgur.com/Ax4pkYA.jpeg',
        wargames: 'https://i.imgur.com/qtY18tv.jpeg',
        warboss: 'https://i.imgur.com/hsvWdXJ.png',
        guildevent: 'https://i.imgur.com/RLVX4iT.jpeg'
      };

      // Determine image URL
      const finalImageUrl = (imageUrl && imageUrl.trim().length > 0)
        ? imageUrl.trim()
        : DEFAULT_EVENT_IMAGES[eventType];

      // Generate 4-digit password
      const password = Math.floor(1000 + Math.random() * 9000).toString();

      // Create event in database
      const event = {
        guildId,
        channelId,
        eventType,
        location: locationRequired ? location.trim() : null,
        eventTime: eventDate,
        bonusPoints: parsedBonusPoints,
        imageUrl: finalImageUrl,
        message: message.trim(),
        password,
        attendees: [],
        rsvpAttending: [],
        rsvpNotAttending: [],
        rsvpMaybe: [],
        closed: false,
        createdBy: userId,
        createdAt: new Date()
      };

      const result = await this.collections.pvpEvents.insertOne(event);
      event._id = result.insertedId;

      // Create the event embed
      const { createEventEmbed } = require('../features/pvp/embed');
      const { embed, components } = await createEventEmbed(event, this.client, this.collections);

      const eventMessage = await channel.send({
        content: '@everyone',
        embeds: [embed],
        components,
        allowedMentions: { parse: ['everyone'] }
      });

      // Save message ID
      await this.collections.pvpEvents.updateOne(
        { _id: event._id },
        { $set: { messageId: eventMessage.id } }
      );

      // Update calendar asynchronously
      const { updateCalendar } = require('../features/pvp/calendar/calendarUpdate');
      updateCalendar(this.client, guildId, this.collections).catch(err =>
        console.error('Failed to update calendar after creating event:', err)
      );

      res.json({
        success: true,
        message: 'Event created successfully',
        eventId: event._id.toString(),
        password: password,
        messageUrl: eventMessage.url
      });

    } catch (error) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  }

  /**
   * Get description templates
   */
  async handleAdminGetDescriptionTemplates(req, res) {
    try {
      const { guildId } = req.session;

      // Get templates from database
      const templates = await this.collections.guildSettings.findOne(
        { guildId },
        { projection: { descriptionTemplates: 1 } }
      );

      res.json({
        templates: templates?.descriptionTemplates || []
      });

    } catch (error) {
      console.error('Error getting description templates:', error);
      res.status(500).json({ error: 'Failed to get templates' });
    }
  }

  /**
   * Save description template
   */
  async handleAdminSaveDescriptionTemplate(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { name, content } = req.body;

      // Validate inputs
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Template name is required' });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Template content is required' });
      }

      if (name.length > 50) {
        return res.status(400).json({ error: 'Template name cannot exceed 50 characters' });
      }

      if (content.length > 2000) {
        return res.status(400).json({ error: 'Template content cannot exceed 2000 characters' });
      }

      // Generate template ID
      const templateId = new ObjectId().toString();

      // Add template to guild settings
      await this.collections.guildSettings.updateOne(
        { guildId },
        {
          $push: {
            descriptionTemplates: {
              id: templateId,
              name: name.trim(),
              content: content.trim(),
              createdBy: userId,
              createdAt: new Date()
            }
          }
        },
        { upsert: true }
      );

      res.json({
        success: true,
        message: 'Template saved successfully',
        templateId
      });

    } catch (error) {
      console.error('Error saving description template:', error);
      res.status(500).json({ error: 'Failed to save template' });
    }
  }

  /**
   * Delete description template
   */
  async handleAdminDeleteDescriptionTemplate(req, res) {
    try {
      const { guildId } = req.session;
      const { templateId } = req.params;

      if (!templateId) {
        return res.status(400).json({ error: 'Template ID is required' });
      }

      // Remove template from guild settings
      await this.collections.guildSettings.updateOne(
        { guildId },
        {
          $pull: {
            descriptionTemplates: { id: templateId }
          }
        }
      );

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting description template:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  }

  /**
   * Get party history - list of past events with party formations
   */
  async handleAdminGetPartyHistory(req, res) {
    try {
      const { guildId } = req.session;

      // Get all eventParties for this guild, sorted by creation date descending (newest first)
      const eventParties = await this.collections.eventParties
        .find({ guildId })
        .sort({ createdAt: -1 })
        .toArray();

      if (eventParties.length === 0) {
        return res.json({ history: [] });
      }

      // Get all event IDs
      const eventIds = eventParties.map(ep => ep.eventId);

      // Fetch corresponding events
      const events = await this.collections.pvpEvents
        .find({ _id: { $in: eventIds } })
        .toArray();

      // Create a map of eventId to event data
      const eventMap = new Map();
      events.forEach(event => {
        eventMap.set(event._id.toString(), {
          eventType: event.eventType,
          eventTypeName: EVENT_TYPE_NAMES[event.eventType] || event.eventType,
          location: event.location,
          eventTime: event.eventTime
        });
      });

      // Combine eventParties with event data
      const history = eventParties
        .filter(ep => eventMap.has(ep.eventId.toString()))
        .map(ep => ({
          _id: ep._id.toString(),
          event: eventMap.get(ep.eventId.toString()),
          summary: ep.summary || {
            totalAttending: 0,
            partiesIntact: 0,
            partiesModified: 0,
            partiesDisbanded: 0,
            membersRemoved: 0,
            membersAvailable: 0
          },
          createdAt: ep.createdAt,
          partiesFormedAt: ep.partiesFormedAt
        }));

      res.json({ history });

    } catch (error) {
      console.error('Error getting party history:', error);
      res.status(500).json({ error: 'Failed to get party history' });
    }
  }

  /**
   * Get detailed party information for a specific event
   */
  async handleAdminGetPartyDetails(req, res) {
    try {
      const { guildId } = req.session;
      const { eventPartyId } = req.params;

      if (!eventPartyId) {
        return res.status(400).json({ error: 'Event party ID is required' });
      }

      // Get the eventParty document
      const eventParty = await this.collections.eventParties.findOne({
        _id: new ObjectId(eventPartyId),
        guildId
      });

      if (!eventParty) {
        return res.status(404).json({ error: 'Party data not found' });
      }

      // Get the event data
      const event = await this.collections.pvpEvents.findOne({
        _id: eventParty.eventId
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Get creator name if available
      let createdByName = 'Admin';
      if (eventParty.createdBy) {
        try {
          const guild = await this.client.guilds.fetch(guildId);
          const member = await guild.members.fetch(eventParty.createdBy);
          createdByName = member.displayName || member.user.username;
        } catch (error) {
          // If we can't fetch the member, use default
          console.log('Could not fetch member for creator:', error.message);
        }
      }

      const partyData = {
        event: {
          eventType: event.eventType,
          eventTypeName: EVENT_TYPE_NAMES[event.eventType] || event.eventType,
          location: event.location,
          eventTime: event.eventTime
        },
        processedParties: eventParty.processedParties || [],
        availableMembers: eventParty.availableMembers || [],
        summary: eventParty.summary || {
          totalAttending: 0,
          partiesIntact: 0,
          partiesModified: 0,
          partiesDisbanded: 0,
          membersRemoved: 0,
          membersAvailable: 0
        },
        createdAt: eventParty.createdAt,
        createdByName,
        partiesFormedAt: eventParty.partiesFormedAt
      };

      res.json({ partyData });

    } catch (error) {
      console.error('Error getting party details:', error);
      res.status(500).json({ error: 'Failed to get party details' });
    }
  }

  // ==========================================
  // Guild Support Handlers (User)
  // ==========================================

  /**
   * Get guild support information content
   */
  async handleGetGuildSupportInfo(req, res) {
    try {
      const { guildId } = req.session;

      // Get guild support configuration
      const config = await this.collections.guildSupportConfig.findOne({ guildId });

      res.json({
        infoContent: config?.infoContent || '',
        requestSchema: config?.requestSchema || [],
        hasConfig: !!config
      });

    } catch (error) {
      console.error('Error getting guild support info:', error);
      res.status(500).json({ error: 'Failed to get guild support information' });
    }
  }

  /**
   * Submit a support request
   */
  async handleSubmitSupportRequest(req, res) {
    try {
      const { guildId, userId } = req.session;
      const { formData, files } = req.body;

      // Get configuration to validate against schema
      const config = await this.collections.guildSupportConfig.findOne({ guildId });
      if (!config || !config.requestSchema) {
        return res.status(400).json({ error: 'Support request form is not configured' });
      }

      // Check if user already has an active support request
      const existingActiveRequest = await this.collections.guildSupportRequests.findOne({
        guildId,
        userId,
        status: { $ne: 'fulfilled' } // Active = not fulfilled
      });

      if (existingActiveRequest) {
        return res.status(400).json({ error: 'You already have an active support request. Please wait for it to be processed before submitting another.' });
      }

      // Validate required fields
      const schema = config.requestSchema;
      for (const field of schema) {
        if (field.required && !formData[field.name]) {
          return res.status(400).json({ error: `Field "${field.label}" is required` });
        }
      }

      // Extract totalRequested from formData if exists and validate
      let totalRequested = null;
      if (formData.totalRequested) {
        const parsedAmount = parseFloat(formData.totalRequested);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          return res.status(400).json({ error: 'Total requested amount must be a valid positive number' });
        }
        totalRequested = parsedAmount;
      }

      // Create the request
      const request = {
        guildId,
        userId,
        discordId: userId, // userId is the Discord ID from OAuth
        formData,
        files: files || [],
        status: 'pending',
        totalRequested, // Total amount requested by user
        approvedAmount: null, // Amount approved by admin (may differ from totalRequested)
        amountFulfilled: 0, // Amount fulfilled so far (supports partial fulfillment)
        adminNotes: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.collections.guildSupportRequests.insertOne(request);

      res.json({
        success: true,
        requestId: result.insertedId,
        message: 'Support request submitted successfully'
      });

    } catch (error) {
      console.error('Error submitting support request:', error);
      res.status(500).json({ error: 'Failed to submit support request' });
    }
  }

  /**
   * Get current user's support requests
   */
  async handleGetMyRequests(req, res) {
    try {
      const { guildId, userId } = req.session;

      // Get user's requests
      const requests = await this.collections.guildSupportRequests.find({
        guildId,
        userId
      })
      .sort({ createdAt: -1 })
      .toArray();

      // For each approved request, get queue position if exists
      const requestsWithQueue = await Promise.all(requests.map(async (request) => {
        if (request.status === 'approved') {
          const queueEntry = await this.collections.guildSupportQueue.findOne({
            guildId,
            requestId: request._id
          });
          return {
            ...request,
            queuePosition: queueEntry?.position || null
          };
        }
        return request;
      }));

      res.json({
        requests: requestsWithQueue
      });

    } catch (error) {
      console.error('Error getting user requests:', error);
      res.status(500).json({ error: 'Failed to get support requests' });
    }
  }

  /**
   * Get public priority queue (approved requests only)
   */
  async handleGetSupportQueue(req, res) {
    try {
      const { guildId } = req.session;

      // Get queue entries sorted by position
      const queueEntries = await this.collections.guildSupportQueue.find({
        guildId,
        fulfilledAt: null
      })
      .sort({ position: 1 })
      .toArray();

      // Fetch request details for each queue entry
      const queue = await Promise.all(queueEntries.map(async (entry) => {
        const request = await this.collections.guildSupportRequests.findOne({
          _id: entry.requestId
        });

        if (!request) return null;

        // Get display name from guild member (per-server nickname via Discord client)
        let username = 'Unknown User';
        try {
          if (this.client && request.discordId) {
            const guild = this.client.guilds.cache.get(guildId);
            if (guild) {
              const member = await guild.members.fetch(request.discordId).catch(() => null);
              if (member) {
                username = member.displayName;
              }
            }
          }
        } catch (err) {
          console.error('Error fetching username:', err);
        }

        return {
          position: entry.position,
          username,
          approvedAmount: request.approvedAmount,
          totalRequested: request.totalRequested,
          amountFulfilled: request.amountFulfilled || 0,
          requestId: request._id,
          createdAt: request.createdAt
        };
      }));

      // Filter out null entries
      const validQueue = queue.filter(item => item !== null);

      res.json({
        queue: validQueue
      });

    } catch (error) {
      console.error('Error getting support queue:', error);
      res.status(500).json({ error: 'Failed to get support queue' });
    }
  }

  /**
   * Get fulfilled requests history
   */
  async handleGetFulfilledHistory(req, res) {
    try {
      const { guildId } = req.session;

      // Get fulfilled requests sorted by most recently updated (fulfilled)
      const fulfilledRequests = await this.collections.guildSupportRequests.find({
        guildId,
        status: 'fulfilled'
      })
      .sort({ updatedAt: -1 })
      .limit(50) // Limit to last 50 fulfilled requests
      .toArray();

      // Fetch display names for each request
      const history = await Promise.all(fulfilledRequests.map(async (request) => {
        // Get display name from guild member (per-server nickname via Discord client)
        let username = 'Unknown User';
        try {
          if (this.client && request.discordId) {
            const guild = this.client.guilds.cache.get(guildId);
            if (guild) {
              const member = await guild.members.fetch(request.discordId).catch(() => null);
              if (member) {
                username = member.displayName;
              }
            }
          }
        } catch (err) {
          console.error('Error fetching username:', err);
        }

        return {
          username,
          amountFulfilled: request.amountFulfilled || 0,
          totalRequested: request.totalRequested,
          approvedAmount: request.approvedAmount,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt
        };
      }));

      res.json({
        history
      });

    } catch (error) {
      console.error('Error getting fulfilled history:', error);
      res.status(500).json({ error: 'Failed to get fulfilled history' });
    }
  }

  // ==========================================
  // Guild Support Handlers (Admin)
  // ==========================================

  /**
   * Get guild support configuration (admin)
   */
  async handleAdminGetGuildSupportConfig(req, res) {
    try {
      const { guildId } = req.session;

      const config = await this.collections.guildSupportConfig.findOne({ guildId });

      res.json({
        config: config || {
          guildId,
          infoContent: '',
          requestSchema: []
        }
      });

    } catch (error) {
      console.error('Error getting guild support config:', error);
      res.status(500).json({ error: 'Failed to get configuration' });
    }
  }

  /**
   * Update guild support configuration (admin)
   */
  async handleAdminUpdateGuildSupportConfig(req, res) {
    try {
      const { guildId } = req.session;
      const { infoContent, requestSchema } = req.body;

      // Validate request schema
      if (requestSchema && !Array.isArray(requestSchema)) {
        return res.status(400).json({ error: 'Invalid request schema format' });
      }

      const updateData = {
        guildId,
        infoContent: infoContent || '',
        requestSchema: requestSchema || [],
        updatedAt: new Date()
      };

      await this.collections.guildSupportConfig.updateOne(
        { guildId },
        { $set: updateData },
        { upsert: true }
      );

      res.json({
        success: true,
        message: 'Configuration updated successfully'
      });

    } catch (error) {
      console.error('Error updating guild support config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }

  /**
   * Get all support requests (admin)
   */
  async handleAdminGetAllRequests(req, res) {
    try {
      const { guildId } = req.session;
      const { status } = req.query;

      // Build query
      const query = { guildId };
      if (status) {
        query.status = status;
      }

      // Get all requests
      const requests = await this.collections.guildSupportRequests.find(query)
        .sort({ createdAt: -1 })
        .toArray();

      // Fetch display names for each request
      const requestsWithUsernames = await Promise.all(requests.map(async (request) => {
        let username = 'Unknown User';
        try {
          if (this.client && request.discordId) {
            const guild = this.client.guilds.cache.get(guildId);
            if (guild) {
              const member = await guild.members.fetch(request.discordId).catch(() => null);
              if (member) {
                username = member.displayName;
              }
            }
          }
        } catch (err) {
          console.error('Error fetching username:', err);
        }

        return {
          ...request,
          username
        };
      }));

      res.json({
        requests: requestsWithUsernames
      });

    } catch (error) {
      console.error('Error getting all requests:', error);
      res.status(500).json({ error: 'Failed to get support requests' });
    }
  }

  /**
   * Get specific support request details (admin)
   */
  async handleAdminGetRequestDetails(req, res) {
    try {
      const { guildId } = req.session;
      const requestId = req.params.id;

      const request = await this.collections.guildSupportRequests.findOne({
        _id: new ObjectId(requestId),
        guildId
      });

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      // Get display name (per-server nickname)
      let username = 'Unknown User';
      try {
        if (this.client && request.discordId) {
          const guild = this.client.guilds.cache.get(guildId);
          if (guild) {
            const member = await guild.members.fetch(request.discordId).catch(() => null);
            if (member) {
              username = member.displayName;
            }
          }
        }
      } catch (err) {
        console.error('Error fetching username:', err);
      }

      res.json({
        request: {
          ...request,
          username
        }
      });

    } catch (error) {
      console.error('Error getting request details:', error);
      res.status(500).json({ error: 'Failed to get request details' });
    }
  }

  /**
   * Update support request (approve/deny/update)
   */
  async handleAdminUpdateRequest(req, res) {
    try {
      const { guildId } = req.session;
      const requestId = req.params.id;
      const { status, approvedAmount, adminNote } = req.body;

      // Validate status
      const validStatuses = ['pending', 'approved', 'denied', 'fulfilled'];
      if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const updateData = {
        updatedAt: new Date()
      };

      if (status) {
        updateData.status = status;
      }

      if (approvedAmount !== undefined) {
        updateData.approvedAmount = approvedAmount;
      }

      // Handle admin note
      if (adminNote) {
        await this.collections.guildSupportRequests.updateOne(
          { _id: new ObjectId(requestId), guildId },
          {
            $push: {
              adminNotes: {
                note: adminNote,
                addedBy: req.session.userId,
                addedAt: new Date()
              }
            }
          }
        );
      }

      // Update request
      await this.collections.guildSupportRequests.updateOne(
        { _id: new ObjectId(requestId), guildId },
        { $set: updateData }
      );

      // If approved, add to queue
      if (status === 'approved' && approvedAmount) {
        // Get current max position
        const maxPositionEntry = await this.collections.guildSupportQueue.findOne(
          { guildId },
          { sort: { position: -1 } }
        );
        const newPosition = (maxPositionEntry?.position || 0) + 1;

        await this.collections.guildSupportQueue.updateOne(
          { guildId, requestId: new ObjectId(requestId) },
          {
            $set: {
              guildId,
              requestId: new ObjectId(requestId),
              position: newPosition,
              approvedAmount,
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      }

      // If denied or fulfilled, remove from queue
      if (status === 'denied' || status === 'fulfilled') {
        await this.collections.guildSupportQueue.deleteOne({
          guildId,
          requestId: new ObjectId(requestId)
        });
      }

      res.json({
        success: true,
        message: 'Request updated successfully'
      });

    } catch (error) {
      console.error('Error updating request:', error);
      res.status(500).json({ error: 'Failed to update request' });
    }
  }

  /**
   * Reorder priority queue
   */
  async handleAdminReorderQueue(req, res) {
    try {
      const { guildId } = req.session;
      const { order } = req.body; // Array of request IDs in new order

      if (!Array.isArray(order)) {
        return res.status(400).json({ error: 'Invalid order format' });
      }

      // Update positions for all entries
      const updatePromises = order.map((requestId, index) => {
        return this.collections.guildSupportQueue.updateOne(
          { guildId, requestId: new ObjectId(requestId) },
          { $set: { position: index + 1 } }
        );
      });

      await Promise.all(updatePromises);

      res.json({
        success: true,
        message: 'Queue reordered successfully'
      });

    } catch (error) {
      console.error('Error reordering queue:', error);
      res.status(500).json({ error: 'Failed to reorder queue' });
    }
  }

  /**
   * Mark request as fulfilled
   */
  async handleAdminFulfillRequest(req, res) {
    try {
      const { guildId } = req.session;
      const requestId = req.params.id;

      // Get the request to check current fulfillment
      const request = await this.collections.guildSupportRequests.findOne({
        _id: new ObjectId(requestId),
        guildId
      });

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      // Update request status to fulfilled and set amountFulfilled to the maximum
      const finalAmount = Math.max(
        request.amountFulfilled || 0,
        request.approvedAmount || request.totalRequested || 0
      );

      await this.collections.guildSupportRequests.updateOne(
        { _id: new ObjectId(requestId), guildId },
        {
          $set: {
            status: 'fulfilled',
            amountFulfilled: finalAmount,
            updatedAt: new Date()
          }
        }
      );

      // Remove from queue (mark as fulfilled)
      await this.collections.guildSupportQueue.deleteOne({
        guildId,
        requestId: new ObjectId(requestId)
      });

      res.json({
        success: true,
        message: 'Request marked as fulfilled'
      });

    } catch (error) {
      console.error('Error fulfilling request:', error);
      res.status(500).json({ error: 'Failed to mark request as fulfilled' });
    }
  }

  /**
   * Add partial fulfillment to a request
   */
  async handleAdminPartialFulfillRequest(req, res) {
    try {
      const { guildId } = req.session;
      const requestId = req.params.id;
      const { amount, adminNote } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid fulfillment amount' });
      }

      // Get the current request
      const request = await this.collections.guildSupportRequests.findOne({
        _id: new ObjectId(requestId),
        guildId
      });

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      if (request.status !== 'approved') {
        return res.status(400).json({ error: 'Can only fulfill approved requests' });
      }

      // Calculate new fulfilled amount
      const currentFulfilled = request.amountFulfilled || 0;
      const newFulfilled = currentFulfilled + parseFloat(amount);
      const targetAmount = request.approvedAmount || request.totalRequested || 0;

      // Check if this fulfillment completes the request
      const isComplete = newFulfilled >= targetAmount;

      // Build update data
      const updateData = {
        amountFulfilled: newFulfilled,
        updatedAt: new Date()
      };

      if (isComplete) {
        updateData.status = 'fulfilled';
      }

      // Add admin note about the partial fulfillment
      const fulfillmentNote = adminNote || `Fulfilled ${amount} (Total: ${newFulfilled}/${targetAmount})`;
      await this.collections.guildSupportRequests.updateOne(
        { _id: new ObjectId(requestId), guildId },
        {
          $set: updateData,
          $push: {
            adminNotes: {
              note: fulfillmentNote,
              addedBy: req.session.userId,
              addedAt: new Date()
            }
          }
        }
      );

      // If complete, remove from queue
      if (isComplete) {
        await this.collections.guildSupportQueue.deleteOne({
          guildId,
          requestId: new ObjectId(requestId)
        });
      }

      res.json({
        success: true,
        amountFulfilled: newFulfilled,
        isComplete,
        message: isComplete 
          ? 'Request fully fulfilled and removed from queue'
          : `Partial fulfillment added: ${amount} (Total: ${newFulfilled}/${targetAmount})`
      });

    } catch (error) {
      console.error('Error adding partial fulfillment:', error);
      res.status(500).json({ error: 'Failed to add partial fulfillment' });
    }
  }

  /**
   * Start the web server
   */
  start() {
    this.server = this.app.listen(this.port, () => {
      const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${this.port}`;
      console.log(`🌐 Web server running on ${baseUrl}`);
    });
  }

  /**
   * Stop the web server
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('🛑 Web server stopped');
      });
    }
  }
}

// Export singleton instance
const webServer = new WebServer();
module.exports = { webServer };