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
 * - If an old panel exists in a different channel, delete it.
 * - Always post/edit in the target channel.
 */
async function createOrUpdateLiveSummaryPanel(interaction, collections, targetChannelId) {
  const { liveSummaries } = collections;

  // Permissions check (on target channel)
  const targetChannel = await fetchChannel(interaction.client, targetChannelId) || interaction.channel;
  const perms = targetChannel?.permissionsFor?.(interaction.client.user);
  if (!perms?.has('ViewChannel') || !perms?.has('SendMessages') || !perms?.has('EmbedLinks')) {
    throw new Error('Missing permissions in this channel: need View Channel, Send Messages, and Embed Links.');
  }

  const { embeds, components } = await buildSummaryEmbedsAndControls(interaction, collections);

  // Look up existing record
  const existing = await liveSummaries.findOne({ guildId: interaction.guildId });

  // If we have an existing panel but in a different channel, try to delete it
  if (existing && existing.channelId && existing.channelId !== targetChannelId) {
    const oldChannel = await fetchChannel(interaction.client, existing.channelId);
    if (oldChannel) {
      const oldMsg = await fetchMessage(oldChannel, existing.messageId);
      if (oldMsg) await oldMsg.delete().catch(() => {});
    }
  }

  // If we have an existing panel in the same channel, try to edit it
  if (existing && existing.channelId === targetChannelId) {
    const msg = await fetchMessage(targetChannel, existing.messageId);
    if (msg) {
      await msg.edit({ embeds, components });
      // ensure record is up to date
      await liveSummaries.updateOne(
        { guildId: interaction.guildId },
        { $set: { guildId: interaction.guildId, channelId: targetChannel.id, messageId: msg.id } },
        { upsert: true }
      );
      return { guildId: interaction.guildId, channelId: msg.channel.id, messageId: msg.id, url: mkMsgUrl(interaction.guildId, msg.channel.id, msg.id) };
    }
  }

  // Otherwise create a fresh message in the target channel
  const sent = await targetChannel.send({ embeds, components });
  await liveSummaries.updateOne(
    { guildId: interaction.guildId },
    { $set: { guildId: interaction.guildId, channelId: sent.channel.id, messageId: sent.id } },
    { upsert: true }
  );

  return { guildId: interaction.guildId, channelId: sent.channel.id, messageId: sent.id, url: mkMsgUrl(interaction.guildId, sent.channel.id, sent.id) };
}

/** Remove the live panel for a guild (if present). */
async function clearLiveSummaryPanel(interaction, collections) {
  const { liveSummaries } = collections;
  const existing = await liveSummaries.findOne({ guildId: interaction.guildId });
  if (!existing) return false;

  const channel = await fetchChannel(interaction.client, existing.channelId);
  if (channel) {
    const msg = await fetchMessage(channel, existing.messageId);
    if (msg) await msg.delete().catch(() => {});
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
 * If message is missing, recreate it in the saved channel.
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
      const { embeds, components } = await buildSummaryEmbedsAndControls(interaction, collections);

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

      let msg = await fetchMessage(channel, record.messageId);
      if (!msg) {
        // recreate
        console.log(`Recreating live summary message for guild ${interaction.guildId}`);
        msg = await channel.send({ embeds, components });
        await liveSummaries.updateOne(
          { guildId: interaction.guildId },
          { $set: { channelId: msg.channel.id, messageId: msg.id } },
          { upsert: true }
        );
      } else {
        // update existing
        await msg.edit({ embeds, components });
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