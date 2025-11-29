const { getAudioManager } = require('../utils/audioManager');
const { updateSessionTargets, getActiveSession } = require('../broadcastSession');

async function handleBroadcastAddChannel({ interaction, collections }) {
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

  if (status.targetChannelIds.includes(channel.id)) {
    return interaction.editReply({
      content: `❌ **${channel.name}** is already a target channel.`
    });
  }

  if (status.sourceChannelId === channel.id) {
    return interaction.editReply({
      content: `❌ Cannot add the source channel as a target.`
    });
  }

  try {
    // Add channel to broadcast
    await audioManager.addTargetChannel(interaction.guild, channel.id, {});

    // Update database
    const updatedTargets = [...status.targetChannelIds, channel.id];
    await updateSessionTargets(collections, guildId, updatedTargets);

    await interaction.editReply({
      embeds: [{
        title: '✅ Channel Added',
        description: `**${channel.name}** has been added to the broadcast.`,
        color: 0x57F287,
        fields: [
          {
            name: '📊 Current Broadcast',
            value: `**Target Channels:** ${updatedTargets.length}\n**Active Speakers:** ${status.activeSpeakers}`
          }
        ]
      }]
    });

  } catch (error) {
    console.error('Failed to add channel:', error);
    await interaction.editReply({
      content: `❌ Failed to add channel: ${error.message}`
    });
  }
}

module.exports = { handleBroadcastAddChannel };