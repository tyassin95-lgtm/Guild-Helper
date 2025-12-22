const { UserSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

async function handleItemRollModals({ interaction, collections }) {
  const { itemRolls } = collections;

  // Create item roll modal submission
  if (interaction.customId === 'itemroll_create_modal') {
    const itemName = interaction.fields.getTextInputValue('item_name');
    const trait = interaction.fields.getTextInputValue('trait');
    const imageUrl = interaction.fields.getTextInputValue('image_url').trim();
    const durationInput = interaction.fields.getTextInputValue('duration');

    await interaction.deferReply({ flags: [64] });

    // Validate duration
    const duration = parseInt(durationInput);
    if (isNaN(duration) || duration < 1 || duration > 999) {
      return interaction.editReply({
        content: '❌ Invalid duration. Please enter a number between 1 and 999 minutes.'
      });
    }

    // Calculate end time
    const endsAt = new Date(Date.now() + duration * 60 * 1000);

    // Store temporary item roll data and show user selection
    const tempData = {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      itemName,
      trait,
      imageUrl: (imageUrl && imageUrl.length > 0) ? imageUrl : null,
      duration,
      endsAt,
      createdBy: interaction.user.id
    };

    // Store in a temporary collection (we'll create the actual roll after user selection)
    global.tempItemRollData = global.tempItemRollData || {};
    const tempId = `${interaction.user.id}_${Date.now()}`;
    global.tempItemRollData[tempId] = tempData;

    // Show user selection menu
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(`itemroll_select_users:${tempId}`)
      .setPlaceholder('Select eligible users (leave empty for @everyone)')
      .setMinValues(0)
      .setMaxValues(25); // Discord limit

    const everyoneButton = new ActionRowBuilder().addComponents(
      new (require('discord.js').ButtonBuilder)()
        .setCustomId(`itemroll_everyone:${tempId}`)
        .setLabel('Allow Everyone (@everyone)')
        .setStyle(require('discord.js').ButtonStyle.Success)
        .setEmoji('🌐')
    );

    const selectRow = new ActionRowBuilder().addComponents(userSelect);

    return interaction.editReply({
      content: '**Step 2: Select Eligible Participants**\n\n' +
               'Choose who can roll for this item:\n' +
               '• Click "Allow Everyone" to let all members roll, OR\n' +
               '• Use the dropdown below to select specific users',
      components: [everyoneButton, selectRow]
    });
  }
}

module.exports = { handleItemRollModals };