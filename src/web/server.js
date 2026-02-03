const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { ObjectId } = require('mongodb');
const { EmbedBuilder } = require('discord.js');

// Import roster and embed update functions
const { updateGuildRoster } = require('../features/parties/commands/guildroster');
const { updateEventEmbed } = require('../features/pvp/embed');
const { uploadToDiscordStorage } = require('../utils/discordStorage');
const { postGearCheckEmbed } = require('../features/parties/handlers/gearUploadHandler');
const { updateWishlistPanels } = require('../features/wishlist/commands/wishlists');

// Discord OAuth2 Configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/auth/discord/callback';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');

class WebServer {
  constructor() {
    this.app = express();
    this.port = process.env.WEB_PORT || 3001;
    this.activeTokens = new Map(); // In-memory token storage for party editors
    this.staticPartyTokens = new Map(); // Tokens for static party editor
    this.profileTokens = new Map(); // Legacy profile tokens (kept for party editors)
    this.adminPanelTokens = new Map(); // Tokens for admin panel
    this.collections = null;
    this.client = null;
    this.server = null;
    this.mongoClient = null;
  }

  /**
   * Initialize the web server with database collections and Discord client
   */
  initialize(collections, client, mongoClient = null) {
    this.collections = collections;
    this.client = client;
    this.mongoClient = mongoClient;

    // Trust proxy for secure cookies behind reverse proxy
    this.app.set('trust proxy', 1);

    // Middleware
    this.app.use(cors({
      origin: process.env.WEB_BASE_URL || 'http://localhost:3001',
      credentials: true
    }));
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

    // Session middleware with MongoDB store
    const isProduction = process.env.NODE_ENV === 'production';
    const sessionConfig = {
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: isProduction, // Only use secure cookies in production (HTTPS)
        httpOnly: true,
        sameSite: 'lax', // 'lax' works for same-site requests
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      }
    };

    // Use MongoDB store if mongoClient is available
    if (mongoClient) {
      sessionConfig.store = MongoStore.create({
        client: mongoClient,
        dbName: process.env.MONGODB_DB || 'guild-helper',
        collectionName: 'sessions',
        ttl: 7 * 24 * 60 * 60 // 7 days
      });
    }

    this.app.use(session(sessionConfig));

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
    // Landing Page & OAuth Routes
    // ==========================================

    // Landing/Login page
    this.app.get('/', (req, res) => {
      // If user is already logged in, redirect to guild selection
      if (req.session && req.session.user) {
        return res.redirect('/guilds');
      }
      res.render('login');
    });

    // Discord OAuth2 - Initiate login
    this.app.get('/auth/discord', (req, res) => {
      const state = crypto.randomBytes(16).toString('hex');
      req.session.oauthState = state;

      const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify guilds',
        state: state
      });

      res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
    });

    // Discord OAuth2 - Callback
    this.app.get('/auth/discord/callback', async (req, res) => {
      await this.handleOAuthCallback(req, res);
    });

    // Logout
    this.app.get('/auth/logout', (req, res) => {
      req.session.destroy((err) => {
        if (err) console.error('Session destruction error:', err);
        res.redirect('/');
      });
    });

    // Guild selection page (requires OAuth)
    this.app.get('/guilds', async (req, res) => {
      await this.handleGuildSelection(req, res);
    });

    // Dashboard - Profile view for specific guild (requires OAuth)
    this.app.get('/dashboard/:guildId', async (req, res) => {
      await this.handleDashboard(req, res);
    });

    // Dashboard API routes (OAuth-based)
    this.app.get('/api/dashboard/:guildId/data', async (req, res) => {
      await this.handleDashboardGetData(req, res);
    });

    this.app.post('/api/dashboard/:guildId/update-info', async (req, res) => {
      await this.handleDashboardUpdateInfo(req, res);
    });

    this.app.get('/api/dashboard/:guildId/events', async (req, res) => {
      await this.handleDashboardGetEvents(req, res);
    });

    this.app.post('/api/dashboard/:guildId/event-rsvp', async (req, res) => {
      await this.handleDashboardEventRsvp(req, res);
    });

    this.app.post('/api/dashboard/:guildId/event-attendance', async (req, res) => {
      await this.handleDashboardEventAttendance(req, res);
    });

    this.app.get('/api/dashboard/:guildId/wishlist', async (req, res) => {
      await this.handleDashboardGetWishlist(req, res);
    });

    this.app.post('/api/dashboard/:guildId/update-wishlist', async (req, res) => {
      await this.handleDashboardUpdateWishlist(req, res);
    });

    this.app.post('/api/dashboard/:guildId/upload-gear', async (req, res) => {
      await this.handleDashboardUploadGear(req, res);
    });

    this.app.get('/api/dashboard/:guildId/roster', async (req, res) => {
      await this.handleDashboardGetRoster(req, res);
    });

    this.app.get('/api/dashboard/:guildId/party-members', async (req, res) => {
      await this.handleDashboardGetPartyMembers(req, res);
    });

    this.app.get('/api/dashboard/:guildId/item-rolls', async (req, res) => {
      await this.handleDashboardGetItemRolls(req, res);
    });

    this.app.get('/api/dashboard/:guildId/admin-access', async (req, res) => {
      await this.handleDashboardCheckAdminAccess(req, res);
    });

    this.app.get('/api/dashboard/:guildId/admin-panel-link', async (req, res) => {
      await this.handleDashboardGetAdminPanelLink(req, res);
    });

    // ==========================================
    // Health Check & Token-Based Routes (Party Editors)
    // ==========================================

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Party editor page (token-based - for PvP events)
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
    this.app.get('/profile/:token', async (req, res) => {
      await this.handleProfilePage(req, res);
    });

    // API: Get profile data
    this.app.get('/api/profile/:token/data', async (req, res) => {
      await this.handleGetProfileData(req, res);
    });

    // API: Update player info
    this.app.post('/api/profile/:token/update-info', async (req, res) => {
      await this.handleUpdatePlayerInfo(req, res);
    });

    // API: Get events data
    this.app.get('/api/profile/:token/events', async (req, res) => {
      await this.handleGetProfileEvents(req, res);
    });

    // API: Update event RSVP
    this.app.post('/api/profile/:token/event-rsvp', async (req, res) => {
      await this.handleProfileEventRsvp(req, res);
    });

    // API: Record event attendance
    this.app.post('/api/profile/:token/event-attendance', async (req, res) => {
      await this.handleProfileEventAttendance(req, res);
    });

    // API: Get wishlist data
    this.app.get('/api/profile/:token/wishlist', async (req, res) => {
      await this.handleGetProfileWishlist(req, res);
    });

    // API: Update wishlist
    this.app.post('/api/profile/:token/update-wishlist', async (req, res) => {
      await this.handleUpdateProfileWishlist(req, res);
    });

    // API: Upload gear screenshot
    this.app.post('/api/profile/:token/upload-gear', async (req, res) => {
      await this.handleUploadGearScreenshot(req, res);
    });

    // API: Get roster data
    this.app.get('/api/profile/:token/roster', async (req, res) => {
      await this.handleGetRosterData(req, res);
    });

    // API: Get party members data
    this.app.get('/api/profile/:token/party-members', async (req, res) => {
      await this.handleGetPartyMembers(req, res);
    });

    // API: Get item rolls data
    this.app.get('/api/profile/:token/item-rolls', async (req, res) => {
      await this.handleGetItemRolls(req, res);
    });

    // API: Check if user has admin access (for profile dashboard)
    this.app.get('/api/profile/:token/admin-access', async (req, res) => {
      await this.handleProfileCheckAdminAccess(req, res);
    });

    // API: Get admin panel link (for profile dashboard)
    this.app.get('/api/profile/:token/admin-panel-link', async (req, res) => {
      await this.handleProfileGetAdminPanelLink(req, res);
    });

    // ==========================================
    // Admin Panel Routes
    // ==========================================

    // Admin panel page
    this.app.get('/admin-panel/:token', async (req, res) => {
      await this.handleAdminPanelPage(req, res);
    });

    // API: Check admin access
    this.app.get('/api/admin-panel/:token/check-access', async (req, res) => {
      await this.handleCheckAdminAccess(req, res);
    });

    // API: Get guild members
    this.app.get('/api/admin-panel/:token/members', async (req, res) => {
      await this.handleAdminGetMembers(req, res);
    });

    // API: Get events
    this.app.get('/api/admin-panel/:token/events', async (req, res) => {
      await this.handleAdminGetEvents(req, res);
    });

    // API: Get text channels for item rolls
    this.app.get('/api/admin-panel/:token/channels', async (req, res) => {
      await this.handleAdminGetChannels(req, res);
    });

    // API: Get static party editor token (redirects to existing editor)
    this.app.get('/api/admin-panel/:token/static-party-token', async (req, res) => {
      await this.handleAdminGetStaticPartyToken(req, res);
    });

    // API: Get event party editor token
    this.app.get('/api/admin-panel/:token/event-party-token/:eventId', async (req, res) => {
      await this.handleAdminGetEventPartyToken(req, res);
    });

    // API: Reset user party info
    this.app.post('/api/admin-panel/:token/reset-party', async (req, res) => {
      await this.handleAdminResetParty(req, res);
    });

    // API: Reset user wishlist
    this.app.post('/api/admin-panel/:token/reset-wishlist', async (req, res) => {
      await this.handleAdminResetWishlist(req, res);
    });

    // API: Get item categories
    this.app.get('/api/admin-panel/:token/item-categories', async (req, res) => {
      await this.handleAdminGetItemCategories(req, res);
    });

    // API: Get item subcategories
    this.app.get('/api/admin-panel/:token/item-subcategories/:category', async (req, res) => {
      await this.handleAdminGetItemSubcategories(req, res);
    });

    // API: Get items
    this.app.get('/api/admin-panel/:token/items/:category/:subcategory', async (req, res) => {
      await this.handleAdminGetItems(req, res);
    });

    // API: Create item roll
    this.app.post('/api/admin-panel/:token/create-item-roll', async (req, res) => {
      await this.handleAdminCreateItemRoll(req, res);
    });

    // API: Get wishlisted items for give item feature
    this.app.get('/api/admin-panel/:token/wishlisted-items', async (req, res) => {
      await this.handleAdminGetWishlistedItems(req, res);
    });

    // API: Give item to users
    this.app.post('/api/admin-panel/:token/give-item', async (req, res) => {
      await this.handleAdminGiveItem(req, res);
    });

    // API: Send party info reminders
    this.app.post('/api/admin-panel/:token/remind-parties', async (req, res) => {
      await this.handleAdminRemindParties(req, res);
    });

    // API: Send wishlist reminders
    this.app.post('/api/admin-panel/:token/remind-wishlist', async (req, res) => {
      await this.handleAdminRemindWishlist(req, res);
    });

    // API: Cancel event
    this.app.post('/api/admin-panel/:token/cancel-event', async (req, res) => {
      await this.handleAdminCancelEvent(req, res);
    });

    // API: View event code
    this.app.get('/api/admin-panel/:token/event-code/:eventId', async (req, res) => {
      await this.handleAdminViewEventCode(req, res);
    });

    // API: Get profile link from admin panel
    this.app.get('/api/admin-panel/:token/profile-link', async (req, res) => {
      await this.handleAdminGetProfileLink(req, res);
    });

    // API: Create event
    this.app.post('/api/admin-panel/:token/create-event', async (req, res) => {
      await this.handleAdminCreateEvent(req, res);
    });

    // API: Get description templates
    this.app.get('/api/admin-panel/:token/description-templates', async (req, res) => {
      await this.handleAdminGetDescriptionTemplates(req, res);
    });

    // API: Save description template
    this.app.post('/api/admin-panel/:token/description-templates', async (req, res) => {
      await this.handleAdminSaveDescriptionTemplate(req, res);
    });

    // API: Delete description template
    this.app.delete('/api/admin-panel/:token/description-templates/:templateId', async (req, res) => {
      await this.handleAdminDeleteDescriptionTemplate(req, res);
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

      // Render the party editor page
      res.render('party-editor', {
        token: req.params.token,
        eventId,
        guildName: guild.name,
        eventType: event.eventType,
        eventLocation: event.location,
        eventTime: event.eventTime,
        formation: JSON.stringify(enrichedFormation),
        summary: JSON.stringify(formation.summary)
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
    const embed = new EmbedBuilder()
      .setColor(eventColor)
      .setTitle(`🎮 Party ${party.partyNumber} Assignment`)
      .setDescription(`You've been assigned to **Party ${party.partyNumber}** for the upcoming event.`)
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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).render('error', {
          message: validation.error === 'Token expired'
            ? 'This link has expired (links are valid for 1 hour)'
            : 'Invalid or expired link'
        });
      }

      const { guildId, userId } = validation.data;

      // Fetch guild
      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId).catch(() => null);

      // Render the profile page
      res.render('profile-dashboard', {
        token: req.params.token,
        guildId,
        userId,
        guildName: guild.name,
        userName: member?.displayName || 'Unknown User',
        userAvatar: member?.user?.displayAvatarURL({ size: 128, format: 'png' }) || null
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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

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

        // Check if attendance can be recorded (5 min before to 1 hour after event)
        const eventTime = event.eventTime.getTime();
        const fiveMinsBefore = eventTime - (5 * 60 * 1000);
        const oneHourAfter = eventTime + (60 * 60 * 1000);
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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
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

      // Check if user has signed up
      const hasSignedUp = event.rsvpAttending?.includes(userId) ||
                         event.rsvpMaybe?.includes(userId) ||
                         event.rsvpNotAttending?.includes(userId);

      if (!hasSignedUp) {
        return res.status(400).json({ error: 'You must sign up for the event first' });
      }

      // Check if already recorded
      if (event.attendees?.includes(userId)) {
        return res.status(400).json({ error: 'You have already recorded attendance' });
      }

      // Verify code
      if (event.password !== code) {
        return res.status(400).json({ error: 'Incorrect attendance code' });
      }

      // Record attendance
      await this.collections.pvpEvents.updateOne(
        { _id: new ObjectId(eventId) },
        { $push: { attendees: userId } }
      );

      // Award bonus points
      await this.collections.pvpBonuses.updateOne(
        { userId, guildId },
        {
          $inc: {
            bonusCount: event.bonusPoints || 0,
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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
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

      // Validate limits
      const limits = {
        archbossWeapon: 1,
        archbossArmor: 1,
        t3Weapons: 1,
        t3Armors: 4,
        t3Accessories: 2
      };

      if (archbossWeapon?.length > limits.archbossWeapon ||
          archbossArmor?.length > limits.archbossArmor ||
          t3Weapons?.length > limits.t3Weapons ||
          t3Armors?.length > limits.t3Armors ||
          t3Accessories?.length > limits.t3Accessories) {
        return res.status(400).json({ error: 'Wishlist exceeds item limits' });
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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;

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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

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
      const validation = this.validateProfileToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

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

      // Generate admin panel token
      const adminToken = this.generateAdminPanelToken(guildId, userId);
      const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${this.port}`;

      res.json({
        url: `${baseUrl}/admin-panel/${adminToken}`,
        token: adminToken
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).render('error', {
          message: validation.error === 'Token expired'
            ? 'This link has expired (links are valid for 1 hour)'
            : 'Invalid or expired link'
        });
      }

      const { guildId, userId } = validation.data;

      // Fetch guild
      const guild = await this.client.guilds.fetch(guildId);

      // Render the admin panel page
      res.render('admin-panel', {
        token: req.params.token,
        guildId,
        userId,
        guildName: guild.name
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;

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

      const eventTypeNames = {
        siege: 'Siege',
        riftstone: 'Riftstone Fight',
        boonstone: 'Boonstone Fight',
        wargames: 'Wargames',
        warboss: 'War Boss',
        guildevent: 'Guild Event'
      };

      const formattedEvents = events.map(event => ({
        _id: event._id.toString(),
        eventType: event.eventType,
        eventTypeName: eventTypeNames[event.eventType] || event.eventType,
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Check if user has a wishlist
      const existingWishlist = await this.collections.wishlistSubmissions.findOne({
        userId,
        guildId
      });

      if (!existingWishlist) {
        return res.status(404).json({ error: 'User does not have a wishlist to reset' });
      }

      // Check if user has received items
      const receivedItems = await this.collections.wishlistGivenItems.find({
        userId,
        guildId
      }).toArray();

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId: adminUserId } = validation.data;
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
   * Send party info reminders
   */
  async handleAdminRemindParties(req, res) {
    try {
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId: adminUserId } = validation.data;

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;
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
        const channel = await this.client.channels.fetch(event.channelId).catch(() => null);
        if (channel && event.messageId) {
          await updateEventEmbed(event._id.toString(), this.client, this.collections);
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;

      // Generate a new profile token
      const profileToken = this.generateProfileToken(guildId, userId);
      const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${this.port}`;

      res.json({
        url: `${baseUrl}/profile/${profileToken}`
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;

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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId, userId } = validation.data;
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
      const validation = this.validateAdminPanelToken(req.params.token);

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      const { guildId } = validation.data;
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

  // ==========================================
  // OAuth2 & Dashboard Handler Methods
  // ==========================================

  /**
   * Handle Discord OAuth2 callback
   */
  async handleOAuthCallback(req, res) {
    try {
      const { code, state } = req.query;

      // Verify state to prevent CSRF
      if (!state || state !== req.session.oauthState) {
        return res.status(403).render('error', {
          message: 'Invalid OAuth state. Please try logging in again.'
        });
      }

      // Exchange code for access token
      const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const user = userResponse.data;

      // Get user's guilds
      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      const userGuilds = guildsResponse.data;

      // Store user info in session
      req.session.user = {
        id: user.id,
        username: user.username,
        global_name: user.global_name,
        discriminator: user.discriminator,
        avatar: user.avatar,
        access_token,
        refresh_token,
        token_expires_at: Date.now() + (expires_in * 1000)
      };

      req.session.userGuilds = userGuilds;

      // Clear OAuth state
      delete req.session.oauthState;

      // Redirect to guild selection
      res.redirect('/guilds');

    } catch (error) {
      console.error('OAuth callback error:', error.response?.data || error.message);
      res.status(500).render('error', {
        message: 'Failed to authenticate with Discord. Please try again.'
      });
    }
  }

  /**
   * Handle guild selection page
   */
  async handleGuildSelection(req, res) {
    try {
      // Check if user is authenticated
      if (!req.session || !req.session.user) {
        return res.redirect('/');
      }

      const user = req.session.user;
      const userGuilds = req.session.userGuilds || [];

      // Get guilds that the bot is in
      const botGuildIds = new Set(this.client.guilds.cache.map(g => g.id));

      // Filter to only guilds where both the user and bot are members
      const availableGuilds = [];

      for (const guild of userGuilds) {
        if (botGuildIds.has(guild.id)) {
          try {
            const botGuild = await this.client.guilds.fetch(guild.id);
            // Check if user is actually in this guild (via bot's member cache)
            const member = await botGuild.members.fetch(user.id).catch(() => null);
            if (member) {
              availableGuilds.push({
                id: guild.id,
                name: guild.name,
                icon: guild.icon,
                memberCount: botGuild.memberCount
              });
            }
          } catch (e) {
            // Skip if we can't fetch the guild
          }
        }
      }

      res.render('guild-select', {
        user,
        guilds: availableGuilds
      });

    } catch (error) {
      console.error('Error loading guild selection:', error);
      res.status(500).render('error', {
        message: 'Failed to load guild selection. Please try again.'
      });
    }
  }

  /**
   * Handle dashboard page (OAuth-based profile)
   */
  async handleDashboard(req, res) {
    try {
      // Check if user is authenticated
      if (!req.session || !req.session.user) {
        return res.redirect('/');
      }

      const { guildId } = req.params;
      const user = req.session.user;

      // Verify user is in this guild
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return res.status(404).render('error', {
          message: 'Guild not found or bot is not a member.'
        });
      }

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        return res.status(403).render('error', {
          message: 'You are not a member of this guild.'
        });
      }

      // Render the dashboard (profile page)
      res.render('profile-dashboard', {
        token: null, // No token needed for OAuth
        guildId,
        userId: user.id,
        guildName: guild.name,
        userName: member.displayName || user.global_name || user.username,
        userAvatar: member.user.displayAvatarURL({ size: 128, format: 'png' }),
        isOAuth: true
      });

    } catch (error) {
      console.error('Error loading dashboard:', error);
      res.status(500).render('error', {
        message: 'Failed to load dashboard. Please try again.'
      });
    }
  }

  /**
   * Middleware to verify OAuth session for dashboard API routes
   */
  verifyOAuthSession(req) {
    console.log('[OAuth Debug] Checking session for:', req.path);
    console.log('[OAuth Debug] Session ID:', req.sessionID);
    console.log('[OAuth Debug] Session user:', req.session?.user ? `${req.session.user.id}` : 'missing');

    if (!req.session || !req.session.user) {
      console.log('[OAuth Debug] FAILED - no session or user');
      return { valid: false, error: 'Not authenticated' };
    }
    return { valid: true, user: req.session.user };
  }

  /**
   * Handle dashboard get data (OAuth-based)
   */
  async handleDashboardGetData(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;

      // Verify user is in guild
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return res.status(403).json({ error: 'Not a member of this guild' });
      }

      // Get player info
      const playerInfo = await this.collections.partyPlayers.findOne({ userId, guildId });

      // Get party assignment
      const party = await this.collections.parties.findOne({
        guildId,
        'members.userId': userId,
        isReserve: { $ne: true }
      });

      // Get PvP bonuses
      const bonuses = await this.collections.pvpBonuses.findOne({ userId, guildId });

      // Get activity ranking
      const activity = await this.collections.pvpActivityRanking.findOne({ userId, guildId });

      // Get guild settings for weekly total
      const guildSettings = await this.collections.guildSettings.findOne({ guildId });

      res.json({
        playerInfo: playerInfo || {},
        partyNumber: party?.partyNumber || null,
        bonuses: bonuses || { bonusCount: 0, eventsAttended: 0 },
        totalEvents: activity?.totalEvents || 0,
        weeklyTotalEvents: guildSettings?.weeklyTotalEvents || 0,
        userName: member.displayName || 'Unknown',
        userAvatar: member.user.displayAvatarURL({ size: 128, format: 'png' })
      });

    } catch (error) {
      console.error('Error getting dashboard data:', error);
      res.status(500).json({ error: 'Failed to get data' });
    }
  }

  /**
   * Handle dashboard update info (OAuth-based)
   */
  async handleDashboardUpdateInfo(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;
      const { weapon1, weapon2, cp, buildLink } = req.body;

      // Verify user is in guild
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      const member = await guild?.members.fetch(userId).catch(() => null);
      if (!member) {
        return res.status(403).json({ error: 'Not a member of this guild' });
      }

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

      const updateData = { updatedAt: new Date() };
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

      // Trigger roster update
      try {
        const rosterRecord = await this.collections.guildRosters.findOne({ guildId });
        if (rosterRecord && rosterRecord.channelId) {
          await updateGuildRoster(guild, rosterRecord.channelId, this.collections);
        }
      } catch (err) {
        console.error('Failed to update roster:', err);
      }

      // Post gear check embed if build link was updated
      if (buildLink !== undefined) {
        try {
          const playerInfo = await this.collections.partyPlayers.findOne({ userId, guildId });
          if (playerInfo && playerInfo.gearScreenshotUrl) {
            await postGearCheckEmbed(guild, member, playerInfo, this.collections);
          }
        } catch (err) {
          console.error('Failed to post gear check embed:', err);
        }
      }

      res.json({ success: true, message: 'Profile updated successfully' });

    } catch (error) {
      console.error('Error updating dashboard info:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  /**
   * Handle dashboard get events (OAuth-based)
   */
  async handleDashboardGetEvents(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;

      // Get upcoming PvP events
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
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
        const signupDeadline = new Date(event.eventTime.getTime() - 20 * 60 * 1000);
        const signupsClosed = Date.now() > signupDeadline.getTime();

        const eventTime = event.eventTime.getTime();
        const fiveMinsBefore = eventTime - (5 * 60 * 1000);
        const oneHourAfter = eventTime + (60 * 60 * 1000);
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
          canRecordAttendance
        };
      });

      res.json({ events: enrichedEvents, staticEvents });

    } catch (error) {
      console.error('Error getting dashboard events:', error);
      res.status(500).json({ error: 'Failed to get events' });
    }
  }

  /**
   * Handle dashboard event RSVP (OAuth-based)
   */
  async handleDashboardEventRsvp(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;
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

      // Check signup deadline
      const signupDeadline = new Date(event.eventTime.getTime() - 20 * 60 * 1000);
      if (Date.now() > signupDeadline.getTime()) {
        return res.status(400).json({ error: 'Signups are closed for this event' });
      }

      // Remove from all RSVP lists
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
        'attending': 'rsvpAttending',
        'not_attending': 'rsvpNotAttending',
        'maybe': 'rsvpMaybe'
      };

      await this.collections.pvpEvents.updateOne(
        { _id: new ObjectId(eventId) },
        { $addToSet: { [fieldMap[status]]: userId } }
      );

      // Update event embed
      try {
        const updatedEvent = await this.collections.pvpEvents.findOne({ _id: new ObjectId(eventId) });
        await updateEventEmbed({ client: this.client }, updatedEvent, this.collections);
      } catch (err) {
        console.error('Failed to update event embed:', err);
      }

      res.json({ success: true, message: 'RSVP updated' });

    } catch (error) {
      console.error('Error updating dashboard RSVP:', error);
      res.status(500).json({ error: 'Failed to update RSVP' });
    }
  }

  /**
   * Handle dashboard event attendance (OAuth-based)
   */
  async handleDashboardEventAttendance(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;
      const { eventId, code } = req.body;

      if (!eventId || !code) {
        return res.status(400).json({ error: 'Event ID and code are required' });
      }

      const event = await this.collections.pvpEvents.findOne({
        _id: new ObjectId(eventId),
        guildId
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Verify code
      if (event.password !== code) {
        return res.status(400).json({ error: 'Invalid attendance code' });
      }

      // Check if already recorded
      if (event.attendees?.includes(userId)) {
        return res.status(400).json({ error: 'Attendance already recorded' });
      }

      // Record attendance
      await this.collections.pvpEvents.updateOne(
        { _id: new ObjectId(eventId) },
        { $addToSet: { attendees: userId } }
      );

      // Update bonuses
      await this.collections.pvpBonuses.updateOne(
        { userId, guildId },
        {
          $inc: {
            bonusCount: event.bonusPoints || 1,
            eventsAttended: 1
          }
        },
        { upsert: true }
      );

      // Update activity ranking
      await this.collections.pvpActivityRanking.updateOne(
        { userId, guildId },
        { $inc: { totalEvents: 1 } },
        { upsert: true }
      );

      res.json({ success: true, message: 'Attendance recorded' });

    } catch (error) {
      console.error('Error recording dashboard attendance:', error);
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  }

  /**
   * Handle dashboard get wishlist (OAuth-based)
   */
  async handleDashboardGetWishlist(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;

      const submission = await this.collections.wishlistSubmissions.findOne({ userId, guildId });
      const guildSettings = await this.collections.guildSettings.findOne({ guildId });
      const wishlistConfig = guildSettings?.wishlistConfig || { maxArmor: 5, maxAccessory: 3, maxWeapon: 2 };

      res.json({
        submission: submission || { armor: [], accessory: [], weapon: [] },
        config: wishlistConfig
      });

    } catch (error) {
      console.error('Error getting dashboard wishlist:', error);
      res.status(500).json({ error: 'Failed to get wishlist' });
    }
  }

  /**
   * Handle dashboard update wishlist (OAuth-based)
   */
  async handleDashboardUpdateWishlist(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;
      const { armor, accessory, weapon } = req.body;

      const guildSettings = await this.collections.guildSettings.findOne({ guildId });
      const config = guildSettings?.wishlistConfig || { maxArmor: 5, maxAccessory: 3, maxWeapon: 2 };

      // Validate counts
      if (armor && armor.length > config.maxArmor) {
        return res.status(400).json({ error: `Maximum ${config.maxArmor} armor items allowed` });
      }
      if (accessory && accessory.length > config.maxAccessory) {
        return res.status(400).json({ error: `Maximum ${config.maxAccessory} accessory items allowed` });
      }
      if (weapon && weapon.length > config.maxWeapon) {
        return res.status(400).json({ error: `Maximum ${config.maxWeapon} weapon items allowed` });
      }

      const updateData = { updatedAt: new Date() };
      if (armor !== undefined) updateData.armor = armor;
      if (accessory !== undefined) updateData.accessory = accessory;
      if (weapon !== undefined) updateData.weapon = weapon;

      await this.collections.wishlistSubmissions.updateOne(
        { userId, guildId },
        { $set: updateData },
        { upsert: true }
      );

      // Update wishlist panels
      try {
        const guild = await this.client.guilds.fetch(guildId);
        await updateWishlistPanels(guild, this.collections);
      } catch (err) {
        console.error('Failed to update wishlist panels:', err);
      }

      res.json({ success: true, message: 'Wishlist updated' });

    } catch (error) {
      console.error('Error updating dashboard wishlist:', error);
      res.status(500).json({ error: 'Failed to update wishlist' });
    }
  }

  /**
   * Handle dashboard upload gear (OAuth-based)
   */
  async handleDashboardUploadGear(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;
      const { imageData } = req.body;

      if (!imageData) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId);

      // Upload to Discord storage
      const imageUrl = await uploadToDiscordStorage(this.client, imageData, `gear_${userId}.png`);

      // Update player info
      await this.collections.partyPlayers.updateOne(
        { userId, guildId },
        {
          $set: {
            gearScreenshotUrl: imageUrl,
            gearScreenshotUpdatedAt: new Date()
          }
        },
        { upsert: true }
      );

      // Post gear check embed
      try {
        const playerInfo = await this.collections.partyPlayers.findOne({ userId, guildId });
        await postGearCheckEmbed(guild, member, playerInfo, this.collections);
      } catch (err) {
        console.error('Failed to post gear check embed:', err);
      }

      res.json({ success: true, imageUrl, message: 'Gear screenshot uploaded' });

    } catch (error) {
      console.error('Error uploading dashboard gear:', error);
      res.status(500).json({ error: 'Failed to upload gear screenshot' });
    }
  }

  /**
   * Handle dashboard get roster (OAuth-based)
   */
  async handleDashboardGetRoster(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;

      // Get all party players
      const players = await this.collections.partyPlayers.find({ guildId }).toArray();

      // Get activity rankings
      const activities = await this.collections.pvpActivityRanking.find({ guildId }).toArray();
      const activityMap = new Map(activities.map(a => [a.userId, a]));

      // Get guild settings for weekly total
      const guildSettings = await this.collections.guildSettings.findOne({ guildId });
      const weeklyTotal = guildSettings?.weeklyTotalEvents || 0;

      // Get party assignments
      const parties = await this.collections.parties.find({ guildId, isReserve: { $ne: true } }).toArray();
      const partyMap = new Map();
      for (const party of parties) {
        for (const member of party.members || []) {
          partyMap.set(member.userId, party.partyNumber);
        }
      }

      // Enrich players
      const guild = await this.client.guilds.fetch(guildId);
      const enrichedPlayers = await Promise.all(players.map(async (player) => {
        const member = await guild.members.fetch(player.userId).catch(() => null);
        const activity = activityMap.get(player.userId);
        const totalEvents = activity?.totalEvents || 0;
        const attendance = weeklyTotal > 0 ? Math.round((totalEvents / weeklyTotal) * 100) : 0;

        return {
          userId: player.userId,
          displayName: member?.displayName || 'Unknown',
          avatarUrl: member?.user?.displayAvatarURL({ size: 64, format: 'png' }) || null,
          role: player.role || 'dps',
          weapon1: player.weapon1,
          weapon2: player.weapon2,
          cp: player.cp || 0,
          partyNumber: partyMap.get(player.userId) || null,
          totalEvents,
          attendance
        };
      }));

      res.json({ roster: enrichedPlayers, weeklyTotal });

    } catch (error) {
      console.error('Error getting dashboard roster:', error);
      res.status(500).json({ error: 'Failed to get roster' });
    }
  }

  /**
   * Handle dashboard get party members (OAuth-based)
   */
  async handleDashboardGetPartyMembers(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;
      const { partyNumber } = req.query;

      if (!partyNumber) {
        return res.status(400).json({ error: 'Party number is required' });
      }

      const party = await this.collections.parties.findOne({
        guildId,
        partyNumber: parseInt(partyNumber),
        isReserve: { $ne: true }
      });

      if (!party) {
        return res.status(404).json({ error: 'Party not found' });
      }

      const guild = await this.client.guilds.fetch(guildId);

      const enrichedMembers = await Promise.all((party.members || []).map(async (member) => {
        const discordMember = await guild.members.fetch(member.userId).catch(() => null);
        return {
          userId: member.userId,
          displayName: discordMember?.displayName || member.displayName || 'Unknown',
          avatarUrl: discordMember?.user?.displayAvatarURL({ size: 64, format: 'png' }) || null,
          role: member.role,
          weapon1: member.weapon1,
          weapon2: member.weapon2,
          cp: member.cp || 0,
          isCurrentUser: member.userId === userId
        };
      }));

      res.json({ members: enrichedMembers, partyNumber: party.partyNumber });

    } catch (error) {
      console.error('Error getting dashboard party members:', error);
      res.status(500).json({ error: 'Failed to get party members' });
    }
  }

  /**
   * Handle dashboard get item rolls (OAuth-based)
   */
  async handleDashboardGetItemRolls(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;

      // Get active item rolls
      const activeRolls = await this.collections.itemRolls.find({
        guildId,
        status: 'active'
      }).sort({ createdAt: -1 }).toArray();

      // Get user's roll history
      const userRolls = await this.collections.itemRolls.find({
        guildId,
        'participants.userId': userId
      }).sort({ createdAt: -1 }).limit(20).toArray();

      const guild = await this.client.guilds.fetch(guildId);

      // Enrich rolls with participant info
      const enrichRoll = async (roll) => {
        const enrichedParticipants = await Promise.all((roll.participants || []).map(async (p) => {
          const member = await guild.members.fetch(p.userId).catch(() => null);
          return {
            userId: p.userId,
            displayName: member?.displayName || 'Unknown',
            avatarUrl: member?.user?.displayAvatarURL({ size: 32, format: 'png' }) || null,
            roll: p.roll,
            passed: p.passed
          };
        }));

        return {
          _id: roll._id.toString(),
          itemName: roll.itemName,
          itemImage: roll.itemImage,
          trait: roll.trait,
          status: roll.status,
          winner: roll.winner,
          createdAt: roll.createdAt,
          participants: enrichedParticipants,
          userParticipation: roll.participants?.find(p => p.userId === userId)
        };
      };

      const enrichedActiveRolls = await Promise.all(activeRolls.map(enrichRoll));
      const enrichedUserRolls = await Promise.all(userRolls.map(enrichRoll));

      res.json({ activeRolls: enrichedActiveRolls, userRolls: enrichedUserRolls });

    } catch (error) {
      console.error('Error getting dashboard item rolls:', error);
      res.status(500).json({ error: 'Failed to get item rolls' });
    }
  }

  /**
   * Handle dashboard check admin access (OAuth-based)
   */
  async handleDashboardCheckAdminAccess(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;

      const guild = await this.client.guilds.fetch(guildId);
      const member = await guild.members.fetch(userId).catch(() => null);

      if (!member) {
        return res.json({ hasAccess: false });
      }

      const isAdmin = member.permissions.has('Administrator');

      const settings = await this.collections.guildSettings.findOne({ guildId });
      const adminRoles = settings?.adminPanelRoles || [];
      const codeManagerRoles = settings?.pvpCodeManagers || [];
      const hasAdminRole = adminRoles.some(roleId => member.roles.cache.has(roleId));
      const hasCodeManagerRole = codeManagerRoles.some(roleId => member.roles.cache.has(roleId));

      res.json({ hasAccess: isAdmin || hasAdminRole || hasCodeManagerRole });

    } catch (error) {
      console.error('Error checking dashboard admin access:', error);
      res.status(500).json({ error: 'Failed to check admin access' });
    }
  }

  /**
   * Handle dashboard get admin panel link (OAuth-based)
   */
  async handleDashboardGetAdminPanelLink(req, res) {
    try {
      const authCheck = this.verifyOAuthSession(req);
      if (!authCheck.valid) {
        return res.status(401).json({ error: authCheck.error });
      }

      const { guildId } = req.params;
      const userId = authCheck.user.id;

      // Generate admin panel token
      const token = this.generateAdminPanelToken(guildId, userId, 3600000);
      const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${this.port}`;
      const adminPanelUrl = `${baseUrl}/admin-panel/${token}`;

      res.json({ url: adminPanelUrl });

    } catch (error) {
      console.error('Error getting dashboard admin panel link:', error);
      res.status(500).json({ error: 'Failed to get admin panel link' });
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