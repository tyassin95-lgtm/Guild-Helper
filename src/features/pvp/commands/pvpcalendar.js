const { PermissionFlagsBits } = require('discord.js');
const { createCalendarMessages } = require('../calendar/calendarEmbed');

async function handlePvPCalendar({ interaction, collections }) {
  const { pvpCalendars } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    // Check if calendar already exists for this guild
    const existingCalendar = await pvpCalendars.findOne({ guildId: interaction.guildId });

    if (existingCalendar) {
      // Try to fetch the existing calendar messages
      try {
        const channel = await interaction.client.channels.fetch(existingCalendar.channelId);
        const messageIds = existingCalendar.messageIds || [];

        if (messageIds.length > 0) {
          const firstMessage = await channel.messages.fetch(messageIds[0]);

          return interaction.editReply({
            content: `⚠️ **A calendar already exists for this server!**\n\n` +
                     `📍 Location: <#${existingCalendar.channelId}>\n` +
                     `🔗 [Jump to Calendar](${firstMessage.url})\n\n` +
                     `If you want to move it to this channel, please delete the existing calendar messages first.`
          });
        }
      } catch (err) {
        // Calendar messages were deleted, remove from database and continue
        console.log('Existing calendar messages not found, creating new one...');
        await pvpCalendars.deleteOne({ guildId: interaction.guildId });
      }
    }

    // Generate the calendar message contents (header + 7 days = 8 messages)
    const messages = await createCalendarMessages(interaction.guildId, interaction.client, collections);

    // Send all messages to the current channel
    const messageIds = [];
    const sentMessages = [];

    for (let i = 0; i < messages.length; i++) {
      const sentMessage = await interaction.channel.send({ content: messages[i] });
      messageIds.push(sentMessage.id);
      sentMessages.push(sentMessage);

      // Small delay between messages to avoid rate limits
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Save calendar info to database with all message IDs
    await pvpCalendars.insertOne({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageIds: messageIds, // Array of message IDs [header, day0, day1, ..., day6]
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    return interaction.editReply({
      content: `✅ **PvP Calendar created successfully!**\n\n` +
               `📍 The calendar will display events for the next 7 days\n` +
               `🔄 Auto-updates every 15 minutes\n` +
               `⏰ Times shown in each user's local timezone\n` +
               `🔗 Click any time to jump directly to the event\n\n` +
               `[View Calendar](${sentMessages[0].url})\n\n` +
               `**Note:** The calendar is split into ${messages.length} messages (header + one per day) to avoid Discord's character limit.`
    });
  } catch (err) {
    console.error('Failed to create PvP calendar:', err);
    return interaction.editReply({
      content: '❌ Failed to create calendar. Please check bot permissions and try again.'
    });
  }
}

module.exports = { handlePvPCalendar };