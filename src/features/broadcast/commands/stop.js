const { getAudioManager } = require('../utils/audioManager');
const { endSession } = require('../broadcastSession');

async function handleBroadcastStop({ interaction, collections }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;
  const audioManager = getAudioManager(guildId);

  if (!audioManager.isActive()) {
    return interaction.editReply({
      content: '❌ No active broadcast to stop.'
    });
  }

  const status = audioManager.getStatus();

  try {
    // Stop the broadcast
    await audioManager.cleanup();

    // Update database
    await endSession(collections, guildId);

    await interaction.editReply({
      embeds: [{
        title: '⏹️ Broadcast Stopped',
        description: 'The audio broadcast has been stopped and all voice connections have been closed.',
        color: 0xED4245,
        fields: [
          {
            name: '📊 Session Stats',
            value: `**Target Channels:** ${status.targetCount}\n**Active Speakers:** ${status.activeSpeakers}`
          }
        ]
      }]
    });

  } catch (error) {
    console.error('Failed to stop broadcast:', error);
    await interaction.editReply({
      content: `❌ Failed to stop broadcast: ${error.message}`
    });
  }
}

module.exports = { handleBroadcastStop };