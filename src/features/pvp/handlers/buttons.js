const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, UserSelectMenuBuilder } = require('discord.js');
const { ObjectId } = require('mongodb');
const { updateEventEmbed, cleanupOrphanedEvent } = require('../embed');
const { updateCalendar } = require('../calendar/calendarUpdate');

async function handlePvPButtons({ interaction, collections }) {
  const { pvpEvents, pvpBonuses, guildSettings } = collections;

  // View Code button (for authorized users)
  if (interaction.customId.startsWith('pvp_view_code:')) {
    const eventId = interaction.customId.split(':')[1];
    return handleViewCode(interaction, eventId, collections);
  }

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
      return interaction.reply({ 
        content: '❌ Event not found. It may have been deleted.', 
        flags: [64] 
      });
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

    // Check if event exists
    const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return interaction.followUp({
        content: '❌ Event not found. It may have been deleted.',
        flags: [64]
      });
    }

    await pvpEvents.updateOne(
      { _id: new ObjectId(eventId) },
      { $set: { closed: true } }
    );

    const updatedEvent = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    // Update calendar asynchronously (don't block the response - auto-update will handle it)
    updateCalendar(interaction.client, interaction.guildId, collections).catch(err => 
      console.error('Failed to update calendar after closing event:', err)
    );

    // Update the embed
    await updateEventEmbed(interaction, updatedEvent, collections);

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
      return interaction.reply({ 
        content: '❌ Event not found. It may have been deleted.', 
        flags: [64] 
      });
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
 * Handle View Code button click
 * Only allows admins and users with authorized roles to view
 */
async function handleViewCode(interaction, eventId, collections) {
  const { pvpEvents, guildSettings } = collections;

  // Check if user is admin
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

  // Get authorized roles from settings
  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const authorizedRoles = settings?.pvpCodeManagers || [];

  // Check if user has any of the authorized roles
  const hasAuthorizedRole = authorizedRoles.some(roleId => 
    interaction.member.roles.cache.has(roleId)
  );

  // Deny access if user is neither admin nor has authorized role
  if (!isAdmin && !hasAuthorizedRole) {
    return interaction.reply({
      content: '❌ You do not have permission to view attendance codes.\n\n' +
               'Only administrators and users with authorized roles can view codes.\n' +
               'Ask an admin to grant you access with `/pvpcodemanagers`.',
      flags: [64]
    });
  }

  // User is authorized, fetch the event
  const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

  if (!event) {
    return interaction.reply({
      content: '❌ Event not found. It may have been deleted.',
      flags: [64]
    });
  }

  // Get event type name
  const eventTypeNames = {
    siege: 'Siege',
    riftstone: 'Riftstone Fight',
    boonstone: 'Boonstone Fight',
    wargames: 'Wargames',
    guildevent: 'Guild Event'
  };

  const typeName = eventTypeNames[event.eventType] || event.eventType;

  // Format event time
  const timestamp = Math.floor(event.eventTime.getTime() / 1000);

  // Show the code in an ephemeral message
  return interaction.reply({
    content: `🔐 **PvP Event Attendance Code**\n\n` +
             `**Event:** ${typeName}${event.location ? ` - ${event.location}` : ''}\n` +
             `**Time:** <t:${timestamp}:F>\n` +
             `**Bonus Points:** +${event.bonusPoints || 10}\n\n` +
             `**Attendance Code:** \`${event.password}\`\n\n` +
             `Share this code with participants to record their attendance.\n` +
             `${event.closed ? '⚠️ *Note: This event is closed*' : ''}`,
    flags: [64] // Ephemeral
  });
}

/**
 * Handle RSVP button clicks with automatic cleanup
 */
async function handleRSVP(interaction, eventId, rsvpType, collections) {
  const { pvpEvents } = collections;

  await interaction.deferUpdate();

  const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

  if (!event) {
    return interaction.followUp({ 
      content: '❌ Event not found. It may have been deleted.', 
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