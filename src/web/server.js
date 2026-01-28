const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');

class WebServer {
  constructor() {
    this.app = express();
    this.port = process.env.WEB_PORT || 3001; // Changed to 3001 to avoid conflict with StreamServer (port 3000)
    this.activeTokens = new Map(); // In-memory token storage
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
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

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
   * Register all routes
   */
  registerRoutes() {
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

      // Render the party editor page
      res.render('party-editor', {
        token: req.params.token,
        eventId,
        guildName: guild.name,
        eventType: event.eventType,
        eventLocation: event.location,
        eventTime: event.eventTime,
        formation: JSON.stringify(formation),
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
   * Create DM message for party member
   */
  createPartyAssignmentDM(member, party, eventInfo) {
    const eventTypeNames = {
      siege: 'Siege',
      riftstone: 'Riftstone Fight',
      boonstone: 'Boonstone Fight',
      wargames: 'Wargames',
      warboss: 'War Boss',
      guildevent: 'Guild Event'
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
    const location = eventInfo.location ? ` - ${eventInfo.location}` : '';
    const timestamp = Math.floor(eventInfo.eventTime.getTime() / 1000);

    const partyList = party.members.map(m => {
      const roleIcon = getRoleEmoji(m.role);
      const leaderCrown = m.isLeader ? '👑 ' : '';
      const isYou = m.userId === member.userId ? ' **(You)**' : '';
      return `${roleIcon} ${leaderCrown}${m.displayName}${isYou}`;
    }).join('\n');

    const message = 
      `🎯 **Your Event Party Assignment**\n\n` +
      `**Event:** ${eventName}${location}\n` +
      `**Time:** <t:${timestamp}:F> (<t:${timestamp}:R>)\n\n` +
      `You've been assigned to **Party ${party.partyNumber}**:\n\n` +
      `${partyList}\n\n` +
      `📋 **Role Composition:**\n` +
      `• 🛡️ Tanks: ${party.composition.tank}\n` +
      `• 💚 Healers: ${party.composition.healer}\n` +
      `• ⚔️ DPS: ${party.composition.dps}\n\n` +
      `Good luck! 🎯`;

    return message;
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