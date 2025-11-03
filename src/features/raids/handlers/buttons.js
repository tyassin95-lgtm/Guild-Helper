const { buildRaidEmbed } = require('../utils/raidEmbed');
const { ObjectId } = require('mongodb');
const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  ModalBuilder, 
  StringSelectMenuBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');

async function handleRaidButtons({ interaction, collections }) {
  const { raidEvents, partyPlayers } = collections;
  const customId = interaction.customId;

  // Handle temp raid setup buttons
  if (customId.startsWith('raid_add_time:')) {
    return handleAddTimeButton({ interaction, collections });
  }

  if (customId.startsWith('raid_finish:')) {
    return handleFinishButton({ interaction, collections });
  }

  if (customId.startsWith('raid_cancel:')) {
    return handleCancelButton({ interaction, collections });
  }

  // Handle join/leave buttons on posted raids
  if (customId.startsWith('raid_join:')) {
    return handleJoinButton({ interaction, collections });
  }

  if (customId.startsWith('raid_leave_all:')) {
    return handleLeaveAllButton({ interaction, collections });
  }

  if (customId.startsWith('raid_delete_confirm:')) {
    const { handleDeleteConfirm } = require('../commands/deleteraid');
    return handleDeleteConfirm({ interaction, collections });
  }

  if (customId.startsWith('raid_close:')) {
    return handleCloseButton({ interaction, collections });
  }

  if (customId.startsWith('raid_signup_cancel:')) {
    return interaction.update({
      content: '❌ Signup cancelled.',
      embeds: [],
      components: []
    });
  }
}

async function handleAddTimeButton({ interaction, collections }) {
  const tempRaidId = interaction.customId.split(':')[1];

  const modal = new ModalBuilder()
    .setCustomId(`raid_add_time_modal:${tempRaidId}`)
    .setTitle('Add Time Slot');

  const dateTimeInput = new TextInputBuilder()
    .setCustomId('datetime')
    .setLabel('Date & Time (YYYY-MM-DD HH:MM)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 2025-11-01 19:00')
    .setRequired(true);

  const capacityInput = new TextInputBuilder()
    .setCustomId('capacity')
    .setLabel('Max Capacity')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 40')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(dateTimeInput),
    new ActionRowBuilder().addComponents(capacityInput)
  );

  await interaction.showModal(modal);
}

async function handleFinishButton({ interaction, collections }) {
  const { raidEvents } = collections;

  const tempRaidId = interaction.customId.split(':')[1];

  if (!global.tempRaids || !global.tempRaids.has(tempRaidId)) {
    return interaction.reply({
      content: '❌ Raid setup expired. Please start over.',
      flags: [64]
    });
  }

  const tempRaid = global.tempRaids.get(tempRaidId);

  if (tempRaid.timeSlots.length === 0) {
    return interaction.reply({
      content: '❌ You must add at least one time slot!',
      flags: [64]
    });
  }

  // Reply first to prevent "error occurred" message
  await interaction.update({
    content: '⏳ Creating raid event...',
    embeds: [],
    components: []
  });

  try {
    // Get the actual channel where the raid should be posted
    const channel = await interaction.client.channels.fetch(tempRaid.channelId);

    // Save to database first to get the _id
    const raidEvent = {
      ...tempRaid,
      messageId: 'placeholder', // Temporary placeholder
      createdAt: new Date(),
      active: true,
      closed: false // New field to track if raid is closed
    };

    const result = await raidEvents.insertOne(raidEvent);
    raidEvent._id = result.insertedId;

    // Now build the embed with the real _id
    const { embed, components } = await buildRaidEmbed(raidEvent, collections, interaction.client);

    // Post with @everyone mention
    const message = await channel.send({
      content: '@everyone',
      embeds: [embed],
      components
    });

    // Update the database with the actual messageId
    await raidEvents.updateOne(
      { _id: result.insertedId },
      { $set: { messageId: message.id } }
    );

    // Clean up temp data
    global.tempRaids.delete(tempRaidId);

    // Update the setup message
    await interaction.followUp({
      content: '✅ Raid event posted successfully!',
      flags: [64]
    });
  } catch (err) {
    console.error('Error creating raid:', err);
    await interaction.editReply({
      content: '❌ Failed to create raid event. Please try again.'
    });
  }
}

async function handleCancelButton({ interaction, collections }) {
  const tempRaidId = interaction.customId.split(':')[1];

  if (global.tempRaids) {
    global.tempRaids.delete(tempRaidId);
  }

  await interaction.update({
    content: '❌ Raid event creation cancelled.',
    embeds: [],
    components: []
  });
}

async function handleJoinButton({ interaction, collections }) {
  const { raidEvents } = collections;

  // Parse customId: raid_join:OBJECTID:TIMESTAMP
  const parts = interaction.customId.split(':');
  const raidIdStr = parts[1];
  const timeSlotId = parts[2];
  const userId = interaction.user.id;

  let raidEvent;
  try {
    raidEvent = await raidEvents.findOne({ 
      _id: new ObjectId(raidIdStr), 
      guildId: interaction.guildId 
    });
  } catch (err) {
    console.error('Error parsing ObjectId:', err);
    return interaction.reply({
      content: '❌ Invalid raid event ID.',
      flags: [64]
    });
  }

  if (!raidEvent) {
    return interaction.reply({
      content: '❌ Raid event not found.',
      flags: [64]
    });
  }

  // Check if raid is closed
  if (raidEvent.closed) {
    return interaction.reply({
      content: '❌ This raid event is closed and no longer accepting signups.',
      flags: [64]
    });
  }

  const slot = raidEvent.timeSlots.find(s => s.id === timeSlotId);

  if (!slot) {
    return interaction.reply({
      content: '❌ Time slot not found.',
      flags: [64]
    });
  }

  // Check if user is already signed up
  const existingAttendee = slot.attendees.find(a => a.userId === userId);

  if (existingAttendee) {
    // User wants to leave - remove them
    await raidEvents.updateOne(
      { _id: new ObjectId(raidIdStr), 'timeSlots.id': timeSlotId },
      { $pull: { 'timeSlots.$.attendees': { userId } } }
    );

    await interaction.deferUpdate();

    // Refresh and update the embed
    const updatedRaid = await raidEvents.findOne({ _id: new ObjectId(raidIdStr) });
    const { embed, components } = await buildRaidEmbed(updatedRaid, collections, interaction.client);

    await interaction.editReply({
      embeds: [embed],
      components
    });

    return;
  }

  // Check capacity
  if (slot.attendees.length >= slot.maxCapacity) {
    return interaction.reply({
      content: '❌ This time slot is full!',
      flags: [64]
    });
  }

  // Show signup form with select menus
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗡️ Raid Signup')
    .setDescription('Please select your role, experience level, and combat power range to sign up for this raid time slot.');

  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId(`raid_signup_role:${raidIdStr}:${timeSlotId}`)
    .setPlaceholder('Select your role')
    .addOptions([
      {
        label: 'Tank',
        description: 'Front-line defender',
        value: 'tank',
        emoji: '🛡️'
      },
      {
        label: 'Healer',
        description: 'Support and healing',
        value: 'healer',
        emoji: '💚'
      },
      {
        label: 'DPS',
        description: 'Damage dealer',
        value: 'dps',
        emoji: '⚔️'
      }
    ]);

  const experienceSelect = new StringSelectMenuBuilder()
    .setCustomId(`raid_signup_exp:${raidIdStr}:${timeSlotId}`)
    .setPlaceholder('Select your experience level')
    .addOptions([
      {
        label: 'Experienced',
        description: 'Know mechanics and strategies',
        value: 'experienced',
        emoji: '⭐'
      },
      {
        label: 'Learning',
        description: 'New or still learning',
        value: 'learning',
        emoji: '📚'
      }
    ]);

  const cpSelect = new StringSelectMenuBuilder()
    .setCustomId(`raid_signup_cp:${raidIdStr}:${timeSlotId}`)
    .setPlaceholder('Select your combat power range')
    .addOptions([
      { label: '8000+ CP', value: '8000', emoji: '🔥' },
      { label: '7750-7999 CP', value: '7875', emoji: '💎' },
      { label: '7500-7749 CP', value: '7625', emoji: '👑' },
      { label: '7250-7499 CP', value: '7375', emoji: '💪' },
      { label: '7000-7249 CP', value: '7125', emoji: '⚡' },
      { label: '6750-6999 CP', value: '6875', emoji: '✨' },
      { label: '6500-6749 CP', value: '6625', emoji: '💫' },
      { label: '6250-6499 CP', value: '6375', emoji: '🌟' },
      { label: '6000-6249 CP', value: '6125', emoji: '⭐' },
      { label: 'Under 6000 CP', value: '5500', emoji: '📈' }
    ]);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`raid_signup_cancel:${raidIdStr}:${timeSlotId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  await interaction.reply({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(roleSelect),
      new ActionRowBuilder().addComponents(experienceSelect),
      new ActionRowBuilder().addComponents(cpSelect),
      new ActionRowBuilder().addComponents(cancelButton)
    ],
    flags: [64] // Ephemeral
  });
}

async function handleLeaveAllButton({ interaction, collections }) {
  const { raidEvents } = collections;

  const raidIdStr = interaction.customId.split(':')[1];
  const userId = interaction.user.id;

  await interaction.deferUpdate();

  let raidEvent;
  try {
    raidEvent = await raidEvents.findOne({ 
      _id: new ObjectId(raidIdStr), 
      guildId: interaction.guildId 
    });
  } catch (err) {
    console.error('Error parsing ObjectId:', err);
    return interaction.followUp({
      content: '❌ Invalid raid event ID.',
      flags: [64]
    });
  }

  if (!raidEvent) {
    return interaction.followUp({
      content: '❌ Raid event not found.',
      flags: [64]
    });
  }

  // Remove user from all time slots
  for (const slot of raidEvent.timeSlots) {
    await raidEvents.updateOne(
      { _id: new ObjectId(raidIdStr), 'timeSlots.id': slot.id },
      { $pull: { 'timeSlots.$.attendees': { userId } } }
    );
  }

  // Refresh and update the embed
  const updatedRaid = await raidEvents.findOne({ _id: new ObjectId(raidIdStr) });
  const { embed, components } = await buildRaidEmbed(updatedRaid, collections, interaction.client);

  await interaction.editReply({
    embeds: [embed],
    components
  });
}

async function handleCloseButton({ interaction, collections }) {
  const { raidEvents } = collections;

  const raidIdStr = interaction.customId.split(':')[1];

  await interaction.deferUpdate();

  let raidEvent;
  try {
    raidEvent = await raidEvents.findOne({ 
      _id: new ObjectId(raidIdStr), 
      guildId: interaction.guildId 
    });
  } catch (err) {
    console.error('Error parsing ObjectId:', err);
    return interaction.followUp({
      content: '❌ Invalid raid event ID.',
      flags: [64]
    });
  }

  if (!raidEvent) {
    return interaction.followUp({
      content: '❌ Raid event not found.',
      flags: [64]
    });
  }

  // Toggle closed status
  const newClosedStatus = !raidEvent.closed;

  await raidEvents.updateOne(
    { _id: new ObjectId(raidIdStr) },
    { $set: { closed: newClosedStatus } }
  );

  // Refresh and update the embed
  const updatedRaid = await raidEvents.findOne({ _id: new ObjectId(raidIdStr) });
  const { embed, components } = await buildRaidEmbed(updatedRaid, collections, interaction.client);

  await interaction.editReply({
    embeds: [embed],
    components
  });

  await interaction.followUp({
    content: newClosedStatus ? '🔒 Raid event closed. No more signups allowed.' : '🔓 Raid event reopened for signups.',
    flags: [64]
  });
}

module.exports = { handleRaidButtons };