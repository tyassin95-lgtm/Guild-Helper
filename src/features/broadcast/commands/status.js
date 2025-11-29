const { getAudioManager } = require('../utils/audioManager');

async function handleBroadcastStatus({ interaction, collections }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;
  const audioManager = getAudioManager(guildId);

  if (!audioManager.isActive()) {
    return interaction.editReply({
      embeds: [{
        title: '📡 Broadcast Status',
        description: 'No active broadcast.',
        color: 0x5865F2,
        footer: { text: 'Use /broadcast setup to configure and start a broadcast' }
      }]
    });
  }

  const status = audioManager.getStatus();

  const sourceChannel = interaction.guild.channels.cache.get(status.sourceChannelId);
  const targetChannels = status.targetChannelIds
    .map(id => interaction.guild.channels.cache.get(id))
    .filter(Boolean);

  const targetNames = targetChannels.map(c => `• ${c.name}`).join('\n') || 'None';

  const embed = {
    title: '📡 Broadcast Status',
    description: '🟢 Broadcast is **ACTIVE**',
    color: 0x57F287,
    fields: [
      {
        name: '📻 Source Channel',
        value: sourceChannel ? sourceChannel.name : 'Unknown',
        inline: true
      },
      {
        name: '🎯 Target Channels',
        value: `${status.targetCount} channel(s)`,
        inline: true
      },
      {
        name: '🔊 Volume',
        value: `${status.volumeLevel}%`,
        inline: true
      },
      {
        name: '🎤 Active Speakers',
        value: `${status.activeSpeakers}`,
        inline: true
      },
      {
        name: '🔌 Connection Status',
        value: status.sourceConnected ? '✅ Connected' : '⚠️ Connecting...',
        inline: true
      },
      {
        name: '📋 Target Channel List',
        value: targetNames,
        inline: false
      }
    ],
    footer: { text: 'Use /broadcast stop to end the broadcast' },
    timestamp: new Date()
  };

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { handleBroadcastStatus };