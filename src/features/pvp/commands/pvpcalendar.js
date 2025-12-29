const { PermissionFlagsBits } = require('discord.js');
const { createCalendarEmbed } = require('../calendar/calendarEmbed');

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
      // Try to fetch the existing calendar message
      try {
        const channel = await interaction.client.channels.fetch(existingCalendar.channelId);
        const message = await channel.messages.fetch(existingCalendar.messageId);

        return interaction.editReply({
          content: `⚠️ **A calendar already exists for this server!**\n\n` +
                   `📍 Location: <#${existingCalendar.channelId}>\n` +
                   `🔗 [Jump to Calendar](${message.url})\n\n` +
                   `If you want to move it to this channel, please delete the existing calendar message first.`
        });
      } catch (err) {
        // Calendar message was deleted, remove from database and continue
        console.log('Existing calendar message not found, creating new one...');
        await pvpCalendars.deleteOne({ guildId: interaction.guildId });
      }
    }

    // Generate the calendar embed
    const embed = await createCalendarEmbed(interaction.guildId, interaction.client, collections);

    // Send the calendar to the current channel
    const calendarMessage = await interaction.channel.send({
      embeds: [embed]
    });

    // Save calendar info to database
    await pvpCalendars.insertOne({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: calendarMessage.id,
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    return interaction.editReply({
      content: `✅ **PvP Calendar created successfully!**\n\n` +
               `📍 The calendar will display events for the next 7 days\n` +
               `🔄 Auto-updates every 5 minutes\n` +
               `⏰ Times shown in each user's local timezone\n` +
               `🔗 Click any time to jump directly to the event\n\n` +
               `[View Calendar](${calendarMessage.url})`
    });
  } catch (err) {
    console.error('Failed to create PvP calendar:', err);
    return interaction.editReply({
      content: '❌ Failed to create calendar. Please check bot permissions and try again.'
    });
  }
}

module.exports = { handlePvPCalendar };