/**
 * Main message handler for automod system
 */

const { analyzeMessage } = require('../utils/chatgptAnalyzer');
const { logModerationAction, sendLogToChannel } = require('../utils/moderationLogger');

/**
 * Check if user is exempt from automod
 */
async function isUserExempt({ member, settings }) {
  if (!settings || !settings.exemptRoleIds || settings.exemptRoleIds.length === 0) {
    return false;
  }

  // Check if user has any exempt roles
  return member.roles.cache.some(role => settings.exemptRoleIds.includes(role.id));
}

/**
 * Check if channel is being monitored
 */
function isChannelMonitored({ channelId, settings }) {
  if (!settings || !settings.enabledChannelIds || settings.enabledChannelIds.length === 0) {
    return false;
  }

  return settings.enabledChannelIds.includes(channelId);
}

/**
 * Take moderation action on a user
 */
async function takeModerationAction({ message, reason, severity, settings, collections, client }) {
  const { member, channel, guild, author } = message;
  const timeoutDuration = settings.timeoutDuration || 300; // Default 5 minutes

  try {
    // 1. Delete the message
    await message.delete().catch(err => {
      console.error('Failed to delete message:', err);
    });

    // 2. Timeout the user
    if (settings.timeoutUser !== false) { // Default to true
      const timeoutMs = timeoutDuration * 1000;
      await member.timeout(timeoutMs, `AutoMod: ${reason}`).catch(err => {
        console.error('Failed to timeout user:', err);
      });
    }

    // 3. Send DM notification
    if (settings.sendDM !== false) { // Default to true
      const dmMessage = `**⚠️ AutoMod Notice**\n\n` +
        `Your message in **${guild.name}** (#${channel.name}) was removed and you have been timed out for **${Math.floor(timeoutDuration / 60)} minutes**.\n\n` +
        `**Reason:** ${reason}\n` +
        `**Severity:** ${severity.toUpperCase()}\n\n` +
        `Please review the server rules and ensure your messages follow community guidelines. Repeated violations may result in further action.\n\n` +
        `*If you believe this was a mistake, please contact a moderator.*`;

      await author.send(dmMessage).catch(err => {
        console.log(`Could not send DM to ${author.tag}:`, err.message);
      });
    }

    // 4. Log to database
    await logModerationAction({
      collections,
      guildId: guild.id,
      userId: author.id,
      channelId: channel.id,
      messageContent: message.content,
      reason,
      action: `Message deleted, ${settings.timeoutUser !== false ? `user timed out for ${Math.floor(timeoutDuration / 60)} minutes` : 'no timeout'}`,
      severity
    });

    // 5. Send to log channel
    await sendLogToChannel({
      client,
      collections,
      guildId: guild.id,
      user: author,
      channel,
      messageContent: message.content,
      reason,
      action: `Message deleted, ${settings.timeoutUser !== false ? `user timed out for ${Math.floor(timeoutDuration / 60)} minutes` : 'no timeout'}`,
      severity
    });

    console.log(`AutoMod action taken: ${author.tag} in #${channel.name} - ${reason}`);

  } catch (error) {
    console.error('Error taking moderation action:', error);
  }
}

/**
 * Main message check handler
 */
async function handleAutoModCheck({ message, collections, client }) {
  // Ignore bots
  if (message.author.bot) return;

  // Ignore DMs
  if (!message.guild) return;

  const { automodSettings } = collections;

  try {
    // Get automod settings for this guild
    const settings = await automodSettings.findOne({ guildId: message.guild.id });

    // Check if automod is enabled
    if (!settings || !settings.enabled) {
      return;
    }

    // Check if channel is being monitored
    if (!isChannelMonitored({ channelId: message.channel.id, settings })) {
      return;
    }

    // Check if user is exempt
    const exempt = await isUserExempt({ member: message.member, settings });
    if (exempt) {
      return;
    }

    // Ignore empty messages or messages with only attachments
    if (!message.content || message.content.trim().length === 0) {
      return;
    }

    // Analyze message with ChatGPT
    console.log(`Analyzing message from ${message.author.tag}: "${message.content.substring(0, 100)}..."`);

    const analysis = await analyzeMessage(message.content);

    // Take action if message is flagged
    if (analysis.flagged) {
      console.log(`Message flagged: ${analysis.reason} (Severity: ${analysis.severity})`);

      // Check severity threshold
      const severityThreshold = settings.severityThreshold || 'low';
      const severityLevels = { none: 0, low: 1, medium: 2, high: 3 };

      if (severityLevels[analysis.severity] >= severityLevels[severityThreshold]) {
        await takeModerationAction({
          message,
          reason: analysis.reason,
          severity: analysis.severity,
          settings,
          collections,
          client
        });
      } else {
        console.log(`Message flagged but below severity threshold (${analysis.severity} < ${severityThreshold})`);
      }
    } else {
      console.log(`Message passed: ${analysis.reason}`);
    }

  } catch (error) {
    console.error('AutoMod check error:', error);
  }
}

module.exports = {
  handleAutoModCheck,
  isUserExempt,
  isChannelMonitored
};