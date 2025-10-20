const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

async function handlePvPSelects({ interaction, collections }) {
  // Event type selection
  if (interaction.customId === 'pvp_select_event_type') {
    const eventType = interaction.values[0];

    // If Riftstone or Boonstone, ask for location via modal
    if (eventType === 'riftstone' || eventType === 'boonstone') {
      const modal = new ModalBuilder()
        .setCustomId(`pvp_location_modal:${eventType}`)
        .setTitle(`${eventType === 'riftstone' ? 'Riftstone' : 'Boonstone'} Fight Location`);

      const locationInput = new TextInputBuilder()
        .setCustomId('location')
        .setLabel('Enter Location Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Stonegard Castle, Fonos Basin, etc.')
        .setRequired(true)
        .setMaxLength(100);

      const row = new ActionRowBuilder().addComponents(locationInput);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    // For Siege, skip to event details modal
    return showEventDetailsModal(interaction, eventType, 'none');
  }
}

function showEventDetailsModal(interaction, eventType, location) {
  const modal = new ModalBuilder()
    .setCustomId(`pvp_event_details:${eventType}:${location}`)
    .setTitle('PvP Event Details');

  const timeInput = new TextInputBuilder()
    .setCustomId('event_time')
    .setLabel('Event Time (Unix Timestamp)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 1729450800 (Use https://www.unixtimestamp.com)')
    .setRequired(true);

  const imageInput = new TextInputBuilder()
    .setCustomId('image_url')
    .setLabel('Image URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://i.imgur.com/example.png')
    .setRequired(false);

  const messageInput = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Event Message')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter details about the event...')
    .setRequired(true)
    .setMaxLength(2000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(timeInput),
    new ActionRowBuilder().addComponents(imageInput),
    new ActionRowBuilder().addComponents(messageInput)
  );

  return interaction.showModal(modal);
}

module.exports = { handlePvPSelects, showEventDetailsModal };