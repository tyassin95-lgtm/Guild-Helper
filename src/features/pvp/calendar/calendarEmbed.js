const { EmbedBuilder } = require('discord.js');

/**
 * Generate the PvP calendar embed in school timetable style
 * Shows today + next 6 days (rolling 7-day window)
 */
async function createCalendarEmbed(guildId, client, collections) {
  const { pvpEvents } = collections;

  // Get UK timezone date for "today"
  const now = new Date();
  const ukFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const ukDateParts = ukFormatter.formatToParts(now);
  const ukDay = parseInt(ukDateParts.find(p => p.type === 'day').value);
  const ukMonth = parseInt(ukDateParts.find(p => p.type === 'month').value) - 1; // 0-indexed
  const ukYear = parseInt(ukDateParts.find(p => p.type === 'year').value);

  // Create UK midnight today
  const ukToday = new Date(Date.UTC(ukYear, ukMonth, ukDay));

  // Adjust to UK timezone offset
  const ukOffset = getUKOffset(now);
  ukToday.setTime(ukToday.getTime() + ukOffset);

  // Get start and end of 7-day window
  const startDate = new Date(ukToday);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(ukToday);
  endDate.setDate(endDate.getDate() + 7);
  endDate.setHours(0, 0, 0, 0);

  // Fetch all events in the 7-day window
  const events = await pvpEvents
    .find({
      guildId,
      eventTime: {
        $gte: startDate,
        $lt: endDate
      }
    })
    .sort({ eventTime: 1 }) // Sort by time ascending
    .toArray();

  // Group events by day
  const eventsByDay = groupEventsByDay(events, startDate);

  // Build the timetable layout
  const timetableText = buildTimetable(eventsByDay, startDate, guildId);

  // Calculate date range for title
  const endDisplayDate = new Date(startDate);
  endDisplayDate.setDate(endDisplayDate.getDate() + 6);

  const dateRangeFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Europe/London'
  });

  const startDateStr = dateRangeFormatter.format(startDate);
  const endDateStr = dateRangeFormatter.format(endDisplayDate);

  const embed = new EmbedBuilder()
    .setColor('#e74c3c')
    .setTitle('🗓️ PvP Weekly Schedule')
    .setDescription(
      `**${startDateStr} - ${endDateStr}**\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      timetableText
    )
    .setFooter({
      text: `📊 ${events.length} event${events.length !== 1 ? 's' : ''} scheduled this week • 🔄 Updates every 5 minutes`
    })
    .setTimestamp();

  return embed;
}

/**
 * Get UK timezone offset in milliseconds
 */
function getUKOffset(date) {
  // UK is either GMT (UTC+0) or BST (UTC+1)
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = date.getTimezoneOffset() < stdOffset;

  // UK is UTC+0 in winter, UTC+1 in summer (BST)
  return isDST ? 1 * 60 * 60 * 1000 : 0;
}

/**
 * Group events by day (0-6 representing the 7 days)
 */
function groupEventsByDay(events, startDate) {
  const grouped = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  };

  for (const event of events) {
    const eventDate = new Date(event.eventTime);
    const dayDiff = Math.floor((eventDate - startDate) / (1000 * 60 * 60 * 24));

    if (dayDiff >= 0 && dayDiff < 7) {
      grouped[dayDiff].push(event);
    }
  }

  return grouped;
}

/**
 * Build the timetable text layout
 */
function buildTimetable(eventsByDay, startDate, guildId) {
  const eventTypeEmojis = {
    siege: '🏰',
    riftstone: '💎',
    boonstone: '🔮',
    wargames: '⚔️',
    guildevent: '🎪'
  };

  const eventTypeNames = {
    siege: 'Siege',
    riftstone: 'Riftstone',
    boonstone: 'Boonstone',
    wargames: 'Wargames',
    guildevent: 'Guild Event'
  };

  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  // Build Week 1 (Mon-Thu) and Week 2 (Fri-Sun)
  let timetable = '';

  // First row: Mon-Thu
  timetable += buildWeekRow(eventsByDay, startDate, 0, 4, dayNames, eventTypeEmojis, eventTypeNames, guildId);

  timetable += '\n\n';

  // Second row: Fri-Sun
  timetable += buildWeekRow(eventsByDay, startDate, 4, 7, dayNames, eventTypeEmojis, eventTypeNames, guildId);

  return timetable;
}

/**
 * Build a row of days (for splitting Mon-Thu and Fri-Sun)
 */
function buildWeekRow(eventsByDay, startDate, startIdx, endIdx, dayNames, eventTypeEmojis, eventTypeNames, guildId) {
  let row = '';

  // Build headers
  const headers = [];
  for (let i = startIdx; i < endIdx; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dayNum = date.getDate();

    // Adjust day name based on actual day of week
    const actualDayIdx = date.getDay(); // 0 = Sun, 1 = Mon, etc.
    const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][actualDayIdx];

    headers.push(`**${dayName} ${dayNum}**`);
  }
  row += headers.join('          ') + '\n';

  // Build separator
  const separators = [];
  for (let i = startIdx; i < endIdx; i++) {
    separators.push('═══════');
  }
  row += separators.join('     ') + '\n\n';

  // Find max events in any day for this row
  let maxEvents = 0;
  for (let i = startIdx; i < endIdx; i++) {
    maxEvents = Math.max(maxEvents, eventsByDay[i].length);
  }

  // Build event rows
  for (let eventIdx = 0; eventIdx < Math.max(maxEvents, 1); eventIdx++) {
    const eventLine = [];

    for (let dayIdx = startIdx; dayIdx < endIdx; dayIdx++) {
      const dayEvents = eventsByDay[dayIdx];

      if (eventIdx === 0 && dayEvents.length === 0) {
        // Show "No Events" on first line if day is empty
        eventLine.push('No Events');
      } else if (eventIdx < dayEvents.length) {
        const event = dayEvents[eventIdx];
        const emoji = eventTypeEmojis[event.eventType] || '📅';
        const typeName = eventTypeNames[event.eventType] || event.eventType;

        // Create masked link to event
        const eventLink = `https://discord.com/channels/${guildId}/${event.channelId}/${event.messageId}`;
        const timestamp = Math.floor(event.eventTime.getTime() / 1000);
        const timeLink = `[<t:${timestamp}:t>](${eventLink})`;

        // Format: emoji + clickable time + newline + name + location (if applicable)
        let eventText = `${emoji} ${timeLink}`;

        // Add event type name
        eventText += `\n${typeName}`;

        // Add location for events that have it
        if (event.location) {
          // Truncate location if too long
          const loc = event.location.length > 12 ? event.location.substring(0, 12) + '...' : event.location;
          eventText += `\n*${loc}*`;
        }

        eventLine.push(eventText);
      } else {
        // Empty space for alignment
        eventLine.push('');
      }
    }

    row += eventLine.join('     ') + '\n';

    // Add extra spacing between events
    if (eventIdx < maxEvents - 1) {
      row += '\n';
    }
  }

  return row;
}

module.exports = { createCalendarEmbed };