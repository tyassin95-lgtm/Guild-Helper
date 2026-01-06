/**
 * Main message handler for automod system
 */

const { analyzeMessage, isObviouslySafe } = require('../utils/chatgptAnalyzer');
const { logModerationAction, sendLogToChannel } = require('../utils/moderationLogger');
const {
  addWarning,
  getWarningCount,
  shouldTimeout,
  sendWarningDM,
  logWarningToChannel,
  clearWarnings,
  WARNINGS_BEFORE_TIMEOUT
} = require('../utils/warningManager');

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

    // 2. Handle based on severity
    if (severity === 'low') {
      // LOW SEVERITY: Issue warning
      await addWarning({
        collections,
        guildId: guild.id,
        userId: author.id,
        reason,
        messageContent: message.content
      });

      const warningCount = await getWarningCount({
        collections,
        guildId: guild.id,
        userId: author.id
      });

      // Check if user has reached warning limit
      const reachedLimit = await shouldTimeout({
        collections,
        guildId: guild.id,
        userId: author.id
      });

      if (reachedLimit) {
        // Timeout user after reaching warning limit
        if (settings.timeoutUser !== false) {
          const timeoutMs = timeoutDuration * 1000;
          await member.timeout(timeoutMs, `AutoMod: ${WARNINGS_BEFORE_TIMEOUT} warnings reached`).catch(err => {
            console.error('Failed to timeout user:', err);
          });
        }

        // Clear warnings after timeout
        await clearWarnings({
          collections,
          guildId: guild.id,
          userId: author.id
        });

        // Send timeout DM
        if (settings.sendDM !== false) {
          const dmMessage = `**🚫 Timeout Notice from ${guild.name}**\n\n` +
            `You have been timed out for **${Math.floor(timeoutDuration / 60)} minutes** after receiving ${WARNINGS_BEFORE_TIMEOUT} warnings.\n\n` +
            `**Latest violation:** ${reason}\n\n` +
            `Your warnings have been reset. Please review the server rules and keep discussions respectful.\n\n` +
            `*If you believe this was a mistake, please contact a moderator.*`;

          await author.send(dmMessage).catch(err => {
            console.log(`Could not send DM to ${author.tag}:`, err.message);
          });
        }

        // Log timeout
        await logModerationAction({
          collections,
          guildId: guild.id,
          userId: author.id,
          channelId: channel.id,
          messageContent: message.content,
          reason: `${WARNINGS_BEFORE_TIMEOUT} warnings reached: ${reason}`,
          action: `Message deleted, user timed out for ${Math.floor(timeoutDuration / 60)} minutes`,
          severity: 'medium'
        });

        await sendLogToChannel({
          client,
          collections,
          guildId: guild.id,
          user: author,
          channel,
          messageContent: message.content,
          reason: `${WARNINGS_BEFORE_TIMEOUT} warnings reached: ${reason}`,
          action: `Message deleted, user timed out for ${Math.floor(timeoutDuration / 60)} minutes`,
          severity: 'medium'
        });

        console.log(`AutoMod: ${author.tag} timed out after ${WARNINGS_BEFORE_TIMEOUT} warnings`);
      } else {
        // Just a warning, no timeout yet
        if (settings.sendDM !== false) {
          await sendWarningDM({
            user: author,
            guild,
            channel,
            reason,
            warningCount
          });
        }

        // Log warning
        await logWarningToChannel({
          client,
          collections,
          guildId: guild.id,
          user: author,
          channel,
          messageContent: message.content,
          reason,
          warningCount
        });

        console.log(`AutoMod: Warning ${warningCount}/${WARNINGS_BEFORE_TIMEOUT} issued to ${author.tag} - ${reason}`);
      }

    } else if (severity === 'medium' || severity === 'high') {
      // MEDIUM/HIGH SEVERITY: Immediate timeout
      if (settings.timeoutUser !== false) {
        const timeoutMs = timeoutDuration * 1000;
        await member.timeout(timeoutMs, `AutoMod: ${reason}`).catch(err => {
          console.error('Failed to timeout user:', err);
        });
      }

      // Clear any existing warnings (since they got an immediate timeout)
      await clearWarnings({
        collections,
        guildId: guild.id,
        userId: author.id
      });

      // Send DM
      if (settings.sendDM !== false) {
        const dmMessage = `**🚫 AutoMod Notice from ${guild.name}**\n\n` +
          `Your message in #${channel.name} was removed and you have been timed out for **${Math.floor(timeoutDuration / 60)} minutes**.\n\n` +
          `**Reason:** ${reason}\n` +
          `**Severity:** ${severity.toUpperCase()}\n\n` +
          `Please review the server rules and ensure your messages follow community guidelines. Repeated violations may result in further action.\n\n` +
          `*If you believe this was a mistake, please contact a moderator.*`;

        await author.send(dmMessage).catch(err => {
          console.log(`Could not send DM to ${author.tag}:`, err.message);
        });
      }

      // Log
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

      console.log(`AutoMod action taken: ${author.tag} in #${channel.name} - ${reason} (${severity})`);
    }

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

    // Quick pre-filter: skip obviously safe messages
    if (isObviouslySafe(message.content)) {
      console.log(`Message skipped (obviously safe): "${message.content.substring(0, 50)}..."`);
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