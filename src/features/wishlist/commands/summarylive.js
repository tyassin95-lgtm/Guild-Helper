const { PermissionFlagsBits } = require('discord.js');
const { createOrUpdateLiveSummaryPanel, clearLiveSummaryPanel } = require('../liveSummary');

async function handleSummaryLive({ interaction, collections }) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const action = interaction.options.getString('action');

  if (action === 'set') {
    try {
      await interaction.deferReply({ flags: [64] });
      const res = await createOrUpdateLiveSummaryPanel(interaction, collections, interaction.channel.id);
      return interaction.editReply(`📌 Live summary panel is set for **#${interaction.channel.name}**.\n➡️ [Open panel message](${res.url})`);
    } catch (err) {
      console.error('/summarylive set error:', err);
      return interaction.editReply({
        content: `❌ Could not set live summary here.\nReason: ${err.message || 'unknown error'}`,
      });
    }
  }

  if (action === 'clear') {
    await interaction.deferReply({ flags: [64] });
    const removed = await clearLiveSummaryPanel(interaction, collections);
    return interaction.editReply(removed ? '🧹 Live summary panel cleared.' : 'ℹ️ No live panel found for this server.');
  }

  return interaction.reply({ content: 'Unknown action.', flags: [64] });
}

module.exports = { handleSummaryLive };