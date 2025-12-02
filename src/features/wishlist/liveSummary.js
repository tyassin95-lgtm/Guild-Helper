const { DEBOUNCE_DELAY_MS } = require('../../config');
const { buildSummaryEmbedsAndControls } = require('./summaryBuilder');

const debounceMap = new Map();

function mkMsgUrl(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

async function fetchChannel(client, channelId) {
  try { return await client.channels.fetch(channelId); } catch { return null; }
}

async function fetchMessage(channel, messageId) {
  try { return await channel.messages.fetch(messageId); } catch { return null; }
}

async function createOrUpdateLiveSummaryPanel(interaction, collections, targetChannelId) {
  const { liveSummaries } = collections;

  const targetChannel = await fetchChannel(interaction.client, targetChannelId) || interaction.channel;
  const perms = targetChannel?.permissionsFor?.(interaction.client.user);
  if (!perms?.has('ViewChannel') || !perms?.has('SendMessages') || !perms?.has('EmbedLinks')) {
    throw new Error('Missing permissions in this channel: need View Channel, Send Messages, and Embed Links.');
  }

  const { messages } = await buildSummaryEmbedsAndControls(interaction, collections);

  const existing = await liveSummaries.findOne({ guildId: interaction.guildId });

  if (existing && existing.channelId && existing.channelId !== targetChannelId) {
    const oldChannel = await fetchChannel(interaction.client, existing.channelId);
    if (oldChannel) {
      for (const msgId of (existing.messageIds || [])) {
        const oldMsg = await fetchMessage(oldChannel, msgId);
        if (oldMsg) await oldMsg.delete().catch(() => {});
      }
    }
  }

  if (existing && existing.channelId === targetChannelId && existing.messageIds) {
    const existingMessages = [];

    for (const msgId of existing.messageIds) {
      const msg = await fetchMessage(targetChannel, msgId);
      if (msg) existingMessages.push(msg);
    }

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
      for (const msg of existingMessages) {
        await msg.delete().catch(() => {});
      }
    }
  }

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

async function clearLiveSummaryPanel(interaction, collections) {
  const { liveSummaries } = collections;
  const existing = await liveSummaries.findOne({ guildId: interaction.guildId });
  if (!existing) return false;

  const channel = await fetchChannel(interaction.client, existing.channelId);
  if (channel) {
    for (const msgId of (existing.messageIds || [])) {
      const msg = await fetchMessage(channel, msgId);
      if (msg) await msg.delete().catch(() => {});
    }
  }

  await liveSummaries.deleteOne({ guildId: interaction.guildId });

  const debounceEntry = debounceMap.get(interaction.guildId);
  if (debounceEntry?.timeout) {
    clearTimeout(debounceEntry.timeout);
  }
  debounceMap.delete(interaction.guildId);

  return true;
}

async function scheduleLiveSummaryUpdate(interaction, collections, delayMs = DEBOUNCE_DELAY_MS) {
  const { liveSummaries } = collections;
  const record = await liveSummaries.findOne({ guildId: interaction.guildId });
  if (!record) return;

  let debounceEntry = debounceMap.get(interaction.guildId);
  if (!debounceEntry) {
    debounceEntry = { timeout: null, isUpdating: false };
    debounceMap.set(interaction.guildId, debounceEntry);
  }

  if (debounceEntry.timeout) {
    clearTimeout(debounceEntry.timeout);
  }

  const to = setTimeout(async () => {
    if (debounceEntry.isUpdating) {
      console.log(`Skipping duplicate update for guild ${interaction.guildId}`);
      return;
    }

    debounceEntry.isUpdating = true;

    try {
      const { messages } = await buildSummaryEmbedsAndControls(interaction, collections);

      let channel = await fetchChannel(interaction.client, record.channelId);
      if (!channel) {
        channel = interaction.channel;
      }

      if (!channel) {
        console.error(`Could not find channel for live summary guild ${interaction.guildId}`);
        debounceEntry.isUpdating = false;
        return;
      }

      const existingMessages = [];
      for (const msgId of (record.messageIds || [])) {
        const msg = await fetchMessage(channel, msgId);
        if (msg) existingMessages.push(msg);
      }

      if (existingMessages.length === messages.length) {
        for (let i = 0; i < messages.length; i++) {
          await existingMessages[i].edit({ 
            embeds: messages[i].embeds, 
            components: messages[i].components 
          });
        }
      } else {
        console.log(`Recreating live summary messages for guild ${interaction.guildId}`);

        for (const msg of existingMessages) {
          await msg.delete().catch(() => {});
        }

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
      debounceEntry.timeout = null;
    }
  }, delayMs);

  debounceEntry.timeout = to;
}

function cleanupDebounceMap() {
  const now = Date.now();
  for (const [guildId, entry] of debounceMap.entries()) {
    if (!entry.timeout && !entry.isUpdating) {
      debounceMap.delete(guildId);
    }
  }
}

setInterval(cleanupDebounceMap, 10 * 60 * 1000);

module.exports = {
  createOrUpdateLiveSummaryPanel,
  clearLiveSummaryPanel,
  scheduleLiveSummaryUpdate
};