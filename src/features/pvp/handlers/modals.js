const { ObjectId } = require('mongodb');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { updateEventEmbed } = require('../embed');

async function handlePvPModals({ interaction, collections }) {
  const { pvpEvents, pvpBonuses, pvpActivityRanking } = collections;

  // Location input modal (for Riftstone/Boonstone/Guild Event)
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
    const [_, eventType, location] = interaction.customId.split(':');

    const eventTime = interaction.fields.getTextInputValue('event_time');
    const bonusPointsInput = interaction.fields.getTextInputValue('bonus_points');
    const imageUrl = interaction.fields.getTextInputValue('image_url').trim();
    const message = interaction.fields.getTextInputValue('message');

    await interaction.deferReply({ flags: [64] });

    // Validate bonus points
    const bonusPoints = parseInt(bonusPointsInput);
    if (isNaN(bonusPoints) || bonusPoints < 1 || bonusPoints > 9999) {
      return interaction.editReply({
        content: '❌ Invalid bonus points. Please enter a number between 1 and 9999.'
      });
    }

    // Parse the time input (expecting ISO format or timestamp)
    let eventDate;
    try {
      // Try parsing as timestamp first
      const timestamp = parseInt(eventTime);
      if (!isNaN(timestamp)) {
        eventDate = new Date(timestamp * 1000);
      } else {
        // Try parsing as ISO date
        eventDate = new Date(eventTime);
      }

      if (isNaN(eventDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (err) {
      return interaction.editReply({
        content: '❌ Invalid date/time format. Please use a Unix timestamp or ISO format (e.g., 2025-10-20T18:00:00Z).'
      });
    }

    // Generate 4-digit password
    const password = Math.floor(1000 + Math.random() * 9000).toString();

    // Create event in database
    const event = {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      eventType,
      location: location !== 'none' ? location : null,
      eventTime: eventDate,
      bonusPoints, // Store the custom bonus points
      imageUrl: (imageUrl && imageUrl.length > 0) ? imageUrl : null,
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

    return interaction.editReply({
      content: '✅ **PvP Event created successfully!**\n\n' +
               '📨 The attendance code has been sent to your DMs.\n' +
               `🔗 [View Event](${eventMessage.url})`
    });
  }
}

module.exports = { handlePvPModals };