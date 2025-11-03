const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatAttendeeList } = require('./formatting');

async function buildRaidEmbed(raidEvent, collections, client) {
  const { partyPlayers } = collections;

  const embed = new EmbedBuilder()
    .setColor(raidEvent.closed ? 0x808080 : 0xDC143C) // Gray if closed, Crimson red if open
    .setTitle(`${raidEvent.closed ? '🔒' : '⚔️'} ${raidEvent.name.toUpperCase()}`)
    .setDescription(`**${raidEvent.difficulty.toUpperCase()}**\n\n${raidEvent.description}${raidEvent.closed ? '\n\n**⚠️ This raid is closed for signups.**' : ''}`)
    .setFooter({ text: `Created by ${raidEvent.createdBy}` })
    .setTimestamp(raidEvent.createdAt);

  if (raidEvent.imageUrl) {
    embed.setImage(raidEvent.imageUrl);
  }

  // Convert _id to hex string for button customIds
  const raidIdHex = raidEvent._id.toHexString ? raidEvent._id.toHexString() : raidEvent._id.toString();

  // Build each time slot as a separate field for cleaner look
  for (let i = 0; i < raidEvent.timeSlots.length; i++) {
    const slot = raidEvent.timeSlots[i];
    const attendeeCount = slot.attendees.length;
    const isFull = attendeeCount >= slot.maxCapacity;

    let fieldValue = `📅 <t:${slot.timestamp}:F>\n⏰ <t:${slot.timestamp}:R>\n`;
    fieldValue += `👥 **${attendeeCount}/${slot.maxCapacity}** signed up\n`;

    if (attendeeCount > 0) {
      fieldValue += `\n`;
      const attendeeList = await formatAttendeeList(slot.attendees, raidEvent.guildId, partyPlayers, client);
      fieldValue += attendeeList;
    } else {
      fieldValue += `\n   *No one has signed up yet*\n`;
    }

    embed.addFields({
      name: `${isFull ? '🔒' : '🗓️'} Time Slot ${i + 1}`,
      value: fieldValue,
      inline: false
    });
  }

  // Build buttons
  const allComponents = [];

  for (const slot of raidEvent.timeSlots) {
    const attendeeCount = slot.attendees.length;
    const isFull = attendeeCount >= slot.maxCapacity;

    const dateObj = new Date(slot.timestamp * 1000);
    const dateLabel = dateObj.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    });

    const button = new ButtonBuilder()
      .setCustomId(`raid_join:${raidIdHex}:${slot.id}`)
      .setLabel(isFull ? `Full - ${dateLabel}` : dateLabel)
      .setStyle(isFull || raidEvent.closed ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(isFull || raidEvent.closed);

    allComponents.push(button);
  }

  // Add "Leave All Times" button
  const leaveAllButton = new ButtonBuilder()
    .setCustomId(`raid_leave_all:${raidIdHex}`)
    .setLabel('Leave All Times')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(raidEvent.closed);

  allComponents.push(leaveAllButton);

  // Add "Close/Reopen Raid" button (admin only - identified by lack of disabled state)
  const closeButton = new ButtonBuilder()
    .setCustomId(`raid_close:${raidIdHex}`)
    .setLabel(raidEvent.closed ? 'Reopen Raid' : 'Close Raid')
    .setStyle(raidEvent.closed ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setEmoji(raidEvent.closed ? '🔓' : '🔒');

  allComponents.push(closeButton);

  // Split buttons into rows (max 5 per row)
  const rows = [];
  for (let i = 0; i < allComponents.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(allComponents.slice(i, i + 5)));
  }

  return { embed, components: rows };
}

module.exports = { buildRaidEmbed };