const {
  handleSelectCategory,
  handleSelectRoles
} = require('./configButtons');
const { handleEditQuestionSelect } = require('./applyFlow');
const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

/**
 * Main select menu handler for application system
 */
async function handleApplicationSelects({ interaction, collections }) {
  const customId = interaction.customId;

  // Configuration selects
  if (customId === 'app_select_category') {
    return handleSelectCategory({ interaction, collections });
  }
  if (customId === 'app_select_roles') {
    return handleSelectRoles({ interaction, collections });
  }

  // Application flow selects
  if (customId === 'app_select_edit_question') {
    return handleEditQuestionSelect({ interaction, collections });
  }

  // Panel selection for editing
  if (customId === 'app_edit_select_panel') {
    return handleEditSelectPanel({ interaction, collections });
  }

  // Panel selection for deletion
  if (customId === 'app_delete_select_panel') {
    return handleDeleteSelectPanel({ interaction, collections });
  }
}

/**
 * Handle panel selection for editing
 */
async function handleEditSelectPanel({ interaction, collections }) {
  const { applicationPanels } = collections;

  const panelId = interaction.values[0];

  const panel = await applicationPanels.findOne({ 
    _id: new (require('mongodb').ObjectId)(panelId) 
  });

  if (!panel) {
    return interaction.reply({
      content: '❌ Panel not found!',
      ephemeral: true
    });
  }

  // For now, just show panel info and allow toggling active status
  // Full editing would require recreating the entire configuration flow
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_toggle_active:${panelId}`)
      .setLabel(panel.active ? 'Deactivate' : 'Activate')
      .setStyle(panel.active ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(panel.active ? '❌' : '✅')
  );

  await interaction.update({
    content: `**${panel.title}**\n\n` +
      `**Status:** ${panel.active ? '✅ Active' : '❌ Inactive'}\n` +
      `**Questions:** ${panel.questions.length}\n` +
      `**Created:** <t:${Math.floor(panel.createdAt.getTime() / 1000)}:R>\n\n` +
      `*Note: To fully edit, delete and recreate the panel.*`,
    components: [row]
  });
}

/**
 * Handle panel selection for deletion
 */
async function handleDeleteSelectPanel({ interaction, collections }) {
  const { applicationPanels } = collections;

  const panelId = interaction.values[0];

  const panel = await applicationPanels.findOne({
    _id: new (require('mongodb').ObjectId)(panelId)
  });

  if (!panel) {
    return interaction.reply({
      content: '❌ Panel not found!',
      ephemeral: true
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_delete_confirm:${panelId}`)
      .setLabel('Confirm Delete')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚠️'),
    new ButtonBuilder()
      .setCustomId('app_delete_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌')
  );

  await interaction.update({
    content: `⚠️ **Confirm deletion of "${panel.title}"?**\n\n` +
      `This will delete the panel message but will NOT affect existing tickets.`,
    components: [row]
  });
}

/**
 * Handle toggle active status
 */
async function handleToggleActive({ interaction, collections }) {
  const { applicationPanels } = collections;

  const panelId = interaction.customId.split(':')[1];

  const panel = await applicationPanels.findOne({
    _id: new (require('mongodb').ObjectId)(panelId)
  });

  if (!panel) {
    return interaction.reply({
      content: '❌ Panel not found!',
      ephemeral: true
    });
  }

  const newStatus = !panel.active;

  await applicationPanels.updateOne(
    { _id: new (require('mongodb').ObjectId)(panelId) },
    { $set: { active: newStatus } }
  );

  await interaction.update({
    content: `✅ Panel ${newStatus ? 'activated' : 'deactivated'}!`,
    components: []
  });
}

module.exports = { 
  handleApplicationSelects,
  handleToggleActive
};