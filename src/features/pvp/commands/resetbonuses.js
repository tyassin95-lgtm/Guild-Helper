const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { scheduleLiveSummaryUpdate } = require('../../wishlist/liveSummary'); // UPDATED PATH

async function handleResetBonuses({ interaction, collections }) {
  const { pvpBonuses } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // Count how many users have bonuses
  const bonusCount = await pvpBonuses.countDocuments({ guildId: interaction.guildId });

  if (bonusCount === 0) {
    return interaction.reply({
      content: '❌ No PvP bonuses to reset.',
      flags: [64]
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_reset_bonuses_yes')
      .setLabel('Yes, Reset All Bonuses')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚠️'),
    new ButtonBuilder()
      .setCustomId('confirm_reset_bonuses_no')
      .setLabel('No, Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: `⚠️ **WARNING: Reset PvP Bonuses**\n\n` +
             `This will reset PvP bonuses for **${bonusCount}** user(s).\n\n` +
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

  if (interaction.customId === 'confirm_reset_bonuses_yes') {
    await interaction.deferUpdate();

    const result = await pvpBonuses.deleteMany({ guildId: interaction.guildId });

    // Update live summary to clear bonuses
    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.editReply({
      content: `✅ **PvP Bonuses Reset Complete!**\n\n` +
               `Reset bonuses for **${result.deletedCount}** user(s).`,
      components: []
    });
  }
}

module.exports = { handleResetBonuses, handleResetBonusesConfirmation };