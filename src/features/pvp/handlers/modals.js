const { ObjectId } = require('mongodb');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { updateEventEmbed } = require('../embed');
const { scheduleLiveSummaryUpdate } = require('../../../bot/liveSummary');

async function handlePvPModals({ interaction, collections }) {
  const { pvpEvents, pvpBonuses } = collections;

  // Location input modal (for Riftstone/Boonstone)
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
      return interaction.editReply({ content: '❌ Attendance period is closed.' });
    }

    if (event.attendees && event.attendees.includes(interaction.user.id)) {
      return interaction.editReply({ content: '❌ You\'ve already recorded attendance for this event.' });
    }

    // Verify password
    if (enteredPassword !== event.password) {
      return interaction.editReply({ content: '❌ Incorrect password. Please try again.' });
    }

    // Add user to attendees
    await pvpEvents.updateOne(
      { _id: new ObjectId(eventId) },
      { $push: { attendees: interaction.user.id } }
    );

    // Add +10 bonus to user
    await pvpBonuses.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { 
        $inc: { bonusCount: 1 },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true }
    );

    // Update the event embed
    const updatedEvent = await pvpEvents.findOne({ _id: new ObjectId(eventId) });
    await updateEventEmbed(interaction, updatedEvent, collections);

    // Update live summary to show new bonus
    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.editReply({ 
      content: '✅ **Attendance recorded!**\n\nYou\'ve earned a +10 PvP bonus for this event!' 
    });
  }

  // Event details modal (from admin setup flow)
  if (interaction.customId.startsWith('pvp_event_details:')) {
    const [_, eventType, location] = interaction.customId.split(':');

    const eventTime = interaction.fields.getTextInputValue('event_time');
    const imageUrl = interaction.fields.getTextInputValue('image_url');
    const message = interaction.fields.getTextInputValue('message');

    await interaction.deferReply({ flags: [64] });

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
      imageUrl: imageUrl || null,
      message,
      password,
      attendees: [],
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
                 `**Attendance Code:** \`${password}\`\n\n` +
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