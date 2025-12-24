const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function handleResetBonuses({ interaction, collections }) {
  const { pvpBonuses } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // Get confirmation first
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_reset_bonuses_yes')
      .setLabel('Yes, reset all bonuses')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚠️'),
    new ButtonBuilder()
      .setCustomId('confirm_reset_bonuses_no')
      .setLabel('No, cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  // Count current bonuses
  const currentBonuses = await pvpBonuses.countDocuments({ guildId: interaction.guildId });

  return interaction.reply({
    content: `⚠️ **WARNING**: This will reset **all PvP bonuses** for this server.\n\n` +
             `Current bonuses: **${currentBonuses}**\n\n` +
             `This will:\n` +
             `• Clear all weekly PvP attendance bonuses\n` +
             `• Reset all bonus counts to 0\n\n` +
             `**This action cannot be undone!**`,
    components: [row],
    flags: [64]
  });
}

async function handleResetBonusesConfirmation({ interaction, collections }) {
  const { pvpBonuses } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.update({ content: '❌ You need administrator permissions.', components: [] });
  }

  if (interaction.customId === 'confirm_reset_bonuses_no') {
    return interaction.update({ content: '❎ Reset cancelled. No changes made.', components: [] });
  }

  await interaction.deferUpdate();

  // Reset all bonuses for this guild
  const result = await pvpBonuses.deleteMany({ guildId: interaction.guildId });

  let message = `✅ **PvP bonus reset complete!**\n\n`;
  message += `• Reset ${result.deletedCount} bonus record(s)\n`;
  message += `• All users' weekly bonuses have been cleared\n`;
  message += `• Bonuses will start accumulating again from the next PvP event`;

  return interaction.editReply({ content: message, components: [] });
}

module.exports = { handleResetBonuses, handleResetBonusesConfirmation };