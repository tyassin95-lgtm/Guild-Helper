const { 
  StringSelectMenuBuilder, 
  ActionRowBuilder,
  EmbedBuilder 
} = require('discord.js');

async function handleEditApplication({ interaction, collections }) {
  const { applicationPanels } = collections;

  await interaction.deferReply({ flags: [64] });

  // Get all panels in this guild
  const panels = await applicationPanels
    .find({ guildId: interaction.guild.id, active: true })
    .toArray();

  if (panels.length === 0) {
    return interaction.editReply({
      content: '❌ No application panels found in this server!'
    });
  }

  const options = panels.map(panel => ({
    label: panel.title,
    description: `ID: ${panel._id.toString().substring(0, 8)}...`,
    value: panel._id.toString()
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('app_edit_select_panel')
    .setPlaceholder('Select panel to edit')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.editReply({
    content: '✏️ **Select an application panel to edit:**',
    components: [row]
  });
}

module.exports = { handleEditApplication };