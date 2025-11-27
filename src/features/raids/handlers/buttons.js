const { buildRaidEmbed } = require('../utils/raidEmbed');
const { ObjectId } = require('mongodb');
const { CLASSES } = require('../utils/formatting');
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

  if (customId.startsWith('raid_add_time:')) {
    return handleAddTimeButton({ interaction, collections });
  }

  if (customId.startsWith('raid_finish:')) {
    return handleFinishButton({ interaction, collections });
  }

  if (customId.startsWith('raid_cancel:')) {
    return handleCancelButton({ interaction, collections });
  }

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

  await interaction.update({
    content: '⏳ Creating raid event...',
    embeds: [],
    components: []
  });

  try {
    const channel = await interaction.client.channels.fetch(tempRaid.channelId);

    const raidEvent = {
      ...tempRaid,
      messageId: 'placeholder',
      createdAt: new Date(),
      active: true,
      closed: false
    };

    const result = await raidEvents.insertOne(raidEvent);
    raidEvent._id = result.insertedId;

    const { embed, components } = await buildRaidEmbed(raidEvent, collections, interaction.client);

    const message = await channel.send({
      content: '@everyone',
      embeds: [embed],
      components
    });

    await raidEvents.updateOne(
      { _id: result.insertedId },
      { $set: { messageId: message.id } }
    );

    global.tempRaids.delete(tempRaidId);

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

  const existingAttendee = slot.attendees.find(a => a.userId === userId);

  if (existingAttendee) {
    // User wants to leave - remove them
    await raidEvents.updateOne(
      { _id: new ObjectId(raidIdStr), 'timeSlots.id': timeSlotId },
      { $pull: { 'timeSlots.$.attendees': { userId } } }
    );

    await interaction.deferUpdate();

    const updatedRaid = await raidEvents.findOne({ _id: new ObjectId(raidIdStr) });
    const { embed, components } = await buildRaidEmbed(updatedRaid, collections, interaction.client);

    await interaction.editReply({
      embeds: [embed],
      components
    });

    return;
  }

  if (slot.attendees.length >= slot.maxCapacity) {
    return interaction.reply({
      content: '❌ This time slot is full!',
      flags: [64]
    });
  }

  // Show class selection dropdown
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗡️ Raid Signup')
    .setDescription('Select your class to continue with signup.');

  const classOptions = [];

  // Add all classes
  for (const [className, classData] of Object.entries(CLASSES)) {
    // Use first role for emoji (or show flex icon for multi-role)
    let emoji = '⚔️'; // Default to DPS
    if (classData.roles.includes('tank')) emoji = '🛡️';
    else if (classData.roles.includes('healer')) emoji = '💚';

    // For flex classes, show that they're flexible
    const isFlexClass = classData.roles.length > 1;
    const description = isFlexClass 
      ? `${classData.weapons} [Flex]` 
      : classData.weapons;

    classOptions.push({
      label: className,
      value: className,
      description: description.substring(0, 100), // Discord limit
      emoji: emoji
    });
  }

  const classSelect = new StringSelectMenuBuilder()
    .setCustomId(`raid_signup_class:${raidIdStr}:${timeSlotId}`)
    .setPlaceholder('Select your class')
    .addOptions(classOptions.slice(0, 25));

  const cancelButton = new ButtonBuilder()
    .setCustomId(`raid_signup_cancel:${raidIdStr}:${timeSlotId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  const components = [new ActionRowBuilder().addComponents(classSelect)];

  // If more than 25 classes, add second menu
  if (classOptions.length > 25) {
    const classSelect2 = new StringSelectMenuBuilder()
      .setCustomId(`raid_signup_class2:${raidIdStr}:${timeSlotId}`)
      .setPlaceholder('More classes...')
      .addOptions(classOptions.slice(25, Math.min(50, classOptions.length)));
    components.push(new ActionRowBuilder().addComponents(classSelect2));
  }

  components.push(new ActionRowBuilder().addComponents(cancelButton));

  await interaction.reply({
    embeds: [embed],
    components,
    flags: [64]
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

  for (const slot of raidEvent.timeSlots) {
    await raidEvents.updateOne(
      { _id: new ObjectId(raidIdStr), 'timeSlots.id': slot.id },
      { $pull: { 'timeSlots.$.attendees': { userId } } }
    );
  }

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

  // Check if interaction is still valid
  if (interaction.replied || interaction.deferred) {
    return;
  }

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

  const newClosedStatus = !raidEvent.closed;

  await raidEvents.updateOne(
    { _id: new ObjectId(raidIdStr) },
    { $set: { closed: newClosedStatus } }
  );

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