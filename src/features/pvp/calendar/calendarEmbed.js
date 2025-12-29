/**
 * Generate the PvP calendar as formatted text (not embed)
 * Shows today + next 6 days (rolling 7-day window)
 * Updates daily at midnight UK time
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

  // Build the calendar content
  const calendarContent = buildCalendarContent(eventsByDay, startDate, guildId);

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
    `**${startDateStr} - ${endDateStr}**\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    calendarContent +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 **${events.length}** event${events.length !== 1 ? 's' : ''} scheduled • 🔄 Updates every 5 minutes • Last updated <t:${timestamp}:R>`;

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
 * Build the calendar content (vertical layout with full event details)
 */
function buildCalendarContent(eventsByDay, startDate, guildId) {
  const eventTypeEmojis = {
    siege: '🏰',
    riftstone: '💎',
    boonstone: '🔮',
    wargames: '⚔️',
    guildevent: '🎪'
  };

  const eventTypeNames = {
    siege: 'Siege',
    riftstone: 'Riftstone Fight',
    boonstone: 'Boonstone Fight',
    wargames: 'Wargames',
    guildevent: 'Guild Event'
  };

  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  let content = '';

  // Build each day vertically
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dayNum = date.getDate();
    const monthName = monthNames[date.getMonth()];
    const actualDayIdx = date.getDay();
    const dayName = dayNames[actualDayIdx];

    // Check if this is today
    const isToday = i === 0;
    const todayLabel = isToday ? ' (Today)' : '';

    // Day header
    content += `**📅 ${dayName}, ${monthName} ${dayNum}${todayLabel}**\n`;

    const dayEvents = eventsByDay[i];

    if (dayEvents.length === 0) {
      // No events for this day
      content += `    *No events scheduled*\n`;
    } else {
      // List all events for this day with numbering if multiple
      const showNumbers = dayEvents.length > 1;

      for (let eventIdx = 0; eventIdx < dayEvents.length; eventIdx++) {
        const event = dayEvents[eventIdx];
        const emoji = eventTypeEmojis[event.eventType] || '📅';
        const typeName = eventTypeNames[event.eventType] || event.eventType;

        // Check if event is closed/canceled
        const isClosed = event.closed === true;

        // Create masked link to event
        const eventLink = `https://discord.com/channels/${guildId}/${event.channelId}/${event.messageId}`;

        // Format time using Discord timestamp
        const timestamp = Math.floor(event.eventTime.getTime() / 1000);
        const timeDisplay = `<t:${timestamp}:t>`;

        // Event number if multiple events
        const eventNumber = showNumbers ? `${eventIdx + 1}) ` : '';

        // Apply strikethrough if event is closed
        if (isClosed) {
          // Event line with strikethrough
          content += `    ${eventNumber}~~${emoji} **${timeDisplay}** • ${typeName}~~ **(CANCELED)**\n`;

          // Add location if it exists (with strikethrough)
          if (event.location) {
            content += `        ~~└─ Location: ${event.location}~~\n`;
          }

          // Add bonus points (with strikethrough)
          const bonusPoints = event.bonusPoints || 10;
          content += `        ~~└─ Bonus: +${bonusPoints} roll points~~\n`;

          // Add "Go to Event" link (still clickable but marked as canceled)
          content += `        └─ [Go to Event](${eventLink}) *(Event Canceled)*\n`;
        } else {
          // Normal event line
          content += `    ${eventNumber}${emoji} **${timeDisplay}** • ${typeName}\n`;

          // Add location if it exists
          if (event.location) {
            content += `        └─ Location: ${event.location}\n`;
          }

          // Add bonus points
          const bonusPoints = event.bonusPoints || 10;
          content += `        └─ Bonus: +${bonusPoints} roll points\n`;

          // Add "Go to Event" link
          content += `        └─ [Go to Event](${eventLink})\n`;
        }

        // Add spacing between events on same day
        if (eventIdx < dayEvents.length - 1) {
          content += `\n`;
        }
      }
    }

    // Add separator line between days (except after last day)
    if (i < 6) {
      content += `\n━━━━━━━━━━━━━━━━━━━\n\n`;
    } else {
      content += `\n`;
    }
  }

  return content;
}

module.exports = { createCalendarMessage };