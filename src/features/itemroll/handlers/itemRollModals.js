const { UserSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function handleItemRollModals({ interaction, collections }) {
  const { itemRolls } = collections;

  // Handle trait and duration modal submission
  if (interaction.customId.startsWith('itemroll_trait_duration_modal:')) {
    const tempId = interaction.customId.split(':')[1];
    const tempData = global.tempItemRollData?.[tempId];

    if (!tempData) {
      return interaction.reply({
        content: '❌ Setup session expired. Please start over.',
        flags: [64]
      });
    }

    const trait = interaction.fields.getTextInputValue('trait');
    const durationInput = interaction.fields.getTextInputValue('duration');

    await interaction.deferReply({ flags: [64] });

    // Validate duration
    const duration = parseInt(durationInput);
    if (isNaN(duration) || duration < 1 || duration > 999) {
      // Clean up temp data
      delete global.tempItemRollData[tempId];
      return interaction.editReply({
        content: '❌ Invalid duration. Please enter a number between 1 and 999 minutes.'
      });
    }

    // Calculate end time
    const endsAt = new Date(Date.now() + duration * 60 * 1000);

    // Update temp data with trait and duration
    global.tempItemRollData[tempId] = {
      ...tempData,
      trait,
      duration,
      endsAt,
      createdBy: interaction.user.id
    };

    // Show user selection menu
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(`itemroll_select_users:${tempId}`)
      .setPlaceholder('Select eligible users (leave empty for @everyone)')
      .setMinValues(0)
      .setMaxValues(25); // Discord limit

    const everyoneButton = new ButtonBuilder()
      .setCustomId(`itemroll_everyone:${tempId}`)
      .setLabel('Allow Everyone (@everyone)')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🌐');

    const everyoneRow = new ActionRowBuilder().addComponents(everyoneButton);
    const selectRow = new ActionRowBuilder().addComponents(userSelect);

    return interaction.editReply({
      content: '**Step 4: Select Eligible Participants**\n\n' +
               `**Item:** ${tempData.itemName}\n` +
               `**Trait:** ${trait}\n` +
               `**Duration:** ${duration} minute(s)\n\n` +
               'Choose who can roll for this item:\n' +
               '• Click "Allow Everyone" to let all members roll, OR\n' +
               '• Use the dropdown below to select specific users',
      components: [everyoneRow, selectRow]
    });
  }
}

module.exports = { handleItemRollModals };