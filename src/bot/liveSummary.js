const { DEBOUNCE_DELAY_MS } = require('../config');
const { buildSummaryEmbedsAndControls } = require('./summaryBuilder');

// Use a more robust debounce system with locks
const debounceMap = new Map(); // guildId -> { timeout, isUpdating }

function mkMsgUrl(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

async function fetchChannel(client, channelId) {
  try { return await client.channels.fetch(channelId); } catch { return null; }
}

async function fetchMessage(channel, messageId) {
  try { return await channel.messages.fetch(messageId); } catch { return null; }
}

/**
 * Create or rehome the live summary panel to targetChannelId (required).
 * Now creates multiple messages if needed.
 */
async function createOrUpdateLiveSummaryPanel(interaction, collections, targetChannelId) {
  const { liveSummaries } = collections;

  // Permissions check (on target channel)
  const targetChannel = await fetchChannel(interaction.client, targetChannelId) || interaction.channel;
  const perms = targetChannel?.permissionsFor?.(interaction.client.user);
  if (!perms?.has('ViewChannel') || !perms?.has('SendMessages') || !perms?.has('EmbedLinks')) {
    throw new Error('Missing permissions in this channel: need View Channel, Send Messages, and Embed Links.');
  }

  const { messages } = await buildSummaryEmbedsAndControls(interaction, collections);

  // Look up existing record
  const existing = await liveSummaries.findOne({ guildId: interaction.guildId });

  // If we have existing panel(s) but in a different channel, try to delete them
  if (existing && existing.channelId && existing.channelId !== targetChannelId) {
    const oldChannel = await fetchChannel(interaction.client, existing.channelId);
    if (oldChannel) {
      // Delete all stored message IDs
      for (const msgId of (existing.messageIds || [])) {
        const oldMsg = await fetchMessage(oldChannel, msgId);
        if (oldMsg) await oldMsg.delete().catch(() => {});
      }
    }
  }

  // If we have an existing panel in the same channel, try to update it
  if (existing && existing.channelId === targetChannelId && existing.messageIds) {
    const existingMessages = [];

    // Fetch all existing messages
    for (const msgId of existing.messageIds) {
      const msg = await fetchMessage(targetChannel, msgId);
      if (msg) existingMessages.push(msg);
    }

    // If we have the right number of messages, update them
    if (existingMessages.length === messages.length) {
      for (let i = 0; i < messages.length; i++) {
        await existingMessages[i].edit({ 
          embeds: messages[i].embeds, 
          components: messages[i].components 
        });
      }

      await liveSummaries.updateOne(
        { guildId: interaction.guildId },
        { $set: { guildId: interaction.guildId, channelId: targetChannel.id, messageIds: existingMessages.map(m => m.id) } },
        { upsert: true }
      );

      return { 
        guildId: interaction.guildId, 
        channelId: targetChannel.id, 
        messageIds: existingMessages.map(m => m.id),
        url: mkMsgUrl(interaction.guildId, targetChannel.id, existingMessages[0].id) 
      };
    } else {
      // Wrong number of messages, delete old ones and create new
      for (const msg of existingMessages) {
        await msg.delete().catch(() => {});
      }
    }
  }

  // Otherwise create fresh messages in the target channel
  const sentMessages = [];
  for (const message of messages) {
    const sent = await targetChannel.send({ 
      embeds: message.embeds, 
      components: message.components 
    });
    sentMessages.push(sent);
  }

  await liveSummaries.updateOne(
    { guildId: interaction.guildId },
    { $set: { guildId: interaction.guildId, channelId: targetChannel.id, messageIds: sentMessages.map(m => m.id) } },
    { upsert: true }
  );

  return { 
    guildId: interaction.guildId, 
    channelId: targetChannel.id, 
    messageIds: sentMessages.map(m => m.id),
    url: mkMsgUrl(interaction.guildId, targetChannel.id, sentMessages[0].id) 
  };
}

/** Remove the live panel for a guild (if present). */
async function clearLiveSummaryPanel(interaction, collections) {
  const { liveSummaries } = collections;
  const existing = await liveSummaries.findOne({ guildId: interaction.guildId });
  if (!existing) return false;

  const channel = await fetchChannel(interaction.client, existing.channelId);
  if (channel) {
    // Delete all messages
    for (const msgId of (existing.messageIds || [])) {
      const msg = await fetchMessage(channel, msgId);
      if (msg) await msg.delete().catch(() => {});
    }
  }

  await liveSummaries.deleteOne({ guildId: interaction.guildId });

  // Clear debounce entry
  const debounceEntry = debounceMap.get(interaction.guildId);
  if (debounceEntry?.timeout) {
    clearTimeout(debounceEntry.timeout);
  }
  debounceMap.delete(interaction.guildId);

  return true;
}

/**
 * Debounced refresh with improved race condition handling.
 * If messages are missing, recreate them in the saved channel.
 */
async function scheduleLiveSummaryUpdate(interaction, collections, delayMs = DEBOUNCE_DELAY_MS) {
  const { liveSummaries } = collections;
  const record = await liveSummaries.findOne({ guildId: interaction.guildId });
  if (!record) return; // not configured

  // Get or create debounce entry
  let debounceEntry = debounceMap.get(interaction.guildId);
  if (!debounceEntry) {
    debounceEntry = { timeout: null, isUpdating: false };
    debounceMap.set(interaction.guildId, debounceEntry);
  }

  // Clear existing timeout
  if (debounceEntry.timeout) {
    clearTimeout(debounceEntry.timeout);
  }

  const to = setTimeout(async () => {
    // Check if already updating (race condition protection)
    if (debounceEntry.isUpdating) {
      console.log(`Skipping duplicate update for guild ${interaction.guildId}`);
      return;
    }

    debounceEntry.isUpdating = true;

    try {
      const { messages } = await buildSummaryEmbedsAndControls(interaction, collections);

      let channel = await fetchChannel(interaction.client, record.channelId);
      if (!channel) {
        // last resort: use the channel from the interaction
        channel = interaction.channel;
      }

      if (!channel) {
        console.error(`Could not find channel for live summary guild ${interaction.guildId}`);
        debounceEntry.isUpdating = false;
        return;
      }

      // Fetch existing messages
      const existingMessages = [];
      for (const msgId of (record.messageIds || [])) {
        const msg = await fetchMessage(channel, msgId);
        if (msg) existingMessages.push(msg);
      }

      // If we have the right number of messages, update them
      if (existingMessages.length === messages.length) {
        for (let i = 0; i < messages.length; i++) {
          await existingMessages[i].edit({ 
            embeds: messages[i].embeds, 
            components: messages[i].components 
          });
        }
      } else {
        // Recreate all messages
        console.log(`Recreating live summary messages for guild ${interaction.guildId}`);

        // Delete old messages
        for (const msg of existingMessages) {
          await msg.delete().catch(() => {});
        }

        // Create new messages
        const newMessages = [];
        for (const message of messages) {
          const sent = await channel.send({ 
            embeds: message.embeds, 
            components: message.components 
          });
          newMessages.push(sent);
        }

        await liveSummaries.updateOne(
          { guildId: interaction.guildId },
          { $set: { channelId: channel.id, messageIds: newMessages.map(m => m.id) } },
          { upsert: true }
        );
      }
    } catch (e) {
      console.error('Live summary refresh failed:', e);
    } finally {
      debounceEntry.isUpdating = false;
      // Clean up the timeout reference
      debounceEntry.timeout = null;
    }
  }, delayMs);

  debounceEntry.timeout = to;
}

/**
 * Cleanup old debounce entries (call periodically)
 */
function cleanupDebounceMap() {
  const now = Date.now();
  for (const [guildId, entry] of debounceMap.entries()) {
    // If no timeout and not updating, remove the entry
    if (!entry.timeout && !entry.isUpdating) {
      debounceMap.delete(guildId);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupDebounceMap, 10 * 60 * 1000);

module.exports = {
  createOrUpdateLiveSummaryPanel,
  clearLiveSummaryPanel,
  scheduleLiveSummaryUpdate
};