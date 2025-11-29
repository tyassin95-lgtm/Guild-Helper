const { getAudioManager } = require('../utils/audioManager');
const { updateSessionTargets } = require('../broadcastSession');

async function handleBroadcastRemoveChannel({ interaction, collections }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;
  const channel = interaction.options.getChannel('channel');

  const audioManager = getAudioManager(guildId);

  if (!audioManager.isActive()) {
    return interaction.editReply({
      content: '❌ No active broadcast. Start one with `/broadcast start` first.'
    });
  }

  const status = audioManager.getStatus();

  if (!status.targetChannelIds.includes(channel.id)) {
    return interaction.editReply({
      content: `❌ **${channel.name}** is not a target channel.`
    });
  }

  try {
    // Remove channel from broadcast
    await audioManager.removeTargetChannel(channel.id);

    // Update database
    const updatedTargets = status.targetChannelIds.filter(id => id !== channel.id);
    await updateSessionTargets(collections, guildId, updatedTargets);

    if (updatedTargets.length === 0) {
      // No targets left, stop broadcast
      await audioManager.cleanup();

      await interaction.editReply({
        embeds: [{
          title: '⏹️ Broadcast Stopped',
          description: `**${channel.name}** was removed. No target channels remain, so the broadcast has been stopped.`,
          color: 0xED4245
        }]
      });
    } else {
      await interaction.editReply({
        embeds: [{
          title: '✅ Channel Removed',
          description: `**${channel.name}** has been removed from the broadcast.`,
          color: 0x57F287,
          fields: [
            {
              name: '📊 Current Broadcast',
              value: `**Target Channels:** ${updatedTargets.length}\n**Active Speakers:** ${status.activeSpeakers}`
            }
          ]
        }]
      });
    }

  } catch (error) {
    console.error('Failed to remove channel:', error);
    await interaction.editReply({
      content: `❌ Failed to remove channel: ${error.message}`
    });
  }
}

module.exports = { handleBroadcastRemoveChannel };