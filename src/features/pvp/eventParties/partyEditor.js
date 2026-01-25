const { ObjectId } = require('mongodb');
const { 
  ActionRowBuilder, 
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits 
} = require('discord.js');
const { createPartyFormationEmbed, createPartyFormationButtons } = require('./partyFormationEmbed');
const { getRoleEmoji } = require('../../parties/roleDetection');

/**
 * Handle edit parties button click
 */
async function handleEditParties({ interaction, eventId, collections }) {
  const { eventParties, pvpEvents } = collections;

  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.update({
      content: '❌ You need administrator permissions.',
      embeds: [],
      components: []
    });
  }

  await interaction.deferUpdate();

  try {
    const formation = await eventParties.findOne({ eventId: new ObjectId(eventId) });

    if (!formation) {
      return interaction.editReply({
        content: '❌ Party formation not found.',
        embeds: [],
        components: []
      });
    }

    // Show party selection menu
    const options = formation.processedParties.map(party => ({
      label: `Party ${party.partyNumber} (${party.members.length}/6)`,
      value: `party_${party.partyNumber}`,
      description: `${party.composition.tank}T ${party.composition.healer}H ${party.composition.dps}D`,
      emoji: party.members.length === 6 ? '✅' : '⚠️'
    }));

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`event_party_select_edit:${eventId}`)
        .setPlaceholder('Select a party to edit')
        .addOptions(options)
    );

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`event_party_back_to_review:${eventId}`)
        .setLabel('Back to Review')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('◀️')
    );

    return interaction.editReply({
      content: '**Edit Parties**\n\nSelect a party to edit:',
      components: [selectRow, backRow]
    });

  } catch (error) {
    console.error('Error in edit parties:', error);
    return interaction.editReply({
      content: `❌ Error: ${error.message}`,
      embeds: [],
      components: []
    });
  }
}

/**
 * Handle party selection for editing
 */
async function handlePartySelectForEdit({ interaction, eventId, collections }) {
  const { eventParties } = collections;

  await interaction.deferUpdate();

  const partyValue = interaction.values[0];
  const partyNumber = parseInt(partyValue.split('_')[1]);

  const formation = await eventParties.findOne({ eventId: new ObjectId(eventId) });
  const party = formation.processedParties.find(p => p.partyNumber === partyNumber);

  if (!party) {
    return interaction.editReply({
      content: '❌ Party not found.',
      components: []
    });
  }

  // Show edit options for this party
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_add_member:${eventId}:${partyNumber}`)
      .setLabel('Add Members')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕')
      .setDisabled(party.members.length >= 6),
    new ButtonBuilder()
      .setCustomId(`event_party_remove_member:${eventId}:${partyNumber}`)
      .setLabel('Remove Members')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖')
      .setDisabled(party.members.length === 0)
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_back_to_edit:${eventId}`)
      .setLabel('Back to Party Selection')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
  );

  const memberList = party.members.map((m, i) => {
    const roleIcon = getRoleEmoji(m.role);
    const leaderCrown = m.isLeader ? '👑 ' : '';
    return `${i + 1}. ${roleIcon} ${leaderCrown}${m.displayName} (${m.weapon1}/${m.weapon2})`;
  }).join('\n');

  const content = 
    `**Editing Party ${partyNumber}**\n\n` +
    `**Members (${party.members.length}/6):**\n${memberList || '*No members*'}\n\n` +
    `**Composition:** ${party.composition.tank} Tank, ${party.composition.healer} Healer, ${party.composition.dps} DPS\n\n` +
    `Choose an action:`;

  return interaction.editReply({
    content,
    components: [actionRow, backRow]
  });
}

/**
 * Show party edit view directly (helper function for after add/remove)
 */
async function showPartyEditView({ interaction, eventId, partyNumber, collections }) {
  const { eventParties } = collections;

  const formation = await eventParties.findOne({ eventId: new ObjectId(eventId) });
  const party = formation.processedParties.find(p => p.partyNumber === partyNumber);

  if (!party) {
    return interaction.editReply({
      content: '❌ Party not found.',
      components: []
    });
  }

  // Show edit options for this party
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_add_member:${eventId}:${partyNumber}`)
      .setLabel('Add Members')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕')
      .setDisabled(party.members.length >= 6),
    new ButtonBuilder()
      .setCustomId(`event_party_remove_member:${eventId}:${partyNumber}`)
      .setLabel('Remove Members')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖')
      .setDisabled(party.members.length === 0)
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_back_to_edit:${eventId}`)
      .setLabel('Back to Party Selection')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
  );

  const memberList = party.members.map((m, i) => {
    const roleIcon = getRoleEmoji(m.role);
    const leaderCrown = m.isLeader ? '👑 ' : '';
    return `${i + 1}. ${roleIcon} ${leaderCrown}${m.displayName} (${m.weapon1}/${m.weapon2})`;
  }).join('\n');

  const content = 
    `**Editing Party ${partyNumber}**\n\n` +
    `**Members (${party.members.length}/6):**\n${memberList || '*No members*'}\n\n` +
    `**Composition:** ${party.composition.tank} Tank, ${party.composition.healer} Healer, ${party.composition.dps} DPS\n\n` +
    `Choose an action:`;

  return interaction.editReply({
    content,
    components: [actionRow, backRow]
  });
}

/**
 * Handle back to review button
 */
async function handleBackToReview({ interaction, eventId, collections }) {
  const { eventParties, pvpEvents } = collections;

  await interaction.deferUpdate();

  const formation = await eventParties.findOne({ eventId: new ObjectId(eventId) });
  const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

  const eventInfo = {
    eventType: event.eventType,
    location: event.location,
    eventTime: event.eventTime
  };

  const embed = createPartyFormationEmbed(
    formation.processedParties,
    formation.availableMembers,
    formation.summary,
    eventInfo
  );
  const buttons = createPartyFormationButtons(eventId);

  return interaction.editReply({
    content: null,
    embeds: [embed],
    components: [buttons]
  });
}

/**
 * Handle back to edit (party selection)
 */
async function handleBackToEdit({ interaction, eventId, collections }) {
  return handleEditParties({ interaction, eventId, collections });
}

/**
 * Handle add member to party
 */
async function handleAddMemberToParty({ interaction, eventId, partyNumber, collections }) {
  const { eventParties } = collections;

  await interaction.deferUpdate();

  const formation = await eventParties.findOne({ eventId: new ObjectId(eventId) });
  const party = formation.processedParties.find(p => p.partyNumber === partyNumber);

  if (party.members.length >= 6) {
    return interaction.editReply({
      content: '❌ Party is already full (6/6 members).',
      components: []
    });
  }

  // Get all available members
  const availableMembers = formation.availableMembers || [];

  if (availableMembers.length === 0) {
    return interaction.editReply({
      content: '❌ No available members to add.\n\nAll attending members are already in parties.',
      components: []
    });
  }

  // Calculate how many slots are available
  const availableSlots = 6 - party.members.length;
  const maxSelectable = Math.min(availableMembers.length, availableSlots, 25); // Discord limit is 25

  // Show multi-select menu
  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`event_party_select_add_member:${eventId}:${partyNumber}`)
      .setPlaceholder(`Select members to add (up to ${maxSelectable})`)
      .setMinValues(1)
      .setMaxValues(maxSelectable)
      .addOptions(
        availableMembers.slice(0, 25).map(m => ({ // Discord max 25 options
          label: m.displayName,
          value: m.userId,
          description: `${m.role} (${getRoleEmoji(m.role)}) - ${m.source || 'Available'}`,
          emoji: getRoleEmoji(m.role)
        }))
      )
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_back_to_party:${eventId}:${partyNumber}`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
  );

  return interaction.editReply({
    content: `**Add Members to Party ${partyNumber}**\n\n` +
             `**Available slots:** ${availableSlots}\n` +
             `**Available members:** ${availableMembers.length}\n\n` +
             `Select one or more members to add:`,
    components: [selectRow, backRow]
  });
}

/**
 * Handle remove member from party
 */
async function handleRemoveMemberFromParty({ interaction, eventId, partyNumber, collections }) {
  const { eventParties } = collections;

  await interaction.deferUpdate();

  const formation = await eventParties.findOne({ eventId: new ObjectId(eventId) });
  const party = formation.processedParties.find(p => p.partyNumber === partyNumber);

  if (party.members.length === 0) {
    return interaction.editReply({
      content: '❌ Party has no members to remove.',
      components: []
    });
  }

  // Allow selecting multiple members to remove (up to all of them, max 25 due to Discord)
  const maxSelectable = Math.min(party.members.length, 25);

  // Show multi-select menu
  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`event_party_select_remove_member:${eventId}:${partyNumber}`)
      .setPlaceholder(`Select members to remove (up to ${maxSelectable})`)
      .setMinValues(1)
      .setMaxValues(maxSelectable)
      .addOptions(
        party.members.slice(0, 25).map(m => ({ // Discord max 25 options
          label: m.displayName,
          value: m.userId,
          description: `${m.role} (${m.weapon1}/${m.weapon2})`,
          emoji: getRoleEmoji(m.role)
        }))
      )
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_back_to_party:${eventId}:${partyNumber}`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
  );

  return interaction.editReply({
    content: `**Remove Members from Party ${partyNumber}**\n\n` +
             `**Current members:** ${party.members.length}\n\n` +
             `Select one or more members to remove:`,
    components: [selectRow, backRow]
  });
}

/**
 * Process adding multiple members
 */
async function processAddMember({ interaction, eventId, partyNumber, userId, collections }) {
  const { eventParties } = collections;

  await interaction.deferUpdate();

  const formation = await eventParties.findOne({ eventId: new ObjectId(eventId) });
  const party = formation.processedParties.find(p => p.partyNumber === partyNumber);

  // userId is now an array (from interaction.values)
  const userIds = Array.isArray(userId) ? userId : [userId];

  const addedMembers = [];
  const failedAdds = [];

  for (const uid of userIds) {
    // Check if party is full
    if (party.members.length >= 6) {
      failedAdds.push({ userId: uid, reason: 'Party is full' });
      continue;
    }

    // Find member in available list
    const memberToAdd = formation.availableMembers.find(m => m.userId === uid);

    if (!memberToAdd) {
      failedAdds.push({ userId: uid, reason: 'Not found in available list' });
      continue;
    }

    // Add to party (remove source field)
    const { source, ...memberData } = memberToAdd;
    party.members.push(memberData);

    // Update composition
    party.composition[memberToAdd.role]++;

    // Track successful add
    addedMembers.push(memberToAdd.displayName);

    // Remove from available
    formation.availableMembers = formation.availableMembers.filter(m => m.userId !== uid);

    // Update summary
    formation.summary.membersAvailable--;
  }

  // Save to database
  await eventParties.updateOne(
    { eventId: new ObjectId(eventId) },
    {
      $set: {
        processedParties: formation.processedParties,
        availableMembers: formation.availableMembers,
        summary: formation.summary,
        lastModified: new Date()
      }
    }
  );

  // Build result message
  let resultMessage = '';
  if (addedMembers.length > 0) {
    resultMessage += `✅ **Added ${addedMembers.length} member(s):**\n`;
    resultMessage += addedMembers.map(name => `• ${name}`).join('\n');
    resultMessage += '\n\n';
  }

  if (failedAdds.length > 0) {
    resultMessage += `❌ **Failed to add ${failedAdds.length} member(s):**\n`;
    resultMessage += failedAdds.map(f => `• ${f.reason}`).join('\n');
    resultMessage += '\n\n';
  }

  // Show updated party view with result message prepended
  const updatedFormation = await eventParties.findOne({ eventId: new ObjectId(eventId) });
  const updatedParty = updatedFormation.processedParties.find(p => p.partyNumber === partyNumber);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_add_member:${eventId}:${partyNumber}`)
      .setLabel('Add Members')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕')
      .setDisabled(updatedParty.members.length >= 6),
    new ButtonBuilder()
      .setCustomId(`event_party_remove_member:${eventId}:${partyNumber}`)
      .setLabel('Remove Members')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖')
      .setDisabled(updatedParty.members.length === 0)
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_back_to_edit:${eventId}`)
      .setLabel('Back to Party Selection')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
  );

  const memberList = updatedParty.members.map((m, i) => {
    const roleIcon = getRoleEmoji(m.role);
    const leaderCrown = m.isLeader ? '👑 ' : '';
    return `${i + 1}. ${roleIcon} ${leaderCrown}${m.displayName} (${m.weapon1}/${m.weapon2})`;
  }).join('\n');

  const content = 
    resultMessage +
    `**Editing Party ${partyNumber}**\n\n` +
    `**Members (${updatedParty.members.length}/6):**\n${memberList || '*No members*'}\n\n` +
    `**Composition:** ${updatedParty.composition.tank} Tank, ${updatedParty.composition.healer} Healer, ${updatedParty.composition.dps} DPS\n\n` +
    `Choose an action:`;

  return interaction.editReply({
    content,
    components: [actionRow, backRow]
  });
}

/**
 * Process removing multiple members
 */
async function processRemoveMember({ interaction, eventId, partyNumber, userId, collections }) {
  const { eventParties } = collections;

  await interaction.deferUpdate();

  const formation = await eventParties.findOne({ eventId: new ObjectId(eventId) });
  const party = formation.processedParties.find(p => p.partyNumber === partyNumber);

  // userId is now an array (from interaction.values)
  const userIds = Array.isArray(userId) ? userId : [userId];

  const removedMembers = [];
  const failedRemoves = [];

  for (const uid of userIds) {
    // Find member in party
    const memberToRemove = party.members.find(m => m.userId === uid);

    if (!memberToRemove) {
      failedRemoves.push({ userId: uid, reason: 'Not found in party' });
      continue;
    }

    // Remove from party
    party.members = party.members.filter(m => m.userId !== uid);

    // Update composition
    party.composition[memberToRemove.role]--;

    // Track successful remove
    removedMembers.push(memberToRemove.displayName);

    // Add to available (with source)
    formation.availableMembers.push({
      ...memberToRemove,
      source: 'Manually removed'
    });

    // Update summary
    formation.summary.membersAvailable++;
  }

  // Save to database
  await eventParties.updateOne(
    { eventId: new ObjectId(eventId) },
    {
      $set: {
        processedParties: formation.processedParties,
        availableMembers: formation.availableMembers,
        summary: formation.summary,
        lastModified: new Date()
      }
    }
  );

  // Build result message
  let resultMessage = '';
  if (removedMembers.length > 0) {
    resultMessage += `✅ **Removed ${removedMembers.length} member(s):**\n`;
    resultMessage += removedMembers.map(name => `• ${name}`).join('\n');
    resultMessage += '\n\n';
  }

  if (failedRemoves.length > 0) {
    resultMessage += `❌ **Failed to remove ${failedRemoves.length} member(s):**\n`;
    resultMessage += failedRemoves.map(f => `• ${f.reason}`).join('\n');
    resultMessage += '\n\n';
  }

  // Show updated party view with result message prepended
  const updatedFormation = await eventParties.findOne({ eventId: new ObjectId(eventId) });
  const updatedParty = updatedFormation.processedParties.find(p => p.partyNumber === partyNumber);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_add_member:${eventId}:${partyNumber}`)
      .setLabel('Add Members')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕')
      .setDisabled(updatedParty.members.length >= 6),
    new ButtonBuilder()
      .setCustomId(`event_party_remove_member:${eventId}:${partyNumber}`)
      .setLabel('Remove Members')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖')
      .setDisabled(updatedParty.members.length === 0)
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_back_to_edit:${eventId}`)
      .setLabel('Back to Party Selection')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
  );

  const memberList = updatedParty.members.map((m, i) => {
    const roleIcon = getRoleEmoji(m.role);
    const leaderCrown = m.isLeader ? '👑 ' : '';
    return `${i + 1}. ${roleIcon} ${leaderCrown}${m.displayName} (${m.weapon1}/${m.weapon2})`;
  }).join('\n');

  const content = 
    resultMessage +
    `**Editing Party ${partyNumber}**\n\n` +
    `**Members (${updatedParty.members.length}/6):**\n${memberList || '*No members*'}\n\n` +
    `**Composition:** ${updatedParty.composition.tank} Tank, ${updatedParty.composition.healer} Healer, ${updatedParty.composition.dps} DPS\n\n` +
    `Choose an action:`;

  return interaction.editReply({
    content,
    components: [actionRow, backRow]
  });
}

/**
 * Handle back to specific party view
 */
async function handleBackToParty({ interaction, eventId, partyNumber, collections }) {
  await interaction.deferUpdate();
  return showPartyEditView({ interaction, eventId, partyNumber, collections });
}

module.exports = {
  handleEditParties,
  handlePartySelectForEdit,
  handleBackToReview,
  handleBackToEdit,
  handleAddMemberToParty,
  handleRemoveMemberFromParty,
  processAddMember,
  processRemoveMember,
  handleBackToParty
};