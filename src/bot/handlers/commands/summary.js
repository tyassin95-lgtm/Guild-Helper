const { PermissionFlagsBits } = require('discord.js');
const { buildSummaryEmbedsAndControls } = require('../../summaryBuilder');

async function handleSummary({ interaction, collections }) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to view summaries.', flags: [64] });
  }

  await interaction.deferReply();
  const { embeds, components } = await buildSummaryEmbedsAndControls(interaction, collections);
  return interaction.editReply({ embeds, components });
}

module.exports = { handleSummary };
