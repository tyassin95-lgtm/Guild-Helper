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

  // Add attendance info
  const attendeeCount = event.attendees?.length || 0;

  if (attendeeCount > 0) {
    // Fetch attendee names
    const attendeeNames = [];
    for (const userId of event.attendees) {
      try {
        const member = await client.guilds.cache.get(event.guildId)?.members.fetch(userId);
        if (member) {
          attendeeNames.push(member.displayName);
        } else {
          attendeeNames.push('Unknown User');
        }
      } catch (err) {
        attendeeNames.push('Unknown User');
      }
    }

    const attendeeList = attendeeNames.map(name => `• ${name}`).join('\n');
    const truncated = attendeeList.length > 1024 ? attendeeList.substring(0, 1021) + '...' : attendeeList;

    embed.addFields({
      name: `👥 Attendees (${attendeeCount})`,
      value: truncated,
      inline: false
    });
  } else {
    embed.addFields({
      name: '👥 Attendees',
      value: '*No one has recorded attendance yet*',
      inline: false
    });
  }

  // Add status field
  embed.addFields({
    name: '📊 Status',
    value: event.closed ? '🔒 **Attendance Closed**' : '✅ **Attendance Open**',
    inline: false
  });

  // Create buttons
  const components = [];

  if (!event.closed) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp_record_attendance:${event._id}`)
        .setLabel('Record Attendance')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`pvp_close_attendance:${event._id}`)
        .setLabel('Close Attendance (Admin)')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );
    components.push(row);
  }

  return { embed, components };
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