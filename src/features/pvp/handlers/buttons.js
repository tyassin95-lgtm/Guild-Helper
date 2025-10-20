const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { ObjectId } = require('mongodb');
const { updateEventEmbed } = require('../embed');

async function handlePvPButtons({ interaction, collections }) {
  const { pvpEvents, pvpBonuses } = collections;

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

  // Record Attendance button
  if (interaction.customId.startsWith('pvp_record_attendance:')) {
    const eventId = interaction.customId.split(':')[1];

    const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return interaction.reply({ content: '❌ Event not found.', flags: [64] });
    }

    if (event.closed) {
      return interaction.reply({ content: '❌ Attendance period is closed.', flags: [64] });
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
      content: '✅ Attendance has been closed for this event.',
      flags: [64]
    });
  }
}

module.exports = { handlePvPButtons };