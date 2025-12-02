const { PermissionFlagsBits } = require('discord.js');
const { getUserWishlist } = require('../utils/wishlistHelper');

async function handleRemoveTokens({ interaction, collections }) {
  const { wishlists } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const targetUser = interaction.options.getUser('user');
  const tokenType = interaction.options.getString('type');
  const amount = interaction.options.getInteger('amount');

  const wl = await getUserWishlist(wishlists, targetUser.id, interaction.guildId);
  const current = wl.tokenGrants?.[tokenType] || 0;
  const newGrant = Math.max(0, current - amount);

  await wishlists.updateOne(
    { userId: targetUser.id, guildId: interaction.guildId },
    { $set: { [`tokenGrants.${tokenType}`]: newGrant } },
    { upsert: true }
  );

  return interaction.reply({ content: `✅ Removed ${amount} ${tokenType} token(s) from ${targetUser.tag}. New ${tokenType} grants: ${newGrant}.`, flags: [64] });
}

module.exports = { handleRemoveTokens };