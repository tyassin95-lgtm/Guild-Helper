// src/features/raids/utils/formatting.js - FIXED
const roleEmojis = {
  tank: '🛡️',
  healer: '💚',
  dps: '⚔️'
};

const roleOrder = {
  tank: 1,
  healer: 2,
  dps: 3
};

async function formatAttendeeList(attendeeIds, guildId, partyPlayers, client) {
  if (attendeeIds.length === 0) return '';

  // Fetch guild to get member names
  const guild = await client.guilds.fetch(guildId);

  // Fetch player data for all attendees
  const attendeeData = [];

  for (const userId of attendeeIds) {
    const player = await partyPlayers.findOne({ userId, guildId });

    let displayName = 'Unknown User';
    try {
      const member = await guild.members.fetch(userId);
      displayName = member.displayName; // This gets the server nickname or username
    } catch (err) {
      // User not found, use Unknown
    }

    // Build weapon combo text from weapon1 and weapon2
    let weaponText = null;
    if (player && player.weapon1 && player.weapon2) {
      weaponText = `${player.weapon1} / ${player.weapon2}`;
    }

    attendeeData.push({
      userId,
      displayName,
      role: player?.role || null,
      cp: player?.cp || null,
      weapon: weaponText
    });
  }

  // Sort attendees: by role first (tank -> healer -> dps), then by CP descending, then no info last
  attendeeData.sort((a, b) => {
    // Players with no info go last
    if (!a.role && b.role) return 1;
    if (a.role && !b.role) return -1;
    if (!a.role && !b.role) return 0;

    // Sort by role
    const roleComparison = roleOrder[a.role] - roleOrder[b.role];
    if (roleComparison !== 0) return roleComparison;

    // Sort by CP descending within same role
    return (b.cp || 0) - (a.cp || 0);
  });

  // Group by role
  const grouped = {
    tank: [],
    healer: [],
    dps: [],
    noInfo: []
  };

  for (const attendee of attendeeData) {
    if (!attendee.role) {
      grouped.noInfo.push(attendee);
    } else {
      grouped[attendee.role].push(attendee);
    }
  }

  // Build formatted string
  let result = '';

  // Tanks
  if (grouped.tank.length > 0) {
    result += `   ${roleEmojis.tank} **Tanks (${grouped.tank.length}):**\n`;
    for (const a of grouped.tank) {
      const weaponText = a.weapon ? ` | ${a.weapon}` : '';
      result += `      ├ ${a.displayName} (${a.cp || '?'} CP${weaponText})\n`;
    }
  }

  // Healers
  if (grouped.healer.length > 0) {
    result += `   ${roleEmojis.healer} **Healers (${grouped.healer.length}):**\n`;
    for (const a of grouped.healer) {
      const weaponText = a.weapon ? ` | ${a.weapon}` : '';
      result += `      ├ ${a.displayName} (${a.cp || '?'} CP${weaponText})\n`;
    }
  }

  // DPS
  if (grouped.dps.length > 0) {
    result += `   ${roleEmojis.dps} **DPS (${grouped.dps.length}):**\n`;
    for (const a of grouped.dps) {
      const weaponText = a.weapon ? ` | ${a.weapon}` : '';
      result += `      ├ ${a.displayName} (${a.cp || '?'} CP${weaponText})\n`;
    }
  }

  // No info
  if (grouped.noInfo.length > 0) {
    result += `   👤 **No Party Info (${grouped.noInfo.length}):**\n`;
    for (const a of grouped.noInfo) {
      result += `      ├ ${a.displayName}\n`;
    }
  }

  return result;
}

module.exports = { formatAttendeeList };