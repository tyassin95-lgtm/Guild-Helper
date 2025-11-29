const { EmbedBuilder } = require('discord.js');
const { broadcastManager } = require('../utils/broadcastManager');
const { endSession } = require('../db/broadcastDb');

async function handleStopBroadcast({ interaction, collections, client }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;

  try {
    if (!broadcastManager.isActive(guildId)) {
      return interaction.editReply({
        content: '❌ No active broadcast to stop.'
      });
    }

    await broadcastManager.stopBroadcast(guildId);
    await endSession(collections, guildId);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🛑 Broadcast Stopped')
      .setDescription('The voice broadcast stream has been stopped.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('[StopBroadcast] Error:', err);
    await interaction.editReply({
      content: `❌ Failed to stop broadcast: ${err.message}`
    });
  }
}

module.exports = { handleStopBroadcast };