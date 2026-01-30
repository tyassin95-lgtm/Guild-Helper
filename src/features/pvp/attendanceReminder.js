const { EmbedBuilder } = require('discord.js');

let autoReminderInterval = null;

// Check every 5 minutes for events needing reminders
const CHECK_INTERVAL = 5 * 60 * 1000;

// Reminder window: 1 hour before event (with 5-minute buffer)
const REMINDER_WINDOW_START = 65 * 60 * 1000; // 65 minutes before
const REMINDER_WINDOW_END = 55 * 60 * 1000;   // 55 minutes before

/**
 * Start the auto-reminder task for PvP attendance
 * Sends DM reminders to users who haven't marked attendance 1 hour before event
 */
function startAttendanceReminder(client, collections) {
  if (autoReminderInterval) {
    console.warn('Attendance reminder is already running');
    return;
  }

  console.log('🔔 Starting PvP attendance reminder (checking every 5 minutes)...');

  // Run immediately on start
  checkAndSendReminders(client, collections);

  // Then run every 5 minutes
  autoReminderInterval = setInterval(() => {
    checkAndSendReminders(client, collections);
  }, CHECK_INTERVAL);

  console.log('✅ PvP attendance reminder started');
}

/**
 * Stop the auto-reminder task
 */
function stopAttendanceReminder() {
  if (autoReminderInterval) {
    clearInterval(autoReminderInterval);
    autoReminderInterval = null;
    console.log('🛑 PvP attendance reminder stopped');
  }
}

/**
 * Check for upcoming events and send reminders
 */
async function checkAndSendReminders(client, collections) {
  const { pvpEvents } = collections;

  try {
    const now = new Date();

    // Find events starting in approximately 1 hour (55-65 minutes from now)
    const windowStart = new Date(now.getTime() + REMINDER_WINDOW_END);
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_START);

    // Find open events in the reminder window that haven't had reminders sent
    const upcomingEvents = await pvpEvents.find({
      closed: { $ne: true },
      eventTime: {
        $gte: windowStart,
        $lte: windowEnd
      },
      remindersSent: { $ne: true } // Only events that haven't had reminders sent
    }).toArray();

    if (upcomingEvents.length === 0) {
      return;
    }

    console.log(`🔔 Found ${upcomingEvents.length} event(s) needing attendance reminders`);

    for (const event of upcomingEvents) {
      await sendRemindersForEvent(client, event, collections);
    }
  } catch (err) {
    console.error('Error checking for attendance reminders:', err);
  }
}

/**
 * Send DM reminders to users who haven't marked attendance for an event
 * Only reminds users who have submitted their party info
 */
async function sendRemindersForEvent(client, event, collections) {
  const { pvpEvents, partyPlayers } = collections;

  try {
    const guild = await client.guilds.fetch(event.guildId);
    if (!guild) {
      console.warn(`Guild ${event.guildId} not found for event ${event._id}`);
      return;
    }

    // Get users who have complete party info (weapon1, weapon2, cp)
    const playersWithInfo = await partyPlayers.find({
      guildId: event.guildId,
      weapon1: { $exists: true },
      weapon2: { $exists: true },
      cp: { $exists: true }
    }).toArray();

    const usersWithPartyInfo = new Set(playersWithInfo.map(p => p.userId));

    if (usersWithPartyInfo.size === 0) {
      console.log(`⚠️ No users with party info for guild ${event.guildId} - skipping reminders`);
      await pvpEvents.updateOne(
        { _id: event._id },
        { $set: { remindersSent: true } }
      );
      return;
    }

    // Get users who have already marked attendance (any status)
    const rsvpAttending = event.rsvpAttending || [];
    const rsvpMaybe = event.rsvpMaybe || [];
    const rsvpNotAttending = event.rsvpNotAttending || [];

    const respondedUsers = new Set([
      ...rsvpAttending,
      ...rsvpMaybe,
      ...rsvpNotAttending
    ]);

    // Find users with party info who haven't responded
    const needsReminderIds = [...usersWithPartyInfo].filter(userId => !respondedUsers.has(userId));

    if (needsReminderIds.length === 0) {
      console.log(`✅ All users with party info have responded to event ${event._id}`);
      await pvpEvents.updateOne(
        { _id: event._id },
        { $set: { remindersSent: true } }
      );
      return;
    }

    // Fetch the members who need reminders
    await guild.members.fetch();
    const needsReminder = needsReminderIds
      .map(userId => guild.members.cache.get(userId))
      .filter(member => member && !member.user.bot);

    if (needsReminder.length === 0) {
      console.log(`✅ All users with party info have responded to event ${event._id}`);
      await pvpEvents.updateOne(
        { _id: event._id },
        { $set: { remindersSent: true } }
      );
      return;
    }

    console.log(`📨 Sending reminders to ${needsReminder.length} member(s) with party info for event ${event._id}`);

    // Create the reminder embed
    const reminderEmbed = createReminderEmbed(event, guild);

    let successCount = 0;
    let failCount = 0;

    for (const member of needsReminder) {
      try {
        await member.send({ embeds: [reminderEmbed] });
        successCount++;

        // Delay between DMs (1 second) to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        failCount++;
        // Silently log failures (user may have DMs disabled)
        console.debug(`Failed to DM ${member.user.tag} for attendance reminder:`, err.message);
      }
    }

    // Mark reminders as sent for this event
    await pvpEvents.updateOne(
      { _id: event._id },
      { $set: { remindersSent: true } }
    );

    console.log(`✅ Attendance reminders sent for event ${event._id}: ${successCount} success, ${failCount} failed`);
  } catch (err) {
    console.error(`Error sending reminders for event ${event._id}:`, err);
  }
}

/**
 * Create a nicely formatted reminder embed
 */
function createReminderEmbed(event, guild) {
  const eventTypeEmojis = {
    siege: '🏰',
    riftstone: '💎',
    boonstone: '🔮',
    wargames: '⚔️',
    warboss: '👹',
    guildevent: '🎪'
  };

  const eventTypeNames = {
    siege: 'Siege',
    riftstone: 'Riftstone Fight',
    boonstone: 'Boonstone Fight',
    wargames: 'Wargames',
    warboss: 'War Boss',
    guildevent: 'Guild Event'
  };

  const emoji = eventTypeEmojis[event.eventType] || '⚔️';
  const typeName = eventTypeNames[event.eventType] || event.eventType;

  // Calculate timestamps
  const eventTimestamp = Math.floor(event.eventTime.getTime() / 1000);
  const signupDeadline = new Date(event.eventTime.getTime() - (20 * 60 * 1000));
  const signupDeadlineTimestamp = Math.floor(signupDeadline.getTime() / 1000);

  // Create direct link to the event message
  const eventLink = `https://discord.com/channels/${event.guildId}/${event.channelId}/${event.messageId}`;

  const embed = new EmbedBuilder()
    .setColor('#f39c12') // Orange/amber for attention
    .setTitle(`${emoji} PvP Event Reminder`)
    .setDescription(
      `Hey there! You haven't marked your attendance for an upcoming **${typeName}** event in **${guild.name}**.\n\n` +
      `The event starts **soon** - please let us know if you can make it!`
    )
    .addFields(
      {
        name: '📅 Event',
        value: `**${typeName}**${event.location ? ` - ${event.location}` : ''}`,
        inline: true
      },
      {
        name: '⏰ Event Time',
        value: `<t:${eventTimestamp}:F>\n<t:${eventTimestamp}:R>`,
        inline: true
      },
      {
        name: '🎁 Bonus Points',
        value: `**+${event.bonusPoints || 10}** points`,
        inline: true
      },
      {
        name: '🔒 Signups Close',
        value: `<t:${signupDeadlineTimestamp}:F>\n<t:${signupDeadlineTimestamp}:R>`,
        inline: false
      },
      {
        name: '🔗 Quick Link',
        value: `**[Click here to go to the event](${eventLink})**\n\nUse the buttons there to mark yourself as **Attending**, **Maybe**, or **Not Attending**.`,
        inline: false
      }
    )
    .setFooter({
      text: `${guild.name} • Don't forget to sign up before the deadline!`,
      iconURL: guild.iconURL() || undefined
    })
    .setTimestamp();

  return embed;
}

module.exports = { startAttendanceReminder, stopAttendanceReminder };
