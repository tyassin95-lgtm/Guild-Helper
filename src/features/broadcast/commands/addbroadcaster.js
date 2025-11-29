const { EmbedBuilder } = require('discord.js');
const { addBroadcastUser } = require('../db/broadcastDb');

async function handleAddBroadcaster({ interaction, collections }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;
  const user = interaction.options.getUser('user');

  try {
    await addBroadcastUser(collections, guildId, user.id, user.tag);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Broadcaster Added')
      .setDescription(`**${user.tag}** has been added to the broadcast list.`)
      .addFields({
        name: 'ℹ️ Note',
        value: 'Their voice will be captured and streamed when broadcasting is active.'
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('[AddBroadcaster] Error:', err);
    await interaction.editReply({
      content: `❌ Failed to add broadcaster: ${err.message}`
    });
  }
}

module.exports = { handleAddBroadcaster };