const { createCalendarMessage } = require('./calendarEmbed');

/**
 * Update the PvP calendar for a specific guild
 * Fetches the calendar message and updates its content
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

    // Fetch the message
    const message = await channel.messages.fetch(calendar.messageId).catch(() => null);

    if (!message) {
      console.warn(`Calendar message ${calendar.messageId} not found in channel ${calendar.channelId}`);
      // Message was deleted, remove calendar from database
      await pvpCalendars.deleteOne({ guildId });
      return;
    }

    // Generate updated message content
    const content = await createCalendarMessage(guildId, client, collections);

    // Update the message
    await message.edit({ content });

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