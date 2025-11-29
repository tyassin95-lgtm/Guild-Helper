const { EmbedBuilder } = require('discord.js');
const { getBroadcastUsers } = require('../db/broadcastDb');

async function handleListBroadcasters({ interaction, collections }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;

  try {
    const users = await getBroadcastUsers(collections, guildId);

    if (users.length === 0) {
      return interaction.editReply({
        content: '📭 No broadcasters configured. Use `/addbroadcaster` to add users.'
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📡 Broadcast Users')
      .setDescription(
        users.map((u, i) => `${i + 1}. <@${u.userId}> (${u.username})`).join('\n')
      )
      .setFooter({ text: `Total: ${users.length} user(s)` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('[ListBroadcasters] Error:', err);
    await interaction.editReply({
      content: `❌ Failed to list broadcasters: ${err.message}`
    });
  }
}

module.exports = { handleListBroadcasters };