/**
 * Main message handler for automod system with reaction-based translation
 */

const { analyzeMessageForModeration } = require('../utils/chatgptAnalyzer');
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

function isUserExempt({ member, settings }) {
  if (!settings || !settings.exemptRoleIds || settings.exemptRoleIds.length === 0) {
    return false;
  }

  return member.roles.cache.some(role => settings.exemptRoleIds.includes(role.id));
}

function isChannelMonitored({ channelId, settings }) {
  if (!settings || !settings.enabledChannelIds || settings.enabledChannelIds.length === 0) {
    return false;
  }

  return settings.enabledChannelIds.includes(channelId);
}

function shouldAddTranslationReactions(message) {
  const content = message.content.trim();

  if (!content || content.length === 0) {
    return false;
  }

  if (message.attachments.size > 0 && !content) {
    return false;
  }

  const urlRegex = /^https?:\/\/[^\s]+$/i;
  if (urlRegex.test(content)) {
    return false;
  }

  const emojiOnlyRegex = /^[\p{Emoji}\s]+$/u;
  if (emojiOnlyRegex.test(content)) {
    return false;
  }

  const words = content.split(/\s+/).filter(word => word.length > 0);
  if (words.length === 1) {
    return false;
  }

  return true;
}

async function addTranslationReactionsToMessage(message, sourceLanguage, settings) {
  const enabledLanguages = settings.translationLanguages || ['en', 'de', 'fr', 'es'];

  const languageFlags = {
    en: '🇬🇧',
    de: '🇩🇪',
    fr: '🇫🇷',
    es: '🇪🇸'
  };

  const reactionsToAdd = enabledLanguages
    .filter(lang => lang !== sourceLanguage)
    .map(lang => languageFlags[lang])
    .filter(Boolean);

  for (const emoji of reactionsToAdd) {
    try {
      await message.react(emoji);
    } catch (error) {
      console.error(`Failed to add reaction ${emoji}:`, error);
    }
  }

  if (reactionsToAdd.length > 0) {
    console.log(`Added translation reactions to message from ${message.author.tag}: ${reactionsToAdd.join(' ')}`);
  }
}

async function takeModerationAction({ message, reason, severity, settings, collections, client }) {
  const { member, channel, guild, author } = message;
  const timeoutDuration = settings.timeoutDuration || 300;

  try {
    if (severity === 'low') {
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

      const reachedLimit = await shouldTimeout({
        collections,
        guildId: guild.id,
        userId: author.id
      });

      if (reachedLimit) {
        await message.delete().catch(err => {
          console.error('Failed to delete message:', err);
        });

        if (settings.timeoutUser !== false) {
          const timeoutMs = timeoutDuration * 1000;
          await member.timeout(timeoutMs, `AutoMod: ${WARNINGS_BEFORE_TIMEOUT} warnings reached`).catch(err => {
            console.error('Failed to timeout user:', err);
          });
        }

        await clearWarnings({
          collections,
          guildId: guild.id,
          userId: author.id
        });

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
        if (settings.sendDM !== false) {
          await sendWarningDM({
            user: author,
            guild,
            channel,
            reason,
            warningCount
          });
        }

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

        console.log(`AutoMod: Warning ${warningCount}/${WARNINGS_BEFORE_TIMEOUT} issued to ${author.tag} - ${reason} (message kept)`);
      }

    } else if (severity === 'medium' || severity === 'high') {
      await message.delete().catch(err => {
        console.error('Failed to delete message:', err);
      });

      if (settings.timeoutUser !== false) {
        const timeoutMs = timeoutDuration * 1000;
        await member.timeout(timeoutMs, `AutoMod: ${reason}`).catch(err => {
          console.error('Failed to timeout user:', err);
        });
      }

      await clearWarnings({
        collections,
        guildId: guild.id,
        userId: author.id
      });

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

async function handleAutoModCheck({ message, collections, client }) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const { automodSettings } = collections;

  try {
    const settings = await automodSettings.findOne({ guildId: message.guild.id });

    if (!settings || !settings.enabled) {
      return;
    }

    if (!isChannelMonitored({ channelId: message.channel.id, settings })) {
      return;
    }

    const exempt = await isUserExempt({ member: message.member, settings });
    if (exempt) {
      return;
    }

    if (!message.content || message.content.trim().length === 0) {
      return;
    }

    console.log(`Analyzing message from ${message.author.tag}: "${message.content.substring(0, 100)}..."`);

    const analysis = await analyzeMessageForModeration(message.content);

    if (analysis.flagged) {
      console.log(`Message flagged: ${analysis.reason} (Severity: ${analysis.severity})`);

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

      if (settings.translationEnabled && shouldAddTranslationReactions(message)) {
        await addTranslationReactionsToMessage(message, analysis.sourceLanguage, settings);
      }
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