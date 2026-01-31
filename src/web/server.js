const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { EmbedBuilder } = require('discord.js');

class WebServer {
  constructor() {
    this.app = express();
    this.port = process.env.WEB_PORT || 3001; // Changed to 3001 to avoid conflict with StreamServer (port 3000)
    this.activeTokens = new Map(); // In-memory token storage
    this.staticPartyTokens = new Map(); // Tokens for static party editor
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