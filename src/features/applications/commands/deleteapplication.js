const {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

async function handleDeleteApplication({ interaction, collections }) {
  const { applicationPanels } = collections;

  await interaction.deferReply({ ephemeral: true });

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
    .setCustomId('app_delete_select_panel')
    .setPlaceholder('Select panel to delete')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.editReply({
    content: '🗑️ **Select an application panel to delete:**\n⚠️ This will not delete existing tickets.',
    components: [row]
  });
}

async function handleDeleteConfirm({ interaction, collections }) {
  const { applicationPanels } = collections;

  const panelId = interaction.customId.split(':')[1];

  await interaction.deferUpdate();

  const panel = await applicationPanels.findOne({ _id: new (require('mongodb').ObjectId)(panelId) });
  if (!panel) {
    return interaction.followUp({
      content: '❌ Panel not found!',
      ephemeral: true
    });
  }

  // Delete the message if it still exists
  try {
    const channel = interaction.guild.channels.cache.get(panel.channelId);
    if (channel) {
      const message = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (message) {
        await message.delete();
      }
    }
  } catch (err) {
    console.error('Failed to delete panel message:', err);
  }

  // Mark panel as inactive
  await applicationPanels.updateOne(
    { _id: new (require('mongodb').ObjectId)(panelId) },
    { $set: { active: false, deletedAt: new Date() } }
  );

  await interaction.followUp({
    content: '✅ Application panel deleted successfully!',
    ephemeral: true
  });
}

module.exports = {
  handleDeleteApplication,
  handleDeleteConfirm
};