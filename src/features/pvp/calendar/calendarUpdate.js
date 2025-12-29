const { createCalendarMessages } = require('./calendarEmbed');

/**
 * Update the PvP calendar for a specific guild
 * Fetches the calendar messages and updates their content
 */
async function updateCalendar(client, guildId, collections) {
  const { pvpCalendars } = collections;

  try {
    // Find calendar for this guild
    const calendar = await pvpCalendars.findOne({ guildId });

    if (!calendar) {
      // No calendar exists for this guild
      return;
    }

    // Fetch the channel
    const channel = await client.channels.fetch(calendar.channelId).catch(() => null);

    if (!channel) {
      console.warn(`Calendar channel ${calendar.channelId} not found for guild ${guildId}`);
      // Channel was deleted, remove calendar from database
      await pvpCalendars.deleteOne({ guildId });
      return;
    }

    // Generate updated message contents
    const messages = await createCalendarMessages(guildId, client, collections);

    // Calendar now has messageIds array (header + 7 day messages = 8 total)
    const messageIds = calendar.messageIds || [];

    // If we don't have the right number of messages, recreate the calendar
    if (messageIds.length !== 8) {
      console.warn(`Calendar for guild ${guildId} has wrong number of messages (${messageIds.length}), needs recreation`);
      await pvpCalendars.deleteOne({ guildId });
      return;
    }

    // Update each message
    for (let i = 0; i < messageIds.length; i++) {
      try {
        const message = await channel.messages.fetch(messageIds[i]).catch(() => null);

        if (!message) {
          console.warn(`Calendar message ${messageIds[i]} not found in channel ${calendar.channelId}`);
          // Message was deleted, remove calendar from database
          await pvpCalendars.deleteOne({ guildId });
          return;
        }

        // Update the message content
        await message.edit({ content: messages[i] });

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Failed to update message ${messageIds[i]}:`, err);
        throw err;
      }
    }

    // Update last updated timestamp
    await pvpCalendars.updateOne(
      { guildId },
      { $set: { lastUpdated: new Date() } }
    );

    console.log(`✅ Updated PvP calendar for guild ${guildId}`);
  } catch (err) {
    console.error(`Failed to update calendar for guild ${guildId}:`, err);
  }
}

/**
 * Update all calendars across all guilds
 * Used by the background auto-update task
 */
async function updateAllCalendars(client, collections) {
  const { pvpCalendars } = collections;

  try {
    const calendars = await pvpCalendars.find({}).toArray();

    console.log(`Updating ${calendars.length} PvP calendar(s)...`);

    for (const calendar of calendars) {
      await updateCalendar(client, calendar.guildId, collections);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ All PvP calendars updated');
  } catch (err) {
    console.error('Failed to update all calendars:', err);
  }
}

module.exports = { updateCalendar, updateAllCalendars };