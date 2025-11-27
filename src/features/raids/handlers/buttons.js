const { buildRaidEmbed } = require('../utils/raidEmbed');
const { ObjectId } = require('mongodb');
const { CLASSES, getClassesForRole } = require('../utils/formatting');
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

  if (customId.startsWith('raid_signup_role_select:')) {
    return handleRoleSelectButton({ interaction, collections });
  }

  if (customId.startsWith('raid_signup_class_btn:')) {
    return handleClassButton({ interaction, collections });
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

  // Show role selection first
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗡️ Raid Signup')
    .setDescription('Select your role to see available classes.');

  const roleButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`raid_signup_role_select:${raidIdStr}:${timeSlotId}:tank`)
      .setLabel('Tank')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🛡️'),
    new ButtonBuilder()
      .setCustomId(`raid_signup_role_select:${raidIdStr}:${timeSlotId}:healer`)
      .setLabel('Healer')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💚'),
    new ButtonBuilder()
      .setCustomId(`raid_signup_role_select:${raidIdStr}:${timeSlotId}:dps`)
      .setLabel('DPS')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚔️')
  );

  const cancelButton = new ButtonBuilder()
    .setCustomId(`raid_signup_cancel:${raidIdStr}:${timeSlotId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('❌');

  const cancelRow = new ActionRowBuilder().addComponents(cancelButton);

  await interaction.reply({
    embeds: [embed],
    components: [roleButtons, cancelRow],
    flags: [64]
  });
}

async function handleRoleSelectButton({ interaction, collections }) {
  const parts = interaction.customId.split(':');
  const raidIdStr = parts[1];
  const timeSlotId = parts[2];
  const selectedRole = parts[3]; // tank, healer, or dps
  const userId = interaction.user.id;

  // Initialize signup data
  const key = `${userId}:${raidIdStr}:${timeSlotId}`;
  if (!global.raidSignupData) global.raidSignupData = new Map();

  let signupData = {
    raidId: raidIdStr,
    slotId: timeSlotId,
    class: null,
    role: selectedRole, // Role is already determined
    experience: null,
    cp: null
  };

  global.raidSignupData.set(key, signupData);

  // Get classes for this role
  const availableClasses = getClassesForRole(selectedRole);

  // Show class selection as buttons
  await showClassSelection(interaction, signupData, availableClasses, collections);
}

async function showClassSelection(interaction, signupData, availableClasses, collections) {
  const roleEmojis = { tank: '🛡️', healer: '💚', dps: '⚔️' };

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗡️ Raid Signup')
    .setDescription(`**Role Selected:** ${roleEmojis[signupData.role]} ${signupData.role.charAt(0).toUpperCase() + signupData.role.slice(1)}\n\nSelect your class:`)
    .setFooter({ text: 'Classes are grouped by weapon combinations' });

  // Create class buttons - max 5 per row, max 5 rows (25 buttons total)
  const classButtons = [];

  for (const className of availableClasses) {
    const classData = CLASSES[className];
    const isFlexClass = classData.roles.length > 1;

    // Create button
    const button = new ButtonBuilder()
      .setCustomId(`raid_signup_class_btn:${signupData.raidId}:${signupData.slotId}:${className}`)
      .setLabel(isFlexClass ? `${className} 🔄` : className)
      .setStyle(ButtonStyle.Secondary);

    classButtons.push(button);
  }

  // Split into rows (5 buttons per row)
  const rows = [];
  for (let i = 0; i < classButtons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(classButtons.slice(i, i + 5)));
  }

  // Add cancel button in last row
  const cancelButton = new ButtonBuilder()
    .setCustomId(`raid_signup_cancel:${signupData.raidId}:${signupData.slotId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  if (rows.length < 5) {
    const lastRow = rows[rows.length - 1];
    if (lastRow.components.length < 5) {
      lastRow.addComponents(cancelButton);
    } else {
      rows.push(new ActionRowBuilder().addComponents(cancelButton));
    }
  } else {
    // If we're at max rows, replace last button with cancel
    const lastRow = rows[rows.length - 1];
    lastRow.components[lastRow.components.length - 1] = cancelButton;
  }

  await interaction.update({
    embeds: [embed],
    components: rows
  });
}

async function handleClassButton({ interaction, collections }) {
  const parts = interaction.customId.split(':');
  const raidIdStr = parts[1];
  const timeSlotId = parts[2];
  const selectedClass = parts[3];
  const userId = interaction.user.id;

  const key = `${userId}:${raidIdStr}:${timeSlotId}`;
  let signupData = global.raidSignupData.get(key);

  if (!signupData) {
    return interaction.reply({
      content: '❌ Signup session expired. Please start over.',
      flags: [64]
    });
  }

  signupData.class = selectedClass;
  global.raidSignupData.set(key, signupData);

  // Now show experience and CP selection
  await updateSignupMessage(interaction, signupData, collections);
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

async function updateSignupMessage(interaction, signupData, collections) {
  const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const roleEmojis = { tank: '🛡️', healer: '💚', dps: '⚔️' };
  const expEmoji = { experienced: '⭐', learning: '📚' };
  const roleEmoji = signupData.role ? roleEmojis[signupData.role] : '❓';
  const classWeapons = signupData.class ? CLASSES[signupData.class]?.weapons : null;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗡️ Raid Signup')
    .setDescription('Fill in all fields to complete your signup.')
    .addFields([
      { 
        name: 'Role', 
        value: signupData.role 
          ? `${roleEmoji} ${signupData.role.charAt(0).toUpperCase() + signupData.role.slice(1)}` 
          : '❓ Not selected', 
        inline: true 
      },
      { 
        name: 'Class', 
        value: signupData.class 
          ? `${signupData.class}${classWeapons ? `\n*${classWeapons}*` : ''}` 
          : '❓ Not selected', 
        inline: true 
      },
      { 
        name: 'Experience', 
        value: signupData.experience 
          ? `${expEmoji[signupData.experience]} ${signupData.experience.charAt(0).toUpperCase() + signupData.experience.slice(1)}` 
          : '❓ Not selected', 
        inline: true 
      },
      { 
        name: 'Combat Power', 
        value: signupData.cp ? `${signupData.cp} CP` : '❓ Not selected', 
        inline: true 
      }
    ]);

  const allFilled = signupData.class && signupData.role && signupData.experience && signupData.cp;
  if (allFilled) {
    embed.setFooter({ text: '✅ All fields complete! Confirming signup...' });
  } else {
    embed.setFooter({ text: 'Please fill in all fields to complete signup' });
  }

  const experienceSelect = new StringSelectMenuBuilder()
    .setCustomId(`raid_signup_exp:${signupData.raidId}:${signupData.slotId}`)
    .setPlaceholder(signupData.experience ? `Selected: ${signupData.experience}` : 'Select your experience level')
    .addOptions([
      {
        label: 'Experienced',
        description: 'Know mechanics and strategies',
        value: 'experienced',
        emoji: '⭐',
        default: signupData.experience === 'experienced'
      },
      {
        label: 'Learning',
        description: 'New or still learning',
        value: 'learning',
        emoji: '📚',
        default: signupData.experience === 'learning'
      }
    ]);

  const cpSelect = new StringSelectMenuBuilder()
    .setCustomId(`raid_signup_cp:${signupData.raidId}:${signupData.slotId}`)
    .setPlaceholder(signupData.cp ? `Selected: ${signupData.cp} CP` : 'Select your combat power range')
    .addOptions([
      { label: '8000+ CP', value: '8000', emoji: '🔥', default: signupData.cp === 8000 },
      { label: '7750-7999 CP', value: '7875', emoji: '💎', default: signupData.cp === 7875 },
      { label: '7500-7749 CP', value: '7625', emoji: '👑', default: signupData.cp === 7625 },
      { label: '7250-7499 CP', value: '7375', emoji: '💪', default: signupData.cp === 7375 },
      { label: '7000-7249 CP', value: '7125', emoji: '⚡', default: signupData.cp === 7125 },
      { label: '6750-6999 CP', value: '6875', emoji: '✨', default: signupData.cp === 6875 },
      { label: '6500-6749 CP', value: '6625', emoji: '💫', default: signupData.cp === 6625 },
      { label: '6250-6499 CP', value: '6375', emoji: '🌟', default: signupData.cp === 6375 },
      { label: '6000-6249 CP', value: '6125', emoji: '⭐', default: signupData.cp === 6125 },
      { label: 'Under 6000 CP', value: '5500', emoji: '📈', default: signupData.cp === 5500 }
    ]);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`raid_signup_cancel:${signupData.raidId}:${signupData.slotId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(experienceSelect),
      new ActionRowBuilder().addComponents(cpSelect),
      new ActionRowBuilder().addComponents(cancelButton)
    ]
  });
}

module.exports = { handleRaidButtons };