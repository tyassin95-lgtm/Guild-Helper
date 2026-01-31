const { ObjectId } = require('mongodb');
const { updateEventEmbed } = require('./embed');

/**
 * Manages batched embed updates to prevent rate limiting and improve performance
 * when many users submit attendance simultaneously
 */
class EmbedUpdateQueue {
  constructor(client, collections) {
    this.client = client;
    this.collections = collections;
    this.pendingUpdates = new Map(); // eventId -> timeout
    this.processing = new Set(); // eventIds currently being processed
    this.lastUpdate = new Map(); // eventId -> timestamp of last update
  }

  /**
   * Schedule an embed update with debouncing
   * Multiple rapid calls for the same event will be batched together
   * 
   * @param {string} eventId - Event ID to update
   * @param {Interaction} interaction - Discord interaction for context
   * @param {number} delayMs - Debounce delay in milliseconds (default: 2000)
   */
  scheduleUpdate(eventId, interaction, delayMs = 2000) {
    // Clear any existing scheduled update for this event
    if (this.pendingUpdates.has(eventId)) {
      clearTimeout(this.pendingUpdates.get(eventId));
    }

    // Schedule the update after the delay
    const timeout = setTimeout(async () => {
      await this.processUpdate(eventId, interaction);
    }, delayMs);

    this.pendingUpdates.set(eventId, timeout);

    console.log(`Scheduled embed update for event ${eventId} in ${delayMs}ms`);
  }

  /**
   * Process the actual embed update
   * 
   * @param {string} eventId - Event ID to update
   * @param {Interaction} interaction - Discord interaction for context
   */
  async processUpdate(eventId, interaction) {
    // Remove from pending
    this.pendingUpdates.delete(eventId);

    // Check if we're already processing this event
    if (this.processing.has(eventId)) {
      console.log(`Event ${eventId} is already being processed, skipping duplicate update`);
      return;
    }

    // Mark as processing
    this.processing.add(eventId);

    try {
      const event = await this.collections.pvpEvents.findOne({ 
        _id: new ObjectId(eventId) 
      });

      if (!event) {
        console.warn(`Event ${eventId} not found for embed update`);
        return;
      }

      // Perform the actual update
      console.log(`Updating embed for event ${eventId} (${event.attendees?.length || 0} attendees)`);
      await updateEventEmbed(interaction, event, this.collections);

      // Record the update time
      this.lastUpdate.set(eventId, Date.now());

      console.log(`✅ Successfully updated embed for event ${eventId}`);
    } catch (err) {
      console.error(`Failed to update embed for event ${eventId}:`, err);
    } finally {
      // Remove from processing
      this.processing.delete(eventId);
    }
  }

  /**
   * Force immediate update (bypasses debouncing)
   * Use for critical updates that can't wait
   * 
   * @param {string} eventId - Event ID to update
   * @param {Interaction} interaction - Discord interaction for context
   */
  async forceUpdate(eventId, interaction) {
    // Cancel any pending update
    if (this.pendingUpdates.has(eventId)) {
      clearTimeout(this.pendingUpdates.get(eventId));
      this.pendingUpdates.delete(eventId);
    }

    // Process immediately
    await this.processUpdate(eventId, interaction);
  }

  /**
   * Clear all pending updates (useful for shutdown)
   */
  clearAll() {
    for (const timeout of this.pendingUpdates.values()) {
      clearTimeout(timeout);
    }
    this.pendingUpdates.clear();
    this.processing.clear();
    console.log('Cleared all pending embed updates');
  }
}

// Singleton instance
let queueInstance = null;

/**
 * Get or create the embed update queue singleton
 * 
 * @param {Client} client - Discord client
 * @param {Object} collections - MongoDB collections
 * @returns {EmbedUpdateQueue}
 */
function getEmbedUpdateQueue(client, collections) {
  if (!queueInstance) {
    queueInstance = new EmbedUpdateQueue(client, collections);
    console.log('✅ Embed update queue initialized');
  }
  return queueInstance;
}

/**
 * Stop the embed update queue (for graceful shutdown)
 */
function stopEmbedUpdateQueue() {
  if (queueInstance) {
    queueInstance.clearAll();
    queueInstance = null;
    console.log('🛑 Embed update queue stopped');
  }
}

module.exports = { 
  getEmbedUpdateQueue, 
  stopEmbedUpdateQueue,
  EmbedUpdateQueue 
};