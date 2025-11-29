const { getAudioManager } = require('../utils/audioManager');
const { updateSessionVolume } = require('../broadcastSession');

async function handleBroadcastVolume({ interaction, collections }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;
  const level = interaction.options.getInteger('level');

  const audioManager = getAudioManager(guildId);

  if (!audioManager.isActive()) {
    return interaction.editReply({
      content: '❌ No active broadcast. Start one with `/broadcast start` first.'
    });
  }

  try {
    // Set volume
    audioManager.setVolume(level);

    // Update database
    await updateSessionVolume(collections, guildId, level);

    const volumeEmoji = level === 0 ? '🔇' : level < 33 ? '🔉' : level < 66 ? '🔊' : '📢';

    await interaction.editReply({
      embeds: [{
        title: `${volumeEmoji} Volume Updated`,
        description: `Broadcast volume set to **${level}%**`,
        color: 0x5865F2,
        footer: { text: 'Volume change applies to new audio streams' }
      }]
    });

  } catch (error) {
    console.error('Failed to set volume:', error);
    await interaction.editReply({
      content: `❌ Failed to set volume: ${error.message}`
    });
  }
}

module.exports = { handleBroadcastVolume };