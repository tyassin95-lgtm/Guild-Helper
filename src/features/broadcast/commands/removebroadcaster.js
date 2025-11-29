const { EmbedBuilder } = require('discord.js');
const { removeBroadcastUser } = require('../db/broadcastDb');

async function handleRemoveBroadcaster({ interaction, collections }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;
  const user = interaction.options.getUser('user');

  try {
    await removeBroadcastUser(collections, guildId, user.id);

    const embed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle('🗑️ Broadcaster Removed')
      .setDescription(`**${user.tag}** has been removed from the broadcast list.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('[RemoveBroadcaster] Error:', err);
    await interaction.editReply({
      content: `❌ Failed to remove broadcaster: ${err.message}`
    });
  }
}

module.exports = { handleRemoveBroadcaster };