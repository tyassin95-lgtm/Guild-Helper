// src/features/raids/utils/formatting.js
const roleEmojis = {
  tank: '🛡️',
  healer: '💚',
  dps: '⚔️'
};

const experienceEmojis = {
  experienced: '⭐',
  learning: '📚'
};

const roleOrder = {
  tank: 1,
  healer: 2,
  dps: 3
};

async function formatAttendeeList(attendees, guildId, partyPlayers, client) {
  if (attendees.length === 0) return '';

  // Fetch guild to get member names
  const guild = await client.guilds.fetch(guildId);

  // Build attendee data
  const attendeeData = [];

  for (const attendee of attendees) {
    let displayName = 'Unknown User';
    try {
      const member = await guild.members.fetch(attendee.userId);
      displayName = member.displayName;
    } catch (err) {
      // User not found, use Unknown
    }

    attendeeData.push({
      userId: attendee.userId,
      displayName,
      role: attendee.role || null,
      experience: attendee.experience || null,
      cp: attendee.cp || null
    });
  }

  // Sort attendees: by role first (tank -> healer -> dps), then by CP descending
  attendeeData.sort((a, b) => {
    // Players with no role go last
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
      const expEmoji = a.experience ? experienceEmojis[a.experience] : '';
      result += `      ├ ${a.displayName} ${expEmoji} (${a.cp || '?'} CP)\n`;
    }
  }

  // Healers
  if (grouped.healer.length > 0) {
    result += `   ${roleEmojis.healer} **Healers (${grouped.healer.length}):**\n`;
    for (const a of grouped.healer) {
      const expEmoji = a.experience ? experienceEmojis[a.experience] : '';
      result += `      ├ ${a.displayName} ${expEmoji} (${a.cp || '?'} CP)\n`;
    }
  }

  // DPS
  if (grouped.dps.length > 0) {
    result += `   ${roleEmojis.dps} **DPS (${grouped.dps.length}):**\n`;
    for (const a of grouped.dps) {
      const expEmoji = a.experience ? experienceEmojis[a.experience] : '';
      result += `      ├ ${a.displayName} ${expEmoji} (${a.cp || '?'} CP)\n`;
    }
  }

  // No info
  if (grouped.noInfo.length > 0) {
    result += `   👤 **No Signup Info (${grouped.noInfo.length}):**\n`;
    for (const a of grouped.noInfo) {
      result += `      ├ ${a.displayName}\n`;
    }
  }

  return result;
}

module.exports = { formatAttendeeList };