const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getRoleEmoji } = require('../../parties/roleDetection');

/**
 * Create admin review embed for temporary party formation
 */
function createPartyFormationEmbed(aiResponse, eventInfo) {
  const { temporaryParties, unplacedMembers, summary, warnings } = aiResponse;

  const embed = new EmbedBuilder()
    .setColor('#e74c3c')
    .setTitle(`🎯 Temporary Event Parties`)
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

  // Build summary description with new fields
  let summaryText = `**Event:** ${eventName}${location}\n` +
    `**Time:** <t:${timestamp}:F>\n\n` +
    `📊 **Summary:**\n` +
    `• ${summary.totalAttending} attending members\n` +
    `• ${summary.partiesFormed} parties formed`;

  // Add fullParties/partialParties if available
  if (summary.fullParties !== undefined && summary.partialParties !== undefined) {
    summaryText += ` (${summary.fullParties} full, ${summary.partialParties} partial)`;
  }

  summaryText += `\n• ${summary.membersPlaced} members placed`;

  // Add average party size if available
  if (summary.avgPartySize !== undefined) {
    summaryText += `\n• ${summary.avgPartySize.toFixed(1)} avg party size`;
  }

  if (summary.membersUnplaced > 0) {
    summaryText += `\n• ${summary.membersUnplaced} unplaced (see below)`;
  }

  embed.setDescription(summaryText);

  // Show warnings if any
  if (warnings && warnings.length > 0) {
    embed.addFields({
      name: '⚠️ Warnings',
      value: warnings.map(w => `• ${w}`).join('\n'),
      inline: false
    });
  }

  // Show each temporary party with new status indicators
  for (const party of temporaryParties) {
    const memberList = party.members.map(m => {
      const roleIcon = getRoleEmoji(m.role);
      const cp = m.cp ? m.cp.toLocaleString() : '0';
      const leaderCrown = m.isLeader ? '👑 ' : '';
      return `${roleIcon} ${leaderCrown}${m.displayName} (${m.weapon1}/${m.weapon2}) • ${cp} CP`;
    }).join('\n');

    const sourceInfo = party.sourceParties && party.sourceParties.length > 0
      ? ` (From Static ${party.sourceParties.map(p => `Party ${p}`).join(' & ')})`
      : ' (New Formation)';

    // Use new status field for emoji
    let statusEmoji = '✅';
    if (party.status === 'needs_filling') {
      statusEmoji = party.members.length >= 5 ? '⚠️' : '🔶';
    } else if (party.status === 'reorganized') {
      statusEmoji = '🔄';
    }

    // Add filling strategy to title if available
    let strategyText = '';
    if (party.fillingStrategy) {
      const strategyMap = {
        'kept_intact': ' [Kept Intact]',
        'added_dps': ' [+DPS]',
        'added_tank': ' [+Tank]',
        'added_healer': ' [+Healer]',
        'reorganized': ' [Reorganized]'
      };
      strategyText = strategyMap[party.fillingStrategy] || '';
    }

    embed.addFields({
      name: `${statusEmoji} Party ${party.tempPartyNumber}${sourceInfo}${strategyText}`,
      value: `${memberList}\n\n` +
             `**Composition:** ${party.composition.tank} Tank, ${party.composition.healer} Healer, ${party.composition.dps} DPS` +
             ` (${party.members.length}/6 members)\n` +
             `*${party.notes}*`,
      inline: false
    });
  }

  // Show unplaced members if any
  if (unplacedMembers && unplacedMembers.length > 0) {
    const unplacedList = unplacedMembers.map(m => {
      const roleIcon = getRoleEmoji(m.role);
      return `${roleIcon} ${m.displayName} - ${m.reason}`;
    }).join('\n');

    embed.addFields({
      name: '📦 Unplaced Members (Unable to Place)',
      value: unplacedList,
      inline: false
    });
  }

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
    `You've been assigned to **Temporary Party ${party.tempPartyNumber}**:\n\n` +
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