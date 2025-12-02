const { PermissionFlagsBits } = require('discord.js');

async function handleGrantTokens({ interaction, collections }) {
  const { wishlists } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const targetUser = interaction.options.getUser('user');
  const tokenType = interaction.options.getString('type');
  const amount = interaction.options.getInteger('amount');

  await wishlists.updateOne(
    { userId: targetUser.id, guildId: interaction.guildId },
    { $inc: { [`tokenGrants.${tokenType}`]: amount } },
    { upsert: true }
  );

  return interaction.reply({ content: `✅ Granted ${amount} ${tokenType} token(s) to ${targetUser.tag}!`, flags: [64] });
}

module.exports = { handleGrantTokens };