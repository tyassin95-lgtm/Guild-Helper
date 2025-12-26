const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
const { ObjectId } = require('mongodb');
const { updateEventEmbed } = require('../embed');

async function handlePvPButtons({ interaction, collections }) {
  const { pvpEvents, pvpBonuses } = collections;

  // RSVP Attending button
  if (interaction.customId.startsWith('pvp_rsvp_attending:')) {
    const eventId = interaction.customId.split(':')[1];
    return handleRSVP(interaction, eventId, 'attending', collections);
  }

  // RSVP Not Attending button
  if (interaction.customId.startsWith('pvp_rsvp_not_attending:')) {
    const eventId = interaction.customId.split(':')[1];
    return handleRSVP(interaction, eventId, 'not_attending', collections);
  }

  // RSVP Maybe button
  if (interaction.customId.startsWith('pvp_rsvp_maybe:')) {
    const eventId = interaction.customId.split(':')[1];
    return handleRSVP(interaction, eventId, 'maybe', collections);
  }

  // Continue setup button (after location input)
  if (interaction.customId.startsWith('pvp_continue_setup:')) {
    const parts = interaction.customId.split(':');
    const eventType = parts[1];
    const location = parts.slice(2).join(':'); // Rejoin in case location has colons

    // Show event details modal
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

  // Record Attendance button
  if (interaction.customId.startsWith('pvp_record_attendance:')) {
    const eventId = interaction.customId.split(':')[1];

    const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return interaction.reply({ content: '❌ Event not found.', flags: [64] });
    }

    if (event.closed) {
      return interaction.reply({ content: '❌ Event is closed.', flags: [64] });
    }

    // Check if user already recorded attendance
    if (event.attendees && event.attendees.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ You\'ve already recorded attendance for this event.', flags: [64] });
    }

    // Show password modal
    const modal = new ModalBuilder()
      .setCustomId(`pvp_password_modal:${eventId}`)
      .setTitle('Record Attendance');

    const passwordInput = new TextInputBuilder()
      .setCustomId('password')
      .setLabel('Enter 4-digit attendance code')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('XXXX')
      .setRequired(true)
      .setMinLength(4)
      .setMaxLength(4);

    const row = new ActionRowBuilder().addComponents(passwordInput);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  // Close Attendance button (admin only)
  if (interaction.customId.startsWith('pvp_close_attendance:')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const eventId = interaction.customId.split(':')[1];

    await interaction.deferUpdate();

    await pvpEvents.updateOne(
      { _id: new ObjectId(eventId) },
      { $set: { closed: true } }
    );

    const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    // Update the embed
    await updateEventEmbed(interaction, event, collections);

    return interaction.followUp({
      content: '✅ Event has been closed.',
      flags: [64]
    });
  }

  // Manual Attendance button (admin only, for closed events)
  if (interaction.customId.startsWith('pvp_manual_attendance:')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const eventId = interaction.customId.split(':')[1];

    const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return interaction.reply({ content: '❌ Event not found.', flags: [64] });
    }

    if (!event.closed) {
      return interaction.reply({ content: '❌ This button is only available for closed events.', flags: [64] });
    }

    // Show user select menu to choose who to add attendance for
    const modal = new ModalBuilder()
      .setCustomId(`pvp_manual_attendance_modal:${eventId}`)
      .setTitle('Manually Record Attendance');

    const userIdInput = new TextInputBuilder()
      .setCustomId('user_id')
      .setLabel('User ID to add attendance for')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter the Discord User ID')
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(userIdInput);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }
}

/**
 * Handle RSVP button clicks
 */
async function handleRSVP(interaction, eventId, rsvpType, collections) {
  const { pvpEvents } = collections;

  await interaction.deferUpdate();

  const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

  if (!event) {
    return interaction.followUp({ 
      content: '❌ Event not found.', 
      flags: [64] 
    });
  }

  if (event.closed) {
    return interaction.followUp({ 
      content: '❌ Event is closed.', 
      flags: [64] 
    });
  }

  const userId = interaction.user.id;

  // Remove user from all RSVP lists first
  await pvpEvents.updateOne(
    { _id: new ObjectId(eventId) },
    { 
      $pull: { 
        rsvpAttending: userId,
        rsvpNotAttending: userId,
        rsvpMaybe: userId
      }
    }
  );

  // Add user to the selected RSVP list
  const fieldMap = {
    'attending': 'rsvpAttending',
    'not_attending': 'rsvpNotAttending',
    'maybe': 'rsvpMaybe'
  };

  const field = fieldMap[rsvpType];

  await pvpEvents.updateOne(
    { _id: new ObjectId(eventId) },
    { $addToSet: { [field]: userId } }
  );

  // Fetch updated event and update embed
  const updatedEvent = await pvpEvents.findOne({ _id: new ObjectId(eventId) });
  await updateEventEmbed(interaction, updatedEvent, collections);

  const responseMap = {
    'attending': '✅ You marked yourself as **Attending**!',
    'not_attending': '❌ You marked yourself as **Not Attending**.',
    'maybe': '❓ You marked yourself as **Maybe**.'
  };

  return interaction.followUp({
    content: responseMap[rsvpType],
    flags: [64]
  });
}

module.exports = { handlePvPButtons };