const { PermissionFlagsBits } = require('discord.js');

async function handleResetUser({ interaction, collections }) {
  const { wishlists } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to reset wishlists.', ephemeral: true });
  }

  const targetUser = interaction.options.getUser('user');
  const result = await wishlists.updateOne(
    { userId: targetUser.id, guildId: interaction.guildId },
    { $set: { finalized: false } }
  );

  if (result.matchedCount === 0) {
    return interaction.reply({ content: '❌ User has no wishlist.', ephemeral: true });
  }

  return interaction.reply({ content: `✅ ${targetUser.tag}'s wishlist has been unlocked for editing.`, ephemeral: true });
}

module.exports = { handleResetUser };
