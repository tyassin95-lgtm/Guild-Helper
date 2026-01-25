const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getRoleEmoji } = require('../../parties/roleDetection');

/**
 * Create party formation review embed
 */
function createPartyFormationEmbed(processedParties, availableMembers, summary, eventInfo) {
  const embed = new EmbedBuilder()
    .setColor('#e74c3c')
    .setTitle(`📋 Event Party Formation Review`)
    .setTimestamp();

  // Event info
  const eventTypeNames = {
    siege: 'Siege',
    riftstone: 'Riftstone Fight',
    boonstone: 'Boonstone Fight',
    wargames: 'Wargames',
    warboss: 'War Boss',
    guildevent: 'Guild Event'
  };

  const eventName = eventTypeNames[eventInfo.eventType] || eventInfo.eventType;
  const location = eventInfo.location ? ` - ${eventInfo.location}` : '';
  const timestamp = Math.floor(eventInfo.eventTime.getTime() / 1000);

  embed.setDescription(
    `**Event:** ${eventName}${location}\n` +
    `**Time:** <t:${timestamp}:F>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  );

  // Show processed parties
  for (const party of processedParties) {
    let statusEmoji = '';
    let statusLabel = '';

    if (party.status === 'intact') {
      statusEmoji = '✅';
      statusLabel = 'NO CHANGES';
    } else if (party.status === 'modified') {
      statusEmoji = '⚠️';
      statusLabel = `${party.removedMembers.length} REMOVED`;
    }

    const memberList = party.members.map(m => {
      const roleIcon = getRoleEmoji(m.role);
      const cp = m.cp ? m.cp.toLocaleString() : '0';
      const leaderCrown = m.isLeader ? '👑 ' : '';
      return `• ${roleIcon} ${leaderCrown}${m.displayName} (${m.weapon1}/${m.weapon2}) - ${cp} CP`;
    }).join('\n');

    let fieldValue = '';

    // Show removed members if any
    if (party.removedMembers.length > 0) {
      const removedList = party.removedMembers.map(m => {
        const roleIcon = getRoleEmoji(m.role);
        return `  • ${roleIcon} ${m.displayName} (${m.weapon1}/${m.weapon2}) - marked not attending`;
      }).join('\n');

      fieldValue += `**Removed:**\n${removedList}\n\n**Remaining (${party.members.length}/6):**\n`;
    }

    fieldValue += memberList;

    fieldValue += `\n\n**Composition:** ${party.composition.tank} Tank, ${party.composition.healer} Healer, ${party.composition.dps} DPS`;

    embed.addFields({
      name: `${statusEmoji} Party ${party.partyNumber} (${party.members.length}/6) - ${statusLabel}`,
      value: fieldValue,
      inline: false
    });
  }

  // Show disbanded parties (if any exist in the summary)
  if (summary.partiesDisbanded > 0) {
    // We need to calculate which parties were disbanded
    // This info isn't directly in processedParties, so we'll note it in the available members section
    embed.addFields({
      name: `❌ Disbanded Parties`,
      value: `${summary.partiesDisbanded} party/parties disbanded due to having fewer than 3 members available.\n` +
             `Remaining members from disbanded parties have been moved to the available pool below.`,
      inline: false
    });
  }

  embed.addFields({
    name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    value: '\u200b',
    inline: false
  });

  // Show available members
  if (availableMembers.length > 0) {
    // Group by source
    const fromDisbanded = availableMembers.filter(m => m.source && m.source.includes('disbanded'));
    const unassigned = availableMembers.filter(m => m.source === 'Unassigned');

    let availableText = '';

    if (fromDisbanded.length > 0) {
      availableText += `**From disbanded parties:**\n`;
      fromDisbanded.forEach(m => {
        const roleIcon = getRoleEmoji(m.role);
        const cp = m.cp ? m.cp.toLocaleString() : '0';
        availableText += `• ${roleIcon} ${m.displayName} (${m.weapon1}/${m.weapon2}) - ${cp} CP - ${m.source}\n`;
      });
      availableText += '\n';
    }

    if (unassigned.length > 0) {
      availableText += `**Unassigned attendees:**\n`;
      unassigned.forEach(m => {
        const roleIcon = getRoleEmoji(m.role);
        const cp = m.cp ? m.cp.toLocaleString() : '0';
        availableText += `• ${roleIcon} ${m.displayName} (${m.weapon1}/${m.weapon2}) - ${cp} CP\n`;
      });
    }

    // Calculate role needs
    const roleCount = {
      tank: availableMembers.filter(m => m.role === 'tank').length,
      healer: availableMembers.filter(m => m.role === 'healer').length,
      dps: availableMembers.filter(m => m.role === 'dps').length
    };

    availableText += `\n**Role Distribution:** ${roleCount.tank} Tank, ${roleCount.healer} Healer, ${roleCount.dps} DPS`;

    embed.addFields({
      name: `📦 AVAILABLE FOR PLACEMENT (${availableMembers.length} members)`,
      value: availableText,
      inline: false
    });
  } else {
    embed.addFields({
      name: `📦 AVAILABLE FOR PLACEMENT`,
      value: '*No members available for placement - all attendees are in parties*',
      inline: false
    });
  }

  embed.addFields({
    name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    value: '\u200b',
    inline: false
  });

  // Summary
  embed.addFields({
    name: '📊 Summary',
    value: 
      `• ${summary.partiesIntact} party/parties intact, ${summary.partiesModified} modified, ${summary.partiesDisbanded} disbanded\n` +
      `• ${summary.membersRemoved} members removed (not attending)\n` +
      `• ${summary.membersAvailable} members available for placement\n` +
      `• Total attending: ${summary.totalAttending}`,
    inline: false
  });

  return embed;
}

/**
 * Create action buttons for admin review
 */
function createPartyFormationButtons(eventId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_party_edit:${eventId}`)
      .setLabel('Edit Parties')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId(`event_party_approve:${eventId}`)
      .setLabel('Approve & Send DMs')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`event_party_cancel:${eventId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );

  return row;
}

/**
 * Create DM message for party member
 */
function createPartyAssignmentDM(member, party, eventInfo) {
  const eventTypeNames = {
    siege: 'Siege',
    riftstone: 'Riftstone Fight',
    boonstone: 'Boonstone Fight',
    wargames: 'Wargames',
    warboss: 'War Boss',
    guildevent: 'Guild Event'
  };

  const eventName = eventTypeNames[eventInfo.eventType] || eventInfo.eventType;
  const location = eventInfo.location ? ` - ${eventInfo.location}` : '';
  const timestamp = Math.floor(eventInfo.eventTime.getTime() / 1000);

  const partyList = party.members.map(m => {
    const roleIcon = getRoleEmoji(m.role);
    const leaderCrown = m.isLeader ? '👑 ' : '';
    const isYou = m.userId === member.userId ? ' **(You)**' : '';
    return `${roleIcon} ${leaderCrown}${m.displayName}${isYou}`;
  }).join('\n');

  const message = 
    `🎯 **Your Event Party Assignment**\n\n` +
    `**Event:** ${eventName}${location}\n` +
    `**Time:** <t:${timestamp}:F> (<t:${timestamp}:R>)\n\n` +
    `You've been assigned to **Party ${party.partyNumber}**:\n\n` +
    `${partyList}\n\n` +
    `📋 **Role Composition:**\n` +
    `• 🛡️ Tanks: ${party.composition.tank}\n` +
    `• 💚 Healers: ${party.composition.healer}\n` +
    `• ⚔️ DPS: ${party.composition.dps}\n\n` +
    `Good luck! 🎯`;

  return message;
}

module.exports = {
  createPartyFormationEmbed,
  createPartyFormationButtons,
  createPartyAssignmentDM
};