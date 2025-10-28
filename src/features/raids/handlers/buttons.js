const { buildRaidEmbed } = require('../utils/raidEmbed');
const { ObjectId } = require('mongodb');

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
}

async function handleAddTimeButton({ interaction, collections }) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

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
      active: true
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

  await interaction.deferUpdate();

  let raidEvent;
  try {
    raidEvent = await raidEvents.findOne({ 
      _id: new ObjectId(raidIdStr), 
      guildId: interaction.guildId 
    });
  } catch (err) {
    console.error('Error parsing ObjectId:', err);
    console.error('Raid ID string:', raidIdStr);
    console.error('Full customId:', interaction.customId);
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

  const slot = raidEvent.timeSlots.find(s => s.id === timeSlotId);

  if (!slot) {
    return interaction.followUp({
      content: '❌ Time slot not found.',
      flags: [64]
    });
  }

  const isJoined = slot.attendees.includes(userId);

  if (isJoined) {
    // Leave this slot
    await raidEvents.updateOne(
      { _id: new ObjectId(raidIdStr), 'timeSlots.id': timeSlotId },
      { $pull: { 'timeSlots.$.attendees': userId } }
    );
  } else {
    // Check capacity
    if (slot.attendees.length >= slot.maxCapacity) {
      return interaction.followUp({
        content: '❌ This time slot is full!',
        flags: [64]
      });
    }

    // Join this slot
    await raidEvents.updateOne(
      { _id: new ObjectId(raidIdStr), 'timeSlots.id': timeSlotId },
      { $addToSet: { 'timeSlots.$.attendees': userId } }
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
      { $pull: { 'timeSlots.$.attendees': userId } }
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

module.exports = { handleRaidButtons };