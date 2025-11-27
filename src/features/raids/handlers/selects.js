const { ObjectId } = require('mongodb');
const { buildRaidEmbed } = require('../utils/raidEmbed');
const { CLASSES } = require('../utils/formatting');

// Store temporary signup data
if (!global.raidSignupData) global.raidSignupData = new Map();

async function handleRaidSelects({ interaction, collections }) {
  const customId = interaction.customId;

  if (customId.startsWith('raid_signup_class:') || customId.startsWith('raid_signup_class2:')) {
    return handleClassSelect({ interaction, collections });
  }

  if (customId.startsWith('raid_signup_role:')) {
    return handleRoleSelect({ interaction, collections });
  }

  if (customId.startsWith('raid_signup_exp:')) {
    return handleExperienceSelect({ interaction, collections });
  }

  if (customId.startsWith('raid_signup_cp:')) {
    return handleCPSelect({ interaction, collections });
  }
}

async function handleClassSelect({ interaction, collections }) {
  const parts = interaction.customId.split(':');
  const raidIdStr = parts[1];
  const timeSlotId = parts[2];
  const userId = interaction.user.id;
  const selectedClass = interaction.values[0];

  const key = `${userId}:${raidIdStr}:${timeSlotId}`;
  let signupData = global.raidSignupData.get(key) || {
    raidId: raidIdStr,
    slotId: timeSlotId,
    class: null,
    role: null,
    experience: null,
    cp: null
  };

  signupData.class = selectedClass;

  // Get available roles for this class
  const classData = CLASSES[selectedClass];
  const availableRoles = classData ? classData.roles : [];

  // If class only has one role, auto-assign it
  if (availableRoles.length === 1) {
    signupData.role = availableRoles[0];
    global.raidSignupData.set(key, signupData);
    await updateSignupMessage(interaction, signupData, collections);
  } else {
    // Multiple roles available - let user choose
    global.raidSignupData.set(key, signupData);
    await showRoleSelection(interaction, signupData, availableRoles, collections);
  }
}

async function showRoleSelection(interaction, signupData, availableRoles, collections) {
  const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const roleEmojis = { tank: '🛡️', healer: '💚', dps: '⚔️' };
  const classWeapons = CLASSES[signupData.class]?.weapons;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗡️ Raid Signup')
    .setDescription(`You selected **${signupData.class}**${classWeapons ? ` (${classWeapons})` : ''}\n\nThis class can play multiple roles. Choose which role you'll play:`)
    .addFields([
      { 
        name: 'Class', 
        value: `${signupData.class}\n*${classWeapons || 'N/A'}*`, 
        inline: true 
      },
      { 
        name: 'Role', 
        value: '❓ Choose below', 
        inline: true 
      }
    ]);

  const roleOptions = [];
  for (const role of availableRoles) {
    const emoji = roleEmojis[role];
    const label = role.charAt(0).toUpperCase() + role.slice(1);
    roleOptions.push({
      label: label,
      value: role,
      emoji: emoji
    });
  }

  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId(`raid_signup_role:${signupData.raidId}:${signupData.slotId}`)
    .setPlaceholder('Select your role')
    .addOptions(roleOptions);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`raid_signup_cancel:${signupData.raidId}:${signupData.slotId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  await interaction.update({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(roleSelect),
      new ActionRowBuilder().addComponents(cancelButton)
    ]
  });
}

async function handleRoleSelect({ interaction, collections }) {
  const parts = interaction.customId.split(':');
  const raidIdStr = parts[1];
  const timeSlotId = parts[2];
  const userId = interaction.user.id;
  const selectedRole = interaction.values[0];

  const key = `${userId}:${raidIdStr}:${timeSlotId}`;
  let signupData = global.raidSignupData.get(key);

  if (!signupData) {
    // Check if already replied
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: '❌ Signup session expired. Please start over.',
        flags: [64]
      });
    }
    return;
  }

  signupData.role = selectedRole;
  global.raidSignupData.set(key, signupData);

  await updateSignupMessage(interaction, signupData, collections);
}

async function handleExperienceSelect({ interaction, collections }) {
  const parts = interaction.customId.split(':');
  const raidIdStr = parts[1];
  const timeSlotId = parts[2];
  const userId = interaction.user.id;
  const experience = interaction.values[0];

  const key = `${userId}:${raidIdStr}:${timeSlotId}`;
  let signupData = global.raidSignupData.get(key);

  if (!signupData) {
    return interaction.reply({
      content: '❌ Signup session expired. Please start over.',
      flags: [64]
    });
  }

  signupData.experience = experience;
  global.raidSignupData.set(key, signupData);

  await updateSignupMessage(interaction, signupData, collections);
}

async function handleCPSelect({ interaction, collections }) {
  const { raidEvents } = collections;
  const parts = interaction.customId.split(':');
  const raidIdStr = parts[1];
  const timeSlotId = parts[2];
  const userId = interaction.user.id;
  const cp = parseInt(interaction.values[0]);

  const key = `${userId}:${raidIdStr}:${timeSlotId}`;
  let signupData = global.raidSignupData.get(key);

  if (!signupData) {
    return interaction.reply({
      content: '❌ Signup session expired. Please start over.',
      flags: [64]
    });
  }

  signupData.cp = cp;
  global.raidSignupData.set(key, signupData);

  // Check if all fields are filled
  if (signupData.class && signupData.role && signupData.experience && signupData.cp) {
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

    const slot = raidEvent.timeSlots.find(s => s.id === timeSlotId);

    if (!slot) {
      return interaction.followUp({
        content: '❌ Time slot not found.',
        flags: [64]
      });
    }

    if (slot.attendees.length >= slot.maxCapacity) {
      global.raidSignupData.delete(key);
      return interaction.editReply({
        content: '❌ This time slot is now full!',
        embeds: [],
        components: []
      });
    }

    const attendee = {
      userId,
      class: signupData.class,
      role: signupData.role,
      experience: signupData.experience,
      cp: signupData.cp
    };

    await raidEvents.updateOne(
      { _id: new ObjectId(raidIdStr), 'timeSlots.id': timeSlotId },
      { $push: { 'timeSlots.$.attendees': attendee } }
    );

    global.raidSignupData.delete(key);

    await interaction.editReply({
      content: `✅ Successfully signed up as ${signupData.class} (${signupData.role}) for the raid!`,
      embeds: [],
      components: []
    });

    const updatedRaid = await raidEvents.findOne({ _id: new ObjectId(raidIdStr) });
    const { embed, components } = await buildRaidEmbed(updatedRaid, collections, interaction.client);

    try {
      const channel = await interaction.client.channels.fetch(updatedRaid.channelId);
      const message = await channel.messages.fetch(updatedRaid.messageId);
      await message.edit({
        embeds: [embed],
        components
      });
    } catch (err) {
      console.error('Error updating raid message:', err);
    }
  } else {
    await updateSignupMessage(interaction, signupData, collections);
  }
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
        name: 'Class', 
        value: signupData.class 
          ? `${signupData.class}${classWeapons ? `\n*${classWeapons}*` : ''}` 
          : '❓ Not selected', 
        inline: true 
      },
      { 
        name: 'Role', 
        value: signupData.role 
          ? `${roleEmoji} ${signupData.role.charAt(0).toUpperCase() + signupData.role.slice(1)}` 
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

module.exports = { handleRaidSelects };