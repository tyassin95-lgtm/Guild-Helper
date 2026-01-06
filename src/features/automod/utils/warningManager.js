/**
 * Warning system manager - Handles 3-strike warning system before timeout
 */

const { EmbedBuilder } = require('discord.js');

// Configuration
const WARNINGS_BEFORE_TIMEOUT = 3;
const WARNING_EXPIRY_HOURS = 24;

/**
 * Add a warning to a user
 * @param {Object} params - Parameters
 * @param {Object} params.collections - Database collections
 * @param {string} params.guildId - Guild ID
 * @param {string} params.userId - User ID
 * @param {string} params.reason - Warning reason
 * @param {string} params.messageContent - Original message content
 * @returns {Promise<void>}
 */
async function addWarning({ collections, guildId, userId, reason, messageContent }) {
  const { automodWarnings } = collections;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + WARNING_EXPIRY_HOURS);

  try {
    await automodWarnings.insertOne({
      guildId,
      userId,
      reason,
      messageContent,
      timestamp: new Date(),
      expiresAt
    });

    console.log(`Added warning for user ${userId} in guild ${guildId}: ${reason}`);
  } catch (error) {
    console.error('Failed to add warning:', error);
    throw error;
  }
}

/**
 * Get active warnings for a user (within expiry window)
 * @param {Object} params - Parameters
 * @param {Object} params.collections - Database collections
 * @param {string} params.guildId - Guild ID
 * @param {string} params.userId - User ID
 * @returns {Promise<Array>} - Array of active warnings
 */
async function getActiveWarnings({ collections, guildId, userId }) {
  const { automodWarnings } = collections;

  try {
    const warnings = await automodWarnings
      .find({
        guildId,
        userId,
        expiresAt: { $gt: new Date() } // Only get non-expired warnings
      })
      .sort({ timestamp: -1 })
      .toArray();

    return warnings;
  } catch (error) {
    console.error('Failed to get active warnings:', error);
    return [];
  }
}

/**
 * Get current warning count for a user
 * @param {Object} params - Parameters
 * @param {Object} params.collections - Database collections
 * @param {string} params.guildId - Guild ID
 * @param {string} params.userId - User ID
 * @returns {Promise<number>} - Number of active warnings
 */
async function getWarningCount({ collections, guildId, userId }) {
  const warnings = await getActiveWarnings({ collections, guildId, userId });
  return warnings.length;
}

/**
 * Check if user should be timed out (reached warning limit)
 * @param {Object} params - Parameters
 * @param {Object} params.collections - Database collections
 * @param {string} params.guildId - Guild ID
 * @param {string} params.userId - User ID
 * @returns {Promise<boolean>} - True if user should be timed out
 */
async function shouldTimeout({ collections, guildId, userId }) {
  const warningCount = await getWarningCount({ collections, guildId, userId });
  return warningCount >= WARNINGS_BEFORE_TIMEOUT;
}

/**
 * Clear all warnings for a user
 * @param {Object} params - Parameters
 * @param {Object} params.collections - Database collections
 * @param {string} params.guildId - Guild ID
 * @param {string} params.userId - User ID
 * @returns {Promise<number>} - Number of warnings cleared
 */
async function clearWarnings({ collections, guildId, userId }) {
  const { automodWarnings } = collections;

  try {
    const result = await automodWarnings.deleteMany({
      guildId,
      userId
    });

    console.log(`Cleared ${result.deletedCount} warning(s) for user ${userId} in guild ${guildId}`);
    return result.deletedCount;
  } catch (error) {
    console.error('Failed to clear warnings:', error);
    return 0;
  }
}

/**
 * Send warning DM to user
 * @param {Object} params - Parameters
 * @param {User} params.user - Discord user object
 * @param {Guild} params.guild - Discord guild object
 * @param {Channel} params.channel - Discord channel object
 * @param {string} params.reason - Warning reason
 * @param {number} params.warningCount - Current warning count
 * @returns {Promise<boolean>} - True if DM was sent successfully
 */
async function sendWarningDM({ user, guild, channel, reason, warningCount }) {
  const warningsRemaining = WARNINGS_BEFORE_TIMEOUT - warningCount;

  let message = `**⚠️ Warning from ${guild.name}**\n\n`;
  message += `Your message in #${channel.name} was removed.\n\n`;
  message += `**Reason:** ${reason}\n`;
  message += `**Warning ${warningCount}/${WARNINGS_BEFORE_TIMEOUT}**\n\n`;

  if (warningsRemaining > 0) {
    message += `You have **${warningsRemaining} warning${warningsRemaining === 1 ? '' : 's'} remaining** before an automatic timeout.\n\n`;
    message += `Warnings expire after ${WARNING_EXPIRY_HOURS} hours.\n\n`;
  } else {
    message += `⚠️ **This is your final warning!** The next violation will result in an automatic timeout.\n\n`;
  }

  message += `Please keep discussions respectful and follow the server rules.\n\n`;
  message += `*If you believe this was a mistake, please contact a moderator.*`;

  try {
    await user.send(message);
    return true;
  } catch (error) {
    console.log(`Could not send warning DM to ${user.tag}:`, error.message);
    return false;
  }
}

/**
 * Log warning to moderation log channel
 * @param {Object} params - Parameters
 * @param {Client} params.client - Discord client
 * @param {Object} params.collections - Database collections
 * @param {string} params.guildId - Guild ID
 * @param {User} params.user - Discord user object
 * @param {Channel} params.channel - Discord channel object
 * @param {string} params.messageContent - Original message content
 * @param {string} params.reason - Warning reason
 * @param {number} params.warningCount - Current warning count
 * @returns {Promise<void>}
 */
async function logWarningToChannel({ client, collections, guildId, user, channel, messageContent, reason, warningCount }) {
  try {
    const { automodSettings } = collections;
    const settings = await automodSettings.findOne({ guildId });

    if (!settings || !settings.logChannelId) {
      return; // No log channel configured
    }

    const logChannel = await client.channels.fetch(settings.logChannelId).catch(() => null);
    if (!logChannel) {
      return; // Log channel not found
    }

    const warningsRemaining = WARNINGS_BEFORE_TIMEOUT - warningCount;

    const embed = new EmbedBuilder()
      .setColor('#f39c12') // Orange for warnings
      .setTitle('⚠️ AutoMod Warning Issued')
      .addFields(
        { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
        { name: '📍 Channel', value: `<#${channel.id}>`, inline: true },
        { name: '⚠️ Warning Count', value: `${warningCount}/${WARNINGS_BEFORE_TIMEOUT}`, inline: true },
        { name: '📝 Message Content', value: `\`\`\`${messageContent.substring(0, 1000)}\`\`\``, inline: false },
        { name: '🔍 Reason', value: reason, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: warningsRemaining > 0 ? `${warningsRemaining} warning${warningsRemaining === 1 ? '' : 's'} remaining before timeout` : '⚠️ Next violation = timeout' });

    // Add color coding based on severity
    if (warningCount >= WARNINGS_BEFORE_TIMEOUT) {
      embed.setColor('#e74c3c'); // Red for final warning
    }

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to send warning log to channel:', error);
  }
}

/**
 * Clean up expired warnings (called periodically or on-demand)
 * @param {Object} params - Parameters
 * @param {Object} params.collections - Database collections
 * @param {string} params.guildId - Optional: specific guild ID to clean
 * @returns {Promise<number>} - Number of warnings cleaned
 */
async function cleanExpiredWarnings({ collections, guildId = null }) {
  const { automodWarnings } = collections;

  try {
    const query = {
      expiresAt: { $lt: new Date() }
    };

    if (guildId) {
      query.guildId = guildId;
    }

    const result = await automodWarnings.deleteMany(query);

    if (result.deletedCount > 0) {
      console.log(`Cleaned ${result.deletedCount} expired warning(s)${guildId ? ` from guild ${guildId}` : ''}`);
    }

    return result.deletedCount;
  } catch (error) {
    console.error('Failed to clean expired warnings:', error);
    return 0;
  }
}

/**
 * Get warning statistics for a guild
 * @param {Object} params - Parameters
 * @param {Object} params.collections - Database collections
 * @param {string} params.guildId - Guild ID
 * @returns {Promise<Object>} - Warning statistics
 */
async function getWarningStats({ collections, guildId }) {
  const { automodWarnings } = collections;

  try {
    const totalWarnings = await automodWarnings.countDocuments({ guildId });
    const activeWarnings = await automodWarnings.countDocuments({
      guildId,
      expiresAt: { $gt: new Date() }
    });

    // Get users with warnings
    const usersWithWarnings = await automodWarnings.distinct('userId', {
      guildId,
      expiresAt: { $gt: new Date() }
    });

    // Get users at risk (2+ warnings)
    const atRiskUsers = [];
    for (const userId of usersWithWarnings) {
      const count = await getWarningCount({ collections, guildId, userId });
      if (count >= 2) {
        atRiskUsers.push({ userId, warningCount: count });
      }
    }

    return {
      totalWarnings,
      activeWarnings,
      usersWithWarnings: usersWithWarnings.length,
      atRiskUsers
    };
  } catch (error) {
    console.error('Failed to get warning stats:', error);
    return {
      totalWarnings: 0,
      activeWarnings: 0,
      usersWithWarnings: 0,
      atRiskUsers: []
    };
  }
}

module.exports = {
  WARNINGS_BEFORE_TIMEOUT,
  WARNING_EXPIRY_HOURS,
  addWarning,
  getActiveWarnings,
  getWarningCount,
  shouldTimeout,
  clearWarnings,
  sendWarningDM,
  logWarningToChannel,
  cleanExpiredWarnings,
  getWarningStats
};