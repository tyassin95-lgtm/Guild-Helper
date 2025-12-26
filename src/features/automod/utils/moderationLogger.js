/**
 * Moderation action logger
 */

const { EmbedBuilder } = require('discord.js');

/**
 * Log a moderation action to the database
 */
async function logModerationAction({ collections, guildId, userId, channelId, messageContent, reason, action, severity }) {
  const { automodLogs } = collections;

  try {
    await automodLogs.insertOne({
      guildId,
      userId,
      channelId,
      messageContent,
      reason,
      action,
      severity,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to log moderation action:', error);
  }
}

/**
 * Send moderation log to configured log channel
 */
async function sendLogToChannel({ client, collections, guildId, user, channel, messageContent, reason, action, severity }) {
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

    const severityColors = {
      low: '#f39c12',    // Orange
      medium: '#e74c3c', // Red
      high: '#c0392b'    // Dark red
    };

    const embed = new EmbedBuilder()
      .setColor(severityColors[severity] || '#e74c3c')
      .setTitle('🚨 AutoMod Action Taken')
      .addFields(
        { name: '👤 User', value: `${user.tag} (${user.id})`, inline: true },
        { name: '📍 Channel', value: `<#${channel.id}>`, inline: true },
        { name: '⚠️ Severity', value: severity.toUpperCase(), inline: true },
        { name: '📝 Message Content', value: `\`\`\`${messageContent.substring(0, 1000)}\`\`\``, inline: false },
        { name: '🔍 Reason', value: reason, inline: false },
        { name: '⚡ Action Taken', value: action, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'AutoMod System' });

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to send log to channel:', error);
  }
}

/**
 * Get moderation logs for a user
 */
async function getUserLogs({ collections, guildId, userId, limit = 10 }) {
  const { automodLogs } = collections;

  try {
    const logs = await automodLogs
      .find({ guildId, userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return logs;
  } catch (error) {
    console.error('Failed to get user logs:', error);
    return [];
  }
}

/**
 * Get recent moderation logs for the server
 */
async function getRecentLogs({ collections, guildId, limit = 20 }) {
  const { automodLogs } = collections;

  try {
    const logs = await automodLogs
      .find({ guildId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return logs;
  } catch (error) {
    console.error('Failed to get recent logs:', error);
    return [];
  }
}

module.exports = {
  logModerationAction,
  sendLogToChannel,
  getUserLogs,
  getRecentLogs
};