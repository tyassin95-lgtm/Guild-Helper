/**
 * Generate the PvP calendar as formatted text (not embed)
 * Shows today + next 6 days (rolling 7-day window)
 */
async function createCalendarMessage(guildId, client, collections) {
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

  const timestamp = Math.floor(Date.now() / 1000);

  // Build formatted text message
  const message = 
    `# 🗓️ PvP Weekly Schedule\n` +
    `**${startDateStr} - ${endDateStr}**\n` +
    `\`\`\`\n` +
    timetableText +
    `\`\`\`\n` +
    `📊 **${events.length}** event${events.length !== 1 ? 's' : ''} scheduled • 🔄 Updates every 5 minutes • <t:${timestamp}:R>`;

  return message;
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
 * Build the timetable text layout (all 7 days horizontally)
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

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  let timetable = '';

  // Build header row with all 7 days
  const headers = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dayNum = date.getDate();
    const actualDayIdx = date.getDay();
    const dayName = dayNames[actualDayIdx];

    // Fixed width for each column (18 chars)
    const header = `${dayName} ${dayNum}`.padEnd(18);
    headers.push(header);
  }
  timetable += headers.join('') + '\n';

  // Build separator
  timetable += '═'.repeat(126) + '\n';

  // Find max events in any single day
  let maxEvents = 0;
  for (let i = 0; i < 7; i++) {
    maxEvents = Math.max(maxEvents, eventsByDay[i].length);
  }

  // If no events at all
  if (maxEvents === 0) {
    timetable += '\n' + ' '.repeat(45) + 'No events scheduled\n';
    return timetable;
  }

  // Build event rows (one row per event slot across all days)
  for (let eventIdx = 0; eventIdx < maxEvents; eventIdx++) {
    const eventRow = [];

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayEvents = eventsByDay[dayIdx];

      if (eventIdx < dayEvents.length) {
        const event = dayEvents[eventIdx];
        const emoji = eventTypeEmojis[event.eventType] || '📅';

        // Create masked link to event
        const eventLink = `https://discord.com/channels/${guildId}/${event.channelId}/${event.messageId}`;
        const timestamp = Math.floor(event.eventTime.getTime() / 1000);

        // Format as: "emoji Time"
        const timeLink = `${emoji} <t:${timestamp}:t>`;

        // Pad to fixed width
        const cell = timeLink.padEnd(18);
        eventRow.push(cell);
      } else {
        // Empty cell
        eventRow.push(' '.repeat(18));
      }
    }

    timetable += eventRow.join('') + '\n';
  }

  return timetable;
}

module.exports = { createCalendarMessage };