const { EmbedBuilder } = require('discord.js');
const { getSession, getBroadcastUsers } = require('../db/broadcastDb');
const { broadcastManager } = require('../utils/broadcastManager');

async function handleBroadcastStatus({ interaction, collections, client }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;

  try {
    const session = await getSession(collections, guildId);
    const users = await getBroadcastUsers(collections, guildId);
    const isActive = broadcastManager.isActive(guildId);
    const streamUrl = broadcastManager.getStreamUrl(guildId);

    const embed = new EmbedBuilder()
      .setColor(isActive ? 0x00FF00 : 0x808080)
      .setTitle('📊 Broadcast Status')
      .setTimestamp();

    embed.addFields({
      name: '🔴 Status',
      value: isActive ? '✅ **ACTIVE**' : '⭕ Inactive',
      inline: true
    });

    if (session && session.sourceChannelId) {
      embed.addFields({
        name: '📡 Source Channel',
        value: `<#${session.sourceChannelId}>`,
        inline: true
      });
    }

    embed.addFields({
      name: `👥 Broadcast Users (${users.length})`,
      value: users.length > 0
        ? users.map(u => `• <@${u.userId}>`).join('\n')
        : 'None configured',
      inline: false
    });

    if (isActive && streamUrl) {
      embed.addFields({
        name: '🌐 Stream URL',
        value: `\`\`\`${streamUrl}\`\`\``,
        inline: false
      });
      embed.addFields({
        name: '🎵 Music Bot Instructions',
        value: 'Use a music bot (Hydra, Fredboat, etc.) with the `/play` command and paste the stream URL above.',
        inline: false
      });
    }

    if (users.length === 0 && !isActive) {
      embed.addFields({
        name: '⚙️ Setup Required',
        value: [
          '• Add broadcasters with `/addbroadcaster`',
          '• Start broadcast with `/startbroadcast`'
        ].join('\n')
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('[BroadcastStatus] Error:', err);
    await interaction.editReply({
      content: `❌ Failed to get status: ${err.message}`
    });
  }
}

module.exports = { handleBroadcastStatus };