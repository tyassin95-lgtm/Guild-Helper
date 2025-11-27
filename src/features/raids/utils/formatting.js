const CLASSES = {
  // Pure Tank classes
  'Guardian': { roles: ['tank'], weapons: 'Orb + Sword & Shield' },
  'Crusader': { roles: ['tank'], weapons: 'Greatsword + Sword & Shield' },
  'Templar': { roles: ['tank'], weapons: 'Wand/Tome + Sword & Shield' },
  'Warden': { roles: ['tank'], weapons: 'Longbow + Sword & Shield' },
  'Disciple': { roles: ['tank'], weapons: 'Staff + Sword & Shield' },
  'Paladin': { roles: ['tank'], weapons: 'Greatsword + Wand/Tome' },
  'Berserker': { roles: ['tank'], weapons: 'Daggers + Sword & Shield' },
  'Raider': { roles: ['tank'], weapons: 'Sword & Shield + Crossbow' },
  'Steelheart': { roles: ['tank'], weapons: 'Spear + Sword & Shield' },

  // Flex classes (can play multiple roles)
  'Oracle': { roles: ['healer', 'dps'], weapons: 'Orb + Wand/Tome' },
  'Seeker': { roles: ['healer', 'dps'], weapons: 'Longbow + Wand/Tome' },

  // Pure DPS classes
  'Fury': { roles: ['dps'], weapons: 'Wand/Tome + Crossbow' },
  'Battleweaver': { roles: ['dps'], weapons: 'Staff + Crossbow' },
  'Scout': { roles: ['dps'], weapons: 'Longbow + Crossbow' },
  'Scryer': { roles: ['dps'], weapons: 'Orb + Longbow' },
  'Ranger': { roles: ['dps'], weapons: 'Longbow + Greatsword' },
  'Crucifix': { roles: ['dps'], weapons: 'Orb + Crossbow' },
  'Invocator': { roles: ['dps'], weapons: 'Staff + Wand/Tome' },
  'Sentinel': { roles: ['dps'], weapons: 'Staff + Longsword' },
  'Liberator': { roles: ['dps'], weapons: 'Staff + Longbow' },
  'Enigma': { roles: ['dps'], weapons: 'Orb + Staff' },
  'Ravager': { roles: ['dps'], weapons: 'Greatsword + Daggers' },
  'Darkblighter': { roles: ['dps'], weapons: 'Daggers + Wand/Tome' },
  'Scorpion': { roles: ['dps'], weapons: 'Daggers + Crossbow' },
  'Infiltrator': { roles: ['dps'], weapons: 'Daggers + Longbow' },
  'Spellblade': { roles: ['dps'], weapons: 'Staff + Daggers' },
  'Lunarch': { roles: ['dps'], weapons: 'Orb + Daggers' },
  'Polaris': { roles: ['dps'], weapons: 'Spear + Orb' },
  'Outrider': { roles: ['dps'], weapons: 'Greatsword + Crossbow' },
  'Justicar': { roles: ['dps'], weapons: 'Orb + Greatsword' },
  'Eradicator': { roles: ['dps'], weapons: 'Spear + Staff' },
  'Cavalier': { roles: ['dps'], weapons: 'Spear + Crossbow' },
  'Shadowdancer': { roles: ['dps'], weapons: 'Spear + Daggers' },
  'Gladiator': { roles: ['dps'], weapons: 'Greatsword + Spear' },
  'Impaler': { roles: ['dps'], weapons: 'Spear + Longbow' },
  'Voidlance': { roles: ['dps'], weapons: 'Spear + Wand/Tome' }
};

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

/**
 * Get all classes that can play a specific role
 * This includes flex classes (Oracle, Seeker) in both healer and dps
 */
function getClassesForRole(role) {
  const classes = [];

  for (const [className, classData] of Object.entries(CLASSES)) {
    if (classData.roles.includes(role)) {
      classes.push(className);
    }
  }

  // Sort alphabetically for consistent display
  return classes.sort();
}

async function formatAttendeeList(attendees, guildId, partyPlayers, client) {
  if (attendees.length === 0) return '';

  const guild = await client.guilds.fetch(guildId);
  const attendeeData = [];

  for (const attendee of attendees) {
    let displayName = 'Unknown User';
    try {
      const member = await guild.members.fetch(attendee.userId);
      displayName = member.displayName;
    } catch (err) {
      // User not found
    }

    attendeeData.push({
      userId: attendee.userId,
      displayName,
      class: attendee.class || null,
      role: attendee.role || null,
      experience: attendee.experience || null,
      cp: attendee.cp || null
    });
  }

  attendeeData.sort((a, b) => {
    if (!a.role && b.role) return 1;
    if (a.role && !b.role) return -1;
    if (!a.role && !b.role) return 0;
    const roleComparison = roleOrder[a.role] - roleOrder[b.role];
    if (roleComparison !== 0) return roleComparison;
    return (b.cp || 0) - (a.cp || 0);
  });

  const grouped = { tank: [], healer: [], dps: [], noInfo: [] };
  for (const attendee of attendeeData) {
    if (!attendee.role) {
      grouped.noInfo.push(attendee);
    } else {
      grouped[attendee.role].push(attendee);
    }
  }

  let result = '';

  if (grouped.tank.length > 0) {
    result += `   ${roleEmojis.tank} **Tanks (${grouped.tank.length}):**\n`;
    for (const a of grouped.tank) {
      const expEmoji = a.experience ? experienceEmojis[a.experience] : '';
      const classInfo = a.class ? ` [${a.class}]` : '';
      result += `      ├ ${a.displayName}${classInfo} ${expEmoji} (${a.cp || '?'} CP)\n`;
    }
  }

  if (grouped.healer.length > 0) {
    result += `   ${roleEmojis.healer} **Healers (${grouped.healer.length}):**\n`;
    for (const a of grouped.healer) {
      const expEmoji = a.experience ? experienceEmojis[a.experience] : '';
      const classInfo = a.class ? ` [${a.class}]` : '';
      result += `      ├ ${a.displayName}${classInfo} ${expEmoji} (${a.cp || '?'} CP)\n`;
    }
  }

  if (grouped.dps.length > 0) {
    result += `   ${roleEmojis.dps} **DPS (${grouped.dps.length}):**\n`;
    for (const a of grouped.dps) {
      const expEmoji = a.experience ? experienceEmojis[a.experience] : '';
      const classInfo = a.class ? ` [${a.class}]` : '';
      result += `      ├ ${a.displayName}${classInfo} ${expEmoji} (${a.cp || '?'} CP)\n`;
    }
  }

  if (grouped.noInfo.length > 0) {
    result += `   👤 **No Signup Info (${grouped.noInfo.length}):**\n`;
    for (const a of grouped.noInfo) {
      result += `      ├ ${a.displayName}\n`;
    }
  }

  return result;
}

module.exports = { formatAttendeeList, CLASSES, roleEmojis, experienceEmojis, roleOrder, getClassesForRole };