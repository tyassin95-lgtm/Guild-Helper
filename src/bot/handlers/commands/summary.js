const { PermissionFlagsBits } = require('discord.js');
const { buildSummaryEmbedsAndControls } = require('../../summaryBuilder');

async function handleSummary({ interaction, collections }) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to view summaries.', flags: [64] });
  }

  await interaction.deferReply();

  const { messages } = await buildSummaryEmbedsAndControls(interaction, collections);

  // Send first message as reply
  if (messages.length > 0) {
    await interaction.editReply({ 
      embeds: messages[0].embeds, 
      components: messages[0].components 
    });

    // Send remaining messages as followups
    for (let i = 1; i < messages.length; i++) {
      await interaction.followUp({ 
        embeds: messages[i].embeds, 
        components: messages[i].components 
      });
    }
  } else {
    await interaction.editReply({ content: '❌ No summary data available.' });
  }
}

module.exports = { handleSummary };