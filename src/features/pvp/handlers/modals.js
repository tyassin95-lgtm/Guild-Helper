const { ObjectId } = require('mongodb');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { updateEventEmbed } = require('../embed');
const { updateCalendar } = require('../calendar/calendarUpdate');

// Default event images
const DEFAULT_EVENT_IMAGES = {
  siege: 'https://i.imgur.com/GVJjTpu.jpeg',
  riftstone: 'https://i.imgur.com/3izMckr.jpeg',
  boonstone: 'https://i.imgur.com/puSQ5lu.jpeg',
  wargames: 'https://i.imgur.com/qtY18tv.jpeg',
  warboss: 'https://i.imgur.com/hsvWdXJ.png',
  guildevent: 'https://i.imgur.com/RLVX4iT.jpeg'
};

/**
 * Parse user-friendly date/time input into a Date object
 * Accepts formats like: "2025-12-27 18:00" or "2025-12-27 6:00 PM"
 */
function parseEventTime(timeInput) {
  // Remove extra whitespace
  timeInput = timeInput.trim();

  // Try to parse as "YYYY-MM-DD HH:MM" format (24-hour)
  const dateTimeRegex = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/;
  const match = timeInput.match(dateTimeRegex);

  if (match) {
    const [_, year, month, day, hour, minute] = match;
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1, // JavaScript months are 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      0, // seconds
      0  // milliseconds
    );

    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try parsing as ISO format as fallback
  const isoDate = new Date(timeInput);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try parsing as Unix timestamp as fallback
  const timestamp = parseInt(timeInput);
  if (!isNaN(timestamp)) {
    return new Date(timestamp * 1000);
  }

  return null;
}

async function handlePvPModals({ interaction, collections }) {
  const { pvpEvents, pvpBonuses, pvpActivityRanking } = collections;

  // Location input modal (for Riftstone/Boonstone/War Boss/Guild Event)
  if (interaction.customId.startsWith('pvp_location_modal:')) {
    const eventType = interaction.customId.split(':')[1];
    const location = interaction.fields.getTextInputValue('location');

    // Store location temporarily and show button to continue
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp_continue_setup:${eventType}:${location}`)
        .setLabel('Continue to Event Details')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('➡️')
    );

    return interaction.reply({
      content: `✅ **Location set:** ${location}\n\nClick the button below to continue with event details.`,
      components: [row],
      flags: [64]
    });
  }

  // Password verification modal
  if (interaction.customId.startsWith('pvp_password_modal:')) {
    const eventId = interaction.customId.split(':')[1];
    const enteredPassword = interaction.fields.getTextInputValue('password');

    await interaction.deferReply({ flags: [64] });

    const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return interaction.editReply({ content: '❌ Event not found.' });
    }

    if (event.closed) {
      return interaction.editReply({ content: '❌ Event is closed.' });
    }

    // Verify password first (before checking attendance to save a DB query)
    if (enteredPassword !== event.password) {
      return interaction.editReply({ content: '❌ Incorrect password. Please try again.' });
    }

    // Get the bonus points for this event
    const bonusPoints = event.bonusPoints || 10;

    // Use atomic operation to add user to attendees (prevents race conditions)
    const updateResult = await pvpEvents.updateOne(
      { 
        _id: new ObjectId(eventId),
        attendees: { $ne: interaction.user.id },
        closed: false
      },
      { 
        $push: { attendees: interaction.user.id },
        $pull: {
          rsvpAttending: interaction.user.id,
          rsvpNotAttending: interaction.user.id,
          rsvpMaybe: interaction.user.id
        }
      }
    );

    // If matchedCount is 0, either the user already recorded attendance or event was closed
    if (updateResult.matchedCount === 0) {
      const currentEvent = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

      if (!currentEvent) {
        return interaction.editReply({ content: '❌ Event not found.' });
      }

      if (currentEvent.closed) {
        return interaction.editReply({ content: '❌ Event is closed.' });
      }

      if (currentEvent.attendees && currentEvent.attendees.includes(interaction.user.id)) {
        return interaction.editReply({ content: '❌ You\'ve already recorded attendance for this event.' });
      }

      return interaction.editReply({ content: '❌ Unable to record attendance. Please try again.' });
    }

    // Add bonus points to user (weekly bonus - can be reset)
    await pvpBonuses.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { 
        $inc: { bonusCount: bonusPoints },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true }
    );

    // Increment all-time activity ranking (permanent - never reset)
    await pvpActivityRanking.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { 
        $inc: { totalEvents: 1 },
        $set: { lastEventDate: new Date() }
      },
      { upsert: true }
    );

    // Update the event embed
    const updatedEvent = await pvpEvents.findOne({ _id: new ObjectId(eventId) });
    await updateEventEmbed(interaction, updatedEvent, collections);

    return interaction.editReply({ 
      content: `✅ **Attendance recorded!**\n\nYou've earned **+${bonusPoints}** PvP bonus points for this event!` 
    });
  }

  // Manual attendance modal (admin only)
  if (interaction.customId.startsWith('pvp_manual_attendance_modal:')) {
    const eventId = interaction.customId.split(':')[1];
    const userIdInput = interaction.fields.getTextInputValue('user_id');

    await interaction.deferReply({ flags: [64] });

    const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return interaction.editReply({ content: '❌ Event not found.' });
    }

    if (!event.closed) {
      return interaction.editReply({ content: '❌ This feature is only available for closed events.' });
    }

    // Get the bonus points for this event
    const bonusPoints = event.bonusPoints || 10;

    // Validate user ID
    const userId = userIdInput.trim();

    // Try to fetch the user to ensure they exist
    try {
      const member = await interaction.guild.members.fetch(userId);

      if (!member) {
        return interaction.editReply({ content: '❌ User not found in this server.' });
      }

      // Check if user already has attendance recorded
      if (event.attendees && event.attendees.includes(userId)) {
        return interaction.editReply({ content: `❌ ${member.displayName} already has attendance recorded for this event.` });
      }

      // Add attendance for the user
      await pvpEvents.updateOne(
        { _id: new ObjectId(eventId) },
        { 
          $push: { attendees: userId },
          $pull: {
            rsvpAttending: userId,
            rsvpNotAttending: userId,
            rsvpMaybe: userId
          }
        }
      );

      // Add bonus points to user (weekly bonus - can be reset)
      await pvpBonuses.updateOne(
        { userId: userId, guildId: interaction.guildId },
        { 
          $inc: { bonusCount: bonusPoints },
          $set: { lastUpdated: new Date() }
        },
        { upsert: true }
      );

      // Increment all-time activity ranking (permanent - never reset)
      await pvpActivityRanking.updateOne(
        { userId: userId, guildId: interaction.guildId },
        { 
          $inc: { totalEvents: 1 },
          $set: { lastEventDate: new Date() }
        },
        { upsert: true }
      );

      // Update the event embed
      const updatedEvent = await pvpEvents.findOne({ _id: new ObjectId(eventId) });
      await updateEventEmbed(interaction, updatedEvent, collections);

      return interaction.editReply({ 
        content: `✅ **Attendance manually recorded for ${member.displayName}!**\n\nThey've been awarded **+${bonusPoints}** PvP bonus points.` 
      });

    } catch (err) {
      console.error('Failed to fetch user for manual attendance:', err);
      return interaction.editReply({ content: '❌ Invalid User ID or user not found in this server.' });
    }
  }

  // Event details modal (from admin setup flow)
  if (interaction.customId.startsWith('pvp_event_details:')) {
    const parts = interaction.customId.split(':');
    const eventType = parts[1];
    const location = parts.slice(2).join(':'); // Rejoin in case location has colons

    const eventTimeInput = interaction.fields.getTextInputValue('event_time');
    const bonusPointsInput = interaction.fields.getTextInputValue('bonus_points');
    const imageUrlInput = interaction.fields.getTextInputValue('image_url').trim();
    const message = interaction.fields.getTextInputValue('message');

    await interaction.deferReply({ flags: [64] });

    // Validate bonus points
    const bonusPoints = parseInt(bonusPointsInput);
    if (isNaN(bonusPoints) || bonusPoints < 1 || bonusPoints > 9999) {
      return interaction.editReply({
        content: '❌ Invalid bonus points. Please enter a number between 1 and 9999.'
      });
    }

    // Parse the time input with improved parsing
    const eventDate = parseEventTime(eventTimeInput);

    if (!eventDate || isNaN(eventDate.getTime())) {
      return interaction.editReply({
        content: '❌ Invalid date/time format. Please use the format: **YYYY-MM-DD HH:MM**\n\n' +
                 'Examples:\n' +
                 '• `2025-12-27 18:00` (6:00 PM)\n' +
                 '• `2025-12-31 09:30` (9:30 AM)\n' +
                 '• `2026-01-15 20:45` (8:45 PM)'
      });
    }

    // Check if date is in the past
    if (eventDate < new Date()) {
      return interaction.editReply({
        content: '⚠️ Warning: The event time you entered is in the past. Please double-check the date and time.\n\n' +
                 'If this is intentional, please re-run the command with a future date.'
      });
    }

    // Determine image URL - use custom if provided, otherwise use default for event type
    const imageUrl = (imageUrlInput && imageUrlInput.length > 0) 
      ? imageUrlInput 
      : DEFAULT_EVENT_IMAGES[eventType];

    // Generate 4-digit password
    const password = Math.floor(1000 + Math.random() * 9000).toString();

    // Create event in database
    const event = {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      eventType,
      location: location !== 'none' ? location : null,
      eventTime: eventDate,
      bonusPoints,
      imageUrl,
      message,
      password,
      attendees: [],
      rsvpAttending: [],
      rsvpNotAttending: [],
      rsvpMaybe: [],
      closed: false,
      createdBy: interaction.user.id,
      createdAt: new Date()
    };

    const result = await pvpEvents.insertOne(event);
    event._id = result.insertedId;

    // Send password to admin via DM
    try {
      await interaction.user.send({
        content: `🔐 **PvP Event Password**\n\n` +
                 `Your event has been created!\n\n` +
                 `**Attendance Code:** \`${password}\`\n` +
                 `**Bonus Points:** ${bonusPoints}\n\n` +
                 `Share this code with participants to record their attendance.`
      });
    } catch (err) {
      console.error('Failed to send password DM:', err);
      return interaction.editReply({
        content: '❌ Failed to send you the attendance code via DM. Please enable DMs from server members.'
      });
    }

    // Create the event embed
    const { createEventEmbed } = require('../embed');
    const { embed, components } = await createEventEmbed(event, interaction.client, collections);

    const eventMessage = await interaction.channel.send({
      content: '@everyone',
      embeds: [embed],
      components,
      allowedMentions: { parse: ['everyone'] }
    });

    // Save message ID
    await pvpEvents.updateOne(
      { _id: event._id },
      { $set: { messageId: eventMessage.id } }
    );

    // Update calendar asynchronously (don't block the response - auto-update will handle it)
    updateCalendar(interaction.client, interaction.guildId, collections).catch(err => 
      console.error('Failed to update calendar after creating event:', err)
    );

    return interaction.editReply({
      content: '✅ **PvP Event created successfully!**\n\n' +
               '📨 The attendance code has been sent to your DMs.\n' +
               `🔗 [View Event](${eventMessage.url})`
    });
  }
}

module.exports = { handlePvPModals };