const debounceMap = new Map(); // guildId -> timeout
const { buildSummaryEmbedsAndControls } = require('./summaryBuilder');

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
  return true;
}

/**
 * Debounced refresh. If message is missing, recreate it in the saved channel.
 */
async function scheduleLiveSummaryUpdate(interaction, collections, delayMs = 1200) {
  const { liveSummaries } = collections;
  const record = await liveSummaries.findOne({ guildId: interaction.guildId });
  if (!record) return; // not configured

  clearTimeout(debounceMap.get(interaction.guildId));
  const to = setTimeout(async () => {
    try {
      const { embeds, components } = await buildSummaryEmbedsAndControls(interaction, collections);

      let channel = await fetchChannel(interaction.client, record.channelId);
      if (!channel) {
        // last resort: use the channel from the interaction
        channel = interaction.channel;
      }

      let msg = await fetchMessage(channel, record.messageId);
      if (!msg) {
        // recreate
        msg = await channel.send({ embeds, components });
        await liveSummaries.updateOne(
          { guildId: interaction.guildId },
          { $set: { channelId: msg.channel.id, messageId: msg.id } },
          { upsert: true }
        );
        return;
      }

      await msg.edit({ embeds, components });
    } catch (e) {
      console.error('Live summary refresh failed:', e);
    }
  }, delayMs);

  debounceMap.set(interaction.guildId, to);
}

module.exports = {
  createOrUpdateLiveSummaryPanel,
  clearLiveSummaryPanel,
  scheduleLiveSummaryUpdate
};
