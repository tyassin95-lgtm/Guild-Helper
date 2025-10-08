/**
 * Safe execution wrappers for Discord bot operations
 * Place this file at: src/utils/safeExecute.js
 */

const { handleInteractionError, OperationalError } = require('./errorHandler');

/**
 * Safely execute an interaction handler with automatic error handling
 * This is the main wrapper that catches all errors in interaction handlers
 * 
 * @param {Interaction} interaction - Discord interaction object
 * @param {Function} handler - Async function to execute
 */
async function safeExecute(interaction, handler) {
  try {
    await handler();
  } catch (error) {
    await handleInteractionError(interaction, error);
  }
}

/**
 * Safely fetch a Discord guild member with fallback
 * Returns null if member cannot be fetched (instead of throwing)
 * 
 * @param {Guild} guild - Discord guild object
 * @param {string} userId - User ID to fetch
 * @returns {Promise<GuildMember|null>}
 */
async function safeFetchMember(guild, userId) {
  if (!guild || !userId) {
    console.warn('safeFetchMember: Invalid guild or userId');
    return null;
  }

  try {
    return await guild.members.fetch(userId);
  } catch (error) {
    // Log warning but don't throw - this is expected for users who left
    console.warn(`Failed to fetch member ${userId} in guild ${guild.id}:`, error.message);
    return null;
  }
}

/**
 * Safely fetch a Discord channel with fallback
 * Returns null if channel cannot be fetched
 * 
 * @param {Client} client - Discord client object
 * @param {string} channelId - Channel ID to fetch
 * @returns {Promise<Channel|null>}
 */
async function safeFetchChannel(client, channelId) {
  if (!client || !channelId) {
    console.warn('safeFetchChannel: Invalid client or channelId');
    return null;
  }

  try {
    return await client.channels.fetch(channelId);
  } catch (error) {
    console.warn(`Failed to fetch channel ${channelId}:`, error.message);
    return null;
  }
}

/**
 * Safely fetch a Discord message with fallback
 * Returns null if message cannot be fetched
 * 
 * @param {TextChannel} channel - Discord channel object
 * @param {string} messageId - Message ID to fetch
 * @returns {Promise<Message|null>}
 */
async function safeFetchMessage(channel, messageId) {
  if (!channel || !messageId) {
    console.warn('safeFetchMessage: Invalid channel or messageId');
    return null;
  }

  try {
    return await channel.messages.fetch(messageId);
  } catch (error) {
    console.warn(`Failed to fetch message ${messageId} in channel ${channel.id}:`, error.message);
    return null;
  }
}

/**
 * Safely send a DM to a user with fallback
 * Returns true if successful, false if failed
 * 
 * @param {User} user - Discord user object
 * @param {Object} messageOptions - Message options (embeds, content, etc.)
 * @returns {Promise<boolean>}
 */
async function safeSendDM(user, messageOptions) {
  if (!user) {
    console.warn('safeSendDM: Invalid user');
    return false;
  }

  try {
    await user.send(messageOptions);
    return true;
  } catch (error) {
    // User likely has DMs disabled or blocked the bot
    console.warn(`Failed to send DM to user ${user.id}:`, error.message);
    return false;
  }
}

/**
 * Safely delete a message with fallback
 * Returns true if successful, false if failed
 * 
 * @param {Message} message - Discord message object
 * @returns {Promise<boolean>}
 */
async function safeDeleteMessage(message) {
  if (!message) {
    console.warn('safeDeleteMessage: Invalid message');
    return false;
  }

  try {
    await message.delete();
    return true;
  } catch (error) {
    // Message might already be deleted or bot lacks permissions
    console.warn(`Failed to delete message ${message.id}:`, error.message);
    return false;
  }
}

/**
 * Safely update a message with fallback
 * Returns true if successful, false if failed
 * 
 * @param {Message} message - Discord message object
 * @param {Object} updateOptions - Message update options
 * @returns {Promise<boolean>}
 */
async function safeUpdateMessage(message, updateOptions) {
  if (!message) {
    console.warn('safeUpdateMessage: Invalid message');
    return false;
  }

  try {
    await message.edit(updateOptions);
    return true;
  } catch (error) {
    console.warn(`Failed to update message ${message.id}:`, error.message);
    return false;
  }
}

/**
 * Retry an operation with exponential backoff
 * Useful for operations that might fail due to rate limits
 * 
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in ms (default: 1000)
 * @returns {Promise<any>}
 */
async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

module.exports = {
  safeExecute,
  safeFetchMember,
  safeFetchChannel,
  safeFetchMessage,
  safeSendDM,
  safeDeleteMessage,
  safeUpdateMessage,
  retryOperation
};