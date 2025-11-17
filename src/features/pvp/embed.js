const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function createEventEmbed(event, client, collections) {
  const eventTypeEmojis = {
    siege: '🏰',
    riftstone: '💎',
    boonstone: '🔮'
  };

  const eventTypeNames = {
    siege: 'Siege',
    riftstone: 'Riftstone Fight',
    boonstone: 'Boonstone Fight'
  };

  const emoji = eventTypeEmojis[event.eventType] || '⚔️';
  const typeName = eventTypeNames[event.eventType] || event.eventType;

  const embed = new EmbedBuilder()
    .setColor(event.closed ? '#95a5a6' : '#e74c3c')
    .setTitle(`${emoji} ${typeName}`)
    .setDescription(event.message)
    .setTimestamp();

  if (event.imageUrl) {
    embed.setImage(event.imageUrl);
  }

  // Add location field if applicable
  if (event.location) {
    embed.addFields({
      name: '📍 Location',
      value: event.location,
      inline: true
    });
  }

  // Add time field with Discord timestamp
  const timestamp = Math.floor(event.eventTime.getTime() / 1000);
  embed.addFields({
    name: '⏰ Event Time',
    value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`,
    inline: true
  });

  // Add RSVP Planning section
  const rsvpAttending = event.rsvpAttending || [];
  const rsvpNotAttending = event.rsvpNotAttending || [];
  const rsvpMaybe = event.rsvpMaybe || [];

  const attendingNames = await fetchUserNames(client, event.guildId, rsvpAttending);
  const notAttendingNames = await fetchUserNames(client, event.guildId, rsvpNotAttending);
  const maybeNames = await fetchUserNames(client, event.guildId, rsvpMaybe);

  const attendingText = attendingNames.length > 0 
    ? attendingNames.join(', ') 
    : '*None yet*';
  const notAttendingText = notAttendingNames.length > 0 
    ? notAttendingNames.join(', ') 
    : '*None yet*';
  const maybeText = maybeNames.length > 0 
    ? maybeNames.join(', ') 
    : '*None yet*';

  embed.addFields({
    name: `📊 Planning`,
    value: `✅ **Attending (${attendingNames.length}):** ${attendingText}\n` +
           `❌ **Not Attending (${notAttendingNames.length}):** ${notAttendingText}\n` +
           `❓ **Maybe (${maybeNames.length}):** ${maybeText}`,
    inline: false
  });

  // Add recorded attendance info
  const attendeeCount = event.attendees?.length || 0;

  if (attendeeCount > 0) {
    // Fetch attendee names
    const attendeeNames = await fetchUserNames(client, event.guildId, event.attendees);
    const attendeeList = attendeeNames.map(name => `• ${name}`).join('\n');
    const truncated = attendeeList.length > 1024 ? attendeeList.substring(0, 1021) + '...' : attendeeList;

    embed.addFields({
      name: `🎯 Recorded Attendance (${attendeeCount})`,
      value: truncated,
      inline: false
    });
  } else {
    embed.addFields({
      name: '🎯 Recorded Attendance',
      value: '*No one has recorded attendance yet*',
      inline: false
    });
  }

  // Add status field
  embed.addFields({
    name: '📊 Status',
    value: event.closed ? '🔒 **Event Closed**' : '✅ **Event Open**',
    inline: false
  });

  // Create buttons
  const components = [];

  if (!event.closed) {
    // RSVP buttons row
    const rsvpRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp_rsvp_attending:${event._id}`)
        .setLabel('Attending')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`pvp_rsvp_not_attending:${event._id}`)
        .setLabel('Not Attending')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌'),
      new ButtonBuilder()
        .setCustomId(`pvp_rsvp_maybe:${event._id}`)
        .setLabel('Maybe')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓')
    );

    // Admin/Attendance row
    const adminRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp_record_attendance:${event._id}`)
        .setLabel('Record Attendance')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎯'),
      new ButtonBuilder()
        .setCustomId(`pvp_close_attendance:${event._id}`)
        .setLabel('Close Event (Admin)')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

    components.push(rsvpRow, adminRow);
  }

  return { embed, components };
}

/**
 * Helper function to fetch user display names
 */
async function fetchUserNames(client, guildId, userIds) {
  const names = [];

  try {
    const guild = await client.guilds.fetch(guildId);

    for (const userId of userIds) {
      try {
        const member = await guild.members.fetch(userId);
        if (member) {
          names.push(member.displayName);
        }
      } catch (err) {
        // User might have left the server
        names.push('Unknown User');
      }
    }
  } catch (err) {
    console.error('Failed to fetch guild for user names:', err);
  }

  return names;
}

async function updateEventEmbed(interaction, event, collections) {
  try {
    const channel = await interaction.client.channels.fetch(event.channelId);
    if (!channel) return;

    const message = await channel.messages.fetch(event.messageId);
    if (!message) return;

    const { embed, components } = await createEventEmbed(event, interaction.client, collections);

    await message.edit({
      embeds: [embed],
      components
    });
  } catch (err) {
    console.error('Failed to update event embed:', err);
  }
}

module.exports = { createEventEmbed, updateEventEmbed };