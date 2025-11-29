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
    const opusUrl = broadcastManager.getStreamUrl(guildId);
    const pcmUrl = broadcastManager.getPcmStreamUrl(guildId);

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

    if (isActive && opusUrl) {
      embed.addFields({
        name: '🎵 Opus Stream URL (for Discord bots)',
        value: `\`\`\`${opusUrl}\`\`\``,
        inline: false
      });

      embed.addFields({
        name: '🎧 PCM Stream URL (for VLC/FFplay)',
        value: `\`\`\`${pcmUrl}\`\`\``,
        inline: false
      });

      embed.addFields({
        name: '📝 Usage Instructions',
        value: [
          '**For Music Bots (Hydra, Fredboat, etc.):**',
          '`/play ' + opusUrl + '`',
          '',
          '**For VLC:**',
          'Open VLC → Media → Open Network Stream',
          'Paste PCM URL and add options:',
          '`:demux=rawaud :rawaud-channels=2 :rawaud-samplerate=48000`',
          '',
          '**For FFplay (command line):**',
          '`ffplay -f s16le -ar 48000 -ac 2 ' + pcmUrl + '`'
        ].join('\n'),
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