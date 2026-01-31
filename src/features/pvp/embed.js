const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ObjectId } = require('mongodb');

async function createEventEmbed(event, client, collections, userId = null) {
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
  const bonusPoints = event.bonusPoints || 10;

  // Determine user's RSVP status if userId provided
  let userRSVPStatus = null;
  if (userId) {
    const rsvpAttending = event.rsvpAttending || [];
    const rsvpMaybe = event.rsvpMaybe || [];
    const rsvpNotAttending = event.rsvpNotAttending || [];

    if (rsvpAttending.includes(userId)) {
      userRSVPStatus = 'attending';
    } else if (rsvpMaybe.includes(userId)) {
      userRSVPStatus = 'maybe';
    } else if (rsvpNotAttending.includes(userId)) {
      userRSVPStatus = 'not_attending';
    }
  }

  // Calculate signup deadline (20 minutes before event)
  const signupDeadline = new Date(event.eventTime.getTime() - (20 * 60 * 1000));
  const signupDeadlineTimestamp = Math.floor(signupDeadline.getTime() / 1000);
  const isSignupClosed = new Date() >= signupDeadline;

  const embed = new EmbedBuilder()
    .setColor(event.closed ? '#95a5a6' : '#e74c3c')
    .setTitle(`${emoji} ${typeName}`)
    .setDescription(
      `${event.message}\n\n` +
      `⏰ **Signup Deadline:** <t:${signupDeadlineTimestamp}:F> (<t:${signupDeadlineTimestamp}:R>)\n` +
      `${isSignupClosed ? '🔒 **Signups are now CLOSED** - You must have signed up to record attendance' : '✅ Signups are open'}`
    )
    .setTimestamp();

  // Only set image if URL exists and is not empty
  if (event.imageUrl && event.imageUrl.trim().length > 0) {
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

  // Add bonus points field
  embed.addFields({
    name: '🎁 Bonus Points',
    value: `**+${bonusPoints}** points for attendance`,
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

  // Add party formation status if parties have been formed
  if (event.partiesFormed) {
    const timestamp = Math.floor(event.partiesFormedAt.getTime() / 1000);
    embed.addFields({
      name: '👥 Event Parties',
      value: `✅ Parties formed and sent (<t:${timestamp}:R>)`,
      inline: false
    });
  }

  // Add status field
  let statusText = event.closed ? '🔒 **Event Closed**' : '✅ **Event Open**';
  if (!event.closed && isSignupClosed) {
    statusText += '\n🔒 **Signups Closed** (20 min before event)';
  }

  embed.addFields({
    name: '📊 Status',
    value: statusText,
    inline: false
  });

  // Create buttons with personalized labels based on user's RSVP status
  const components = [];

  if (!event.closed) {
    // Row 1: RSVP buttons with BIG VISIBLE indicators showing user's current status
    const rsvpRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp_rsvp_attending:${event._id}`)
        .setLabel(userRSVPStatus === 'attending' ? '✅ ATTENDING (YOU!)' : 'Attending')
        .setStyle(userRSVPStatus === 'attending' ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('✅')
        .setDisabled(isSignupClosed),
      new ButtonBuilder()
        .setCustomId(`pvp_rsvp_not_attending:${event._id}`)
        .setLabel(userRSVPStatus === 'not_attending' ? '❌ NOT ATTENDING (YOU!)' : 'Not Attending')
        .setStyle(userRSVPStatus === 'not_attending' ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setEmoji('❌')
        .setDisabled(isSignupClosed),
      new ButtonBuilder()
        .setCustomId(`pvp_rsvp_maybe:${event._id}`)
        .setLabel(userRSVPStatus === 'maybe' ? '❓ MAYBE (YOU!)' : 'Maybe')
        .setStyle(userRSVPStatus === 'maybe' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('❓')
        .setDisabled(isSignupClosed)
    );

    // Row 2: Attendance recording button
    const attendanceRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp_record_attendance:${event._id}`)
        .setLabel('Record Attendance')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎯')
    );

    // Row 3: Admin controls
    const adminRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp_view_code:${event._id}`)
        .setLabel('View Code')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔐'),
      new ButtonBuilder()
        .setCustomId(`pvp_close_attendance:${event._id}`)
        .setLabel('Close Event')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId(`pvp_form_parties:${event._id}`)
        .setLabel('Form Event Parties')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👥')
    );

    components.push(rsvpRow, attendanceRow, adminRow);
  } else {
    // For closed events, show admin manual attendance button
    const closedAdminRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp_manual_attendance:${event._id}`)
        .setLabel('Manually Record Attendance (Admin)')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId(`pvp_view_code:${event._id}`)
        .setLabel('View Code')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔐'),
      new ButtonBuilder()
        .setCustomId(`pvp_form_parties:${event._id}`)
        .setLabel('Form Event Parties')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👥')
    );

    components.push(closedAdminRow);
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

/**
 * Clean up orphaned event from database
 * Called when the event message no longer exists in Discord
 */
async function cleanupOrphanedEvent(eventId, collections) {
  const { pvpEvents } = collections;

  try {
    const result = await pvpEvents.deleteOne({ _id: new ObjectId(eventId) });
    if (result.deletedCount > 0) {
      console.log(`✅ Cleaned up orphaned PvP event ${eventId} from database`);
      return true;
    } else {
      console.warn(`Event ${eventId} not found in database during cleanup`);
      return false;
    }
  } catch (err) {
    console.error(`Failed to cleanup orphaned event ${eventId}:`, err);
    return false;
  }
}

/**
 * Update event embed with automatic cleanup if message is deleted
 * NOW SUPPORTS PERSONALIZED BUTTONS - pass interaction to get userId
 */
async function updateEventEmbed(interaction, event, collections) {
  try {
    // Try to fetch the channel
    const channel = await interaction.client.channels.fetch(event.channelId).catch(() => null);

    if (!channel) {
      console.warn(`Channel ${event.channelId} not found for event ${event._id} - cleaning up`);
      await cleanupOrphanedEvent(event._id, collections);
      return;
    }

    // Try to fetch the message
    const message = await channel.messages.fetch(event.messageId).catch(() => null);

    if (!message) {
      console.warn(`Message ${event.messageId} not found for event ${event._id} - cleaning up`);
      await cleanupOrphanedEvent(event._id, collections);
      return;
    }

    // Message exists, update it with personalized buttons for the user who triggered the update
    const userId = interaction?.user?.id || null;
    const { embed, components } = await createEventEmbed(event, interaction.client, collections, userId);

    await message.edit({
      embeds: [embed],
      components
    });

    console.log(`✅ Updated PvP event embed ${event._id}`);
  } catch (err) {
    // Handle specific Discord API errors
    if (err.code === 10008) {
      // Unknown Message - message was deleted
      console.warn(`Event message ${event.messageId} was deleted - cleaning up event ${event._id}`);
      await cleanupOrphanedEvent(event._id, collections);
    } else if (err.code === 10003) {
      // Unknown Channel - channel was deleted
      console.warn(`Event channel ${event.channelId} was deleted - cleaning up event ${event._id}`);
      await cleanupOrphanedEvent(event._id, collections);
    } else if (err.code === 50001) {
      // Missing Access - bot can't access the channel
      console.warn(`Bot lacks access to channel ${event.channelId} - cleaning up event ${event._id}`);
      await cleanupOrphanedEvent(event._id, collections);
    } else if (err.code === 50013) {
      // Missing Permissions - bot can't edit the message
      console.error(`Bot lacks permissions to edit message ${event.messageId} in channel ${event.channelId}`);
      // Don't cleanup in this case - permission issue might be temporary
    } else {
      // Unknown error
      console.error('Failed to update event embed:', err);
    }
  }
}
module.exports = { createEventEmbed, updateEventEmbed, cleanupOrphanedEvent };``````