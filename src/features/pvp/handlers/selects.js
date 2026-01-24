const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const {
  handlePartySelectForEdit,
  processAddMember,
  processRemoveMember
} = require('../eventParties/partyEditor');

async function handlePvPSelects({ interaction, collections }) {
  // Event party editing selects (NEW)
  if (interaction.customId.startsWith('event_party_select_edit:')) {
    const eventId = interaction.customId.split(':')[1];
    return handlePartySelectForEdit({ interaction, eventId, collections });
  }

  if (interaction.customId.startsWith('event_party_select_add_member:')) {
    const parts = interaction.customId.split(':');
    const eventId = parts[1];
    const partyNumber = parts[2];
    const userId = interaction.values[0];
    return processAddMember({ interaction, eventId, partyNumber: parseInt(partyNumber), userId, collections });
  }

  if (interaction.customId.startsWith('event_party_select_remove_member:')) {
    const parts = interaction.customId.split(':');
    const eventId = parts[1];
    const partyNumber = parts[2];
    const userId = interaction.values[0];
    return processRemoveMember({ interaction, eventId, partyNumber: parseInt(partyNumber), userId, collections });
  }

  // Event type selection
  if (interaction.customId === 'pvp_select_event_type') {
    const eventType = interaction.values[0];

    // If Riftstone, Boonstone, War Boss, or Guild Event, ask for location via modal
    if (eventType === 'riftstone' || eventType === 'boonstone' || eventType === 'warboss' || eventType === 'guildevent') {
      const eventNames = {
        'riftstone': 'Riftstone Fight',
        'boonstone': 'Boonstone Fight',
        'warboss': 'War Boss',
        'guildevent': 'Guild Event'
      };

      const modal = new ModalBuilder()
        .setCustomId(`pvp_location_modal:${eventType}`)
        .setTitle(`${eventNames[eventType]} Location`);

      const locationInput = new TextInputBuilder()
        .setCustomId('location')
        .setLabel('Enter Location Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Stonegard Castle, Fonos Basin, Guild Hall, etc.')
        .setRequired(true)
        .setMaxLength(100);

      const row = new ActionRowBuilder().addComponents(locationInput);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    // For Siege and Wargames, skip to event details modal (no location needed)
    return showEventDetailsModal(interaction, eventType, 'none');
  }
}

function showEventDetailsModal(interaction, eventType, location) {
  const modal = new ModalBuilder()
    .setCustomId(`pvp_event_details:${eventType}:${location}`)
    .setTitle('PvP Event Details');

  const timeInput = new TextInputBuilder()
    .setCustomId('event_time')
    .setLabel('Event Date & Time (YYYY-MM-DD HH:MM)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 2025-12-27 18:00 (24-hour format, server time)')
    .setRequired(true);

  const bonusPointsInput = new TextInputBuilder()
    .setCustomId('bonus_points')
    .setLabel('Bonus Points (for attendance)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 10, 20, 50')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(4);

  const imageInput = new TextInputBuilder()
    .setCustomId('image_url')
    .setLabel('Image URL (Optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Leave blank to use default image for event type')
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
    new ActionRowBuilder().addComponents(bonusPointsInput),
    new ActionRowBuilder().addComponents(imageInput),
    new ActionRowBuilder().addComponents(messageInput)
  );

  return interaction.showModal(modal);
}

module.exports = { handlePvPSelects, showEventDetailsModal };