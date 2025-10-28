const { PermissionFlagsBits, ChannelType } = require('discord.js');

/**
 * Create a new application ticket channel
 */
async function createTicket({ guild, user, panel, collections }) {
  const { applicationTickets, applicationPanels } = collections;

  // Check if user already has an open ticket for this panel
  const existingTicket = await applicationTickets.findOne({
    guildId: guild.id,
    userId: user.id,
    panelId: panel._id.toString(),
    status: { $in: ['open', 'pending'] }
  });

  if (existingTicket) {
    return { error: 'You already have an open application for this position!' };
  }

  // Get the ticket category
  const category = guild.channels.cache.get(panel.config.ticketCategoryId);
  if (!category) {
    return { error: 'Ticket category not found! Please contact an administrator.' };
  }

  // Generate ticket name
  const ticketCount = await applicationTickets.countDocuments({ guildId: guild.id }) + 1;
  const ticketName = panel.config.ticketNameFormat
    .replace('{username}', user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .replace('{number}', ticketCount.toString().padStart(4, '0'))
    .replace('{displayName}', user.displayName.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Create permission overwrites
  const permissionOverwrites = [
    {
      id: guild.id, // @everyone
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id, // Applicant
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ],
      deny: [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages
      ]
    }
  ];

  // Add staff roles
  for (const roleId of panel.config.staffRoleIds) {
    permissionOverwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages
      ]
    });
  }

  // Create the ticket channel
  const ticketChannel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites
  });

  // Create ticket document
  const ticketDoc = {
    guildId: guild.id,
    userId: user.id,
    panelId: panel._id.toString(),
    ticketChannelId: ticketChannel.id,
    status: 'open', // open, pending, accepted, rejected, closed
    createdAt: new Date(),
    lastActivity: new Date(),
    assignedStaffId: null
  };

  const result = await applicationTickets.insertOne(ticketDoc);
  ticketDoc._id = result.insertedId;

  return { success: true, ticket: ticketDoc, channel: ticketChannel };
}

/**
 * Close and optionally archive a ticket
 */
async function closeTicket({ guild, ticketId, archiveChannelId, deleteChannel = false, collections }) {
  const { applicationTickets } = collections;

  const ticket = await applicationTickets.findOne({ _id: ticketId });
  if (!ticket) return { error: 'Ticket not found!' };

  const channel = guild.channels.cache.get(ticket.ticketChannelId);
  if (!channel) return { error: 'Ticket channel not found!' };

  // Update ticket status
  await applicationTickets.updateOne(
    { _id: ticketId },
    {
      $set: {
        status: 'closed',
        closedAt: new Date()
      }
    }
  );

  if (deleteChannel) {
    // Delete the channel
    await channel.delete('Application ticket closed');
    return { success: true, action: 'deleted' };
  } else if (archiveChannelId) {
    // Move to archive category
    const archiveCategory = guild.channels.cache.get(archiveChannelId);
    if (archiveCategory) {
      await channel.setParent(archiveCategory.id, { lockPermissions: false });
      await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: false,
        SendMessages: false
      });
      return { success: true, action: 'archived' };
    }
  }

  // Just close permissions if no archive/delete
  await channel.permissionOverwrites.edit(ticket.userId, {
    ViewChannel: false,
    SendMessages: false
  });

  return { success: true, action: 'closed' };
}

/**
 * Reopen a closed ticket
 */
async function reopenTicket({ guild, ticketId, collections }) {
  const { applicationTickets } = collections;

  const ticket = await applicationTickets.findOne({ _id: ticketId });
  if (!ticket) return { error: 'Ticket not found!' };

  const channel = guild.channels.cache.get(ticket.ticketChannelId);
  if (!channel) return { error: 'Ticket channel not found!' };

  // Update ticket status
  await applicationTickets.updateOne(
    { _id: ticketId },
    {
      $set: {
        status: 'pending',
        lastActivity: new Date()
      },
      $unset: { closedAt: '' }
    }
  );

  // Restore user permissions
  await channel.permissionOverwrites.edit(ticket.userId, {
    ViewChannel: true,
    SendMessages: true
  });

  return { success: true, channel };
}

/**
 * Add a note to a ticket
 */
async function addNote({ ticketId, staffId, noteText, collections }) {
  const { applicationNotes, applicationTickets } = collections;

  const ticket = await applicationTickets.findOne({ _id: ticketId });
  if (!ticket) return { error: 'Ticket not found!' };

  const noteDoc = {
    guildId: ticket.guildId,
    ticketId: ticketId.toString(),
    staffId,
    noteText,
    createdAt: new Date()
  };

  await applicationNotes.insertOne(noteDoc);

  // Update ticket last activity
  await applicationTickets.updateOne(
    { _id: ticketId },
    { $set: { lastActivity: new Date() } }
  );

  return { success: true, note: noteDoc };
}

/**
 * Get all notes for a ticket
 */
async function getTicketNotes({ ticketId, collections }) {
  const { applicationNotes } = collections;

  const notes = await applicationNotes
    .find({ ticketId: ticketId.toString() })
    .sort({ createdAt: 1 })
    .toArray();

  return notes;
}

/**
 * Generate transcript of ticket
 */
async function generateTranscript({ guild, channel, ticket, collections }) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sortedMessages = Array.from(messages.values()).reverse();

  let transcript = `Application Ticket Transcript\n`;
  transcript += `Ticket ID: ${ticket._id}\n`;
  transcript += `Applicant: ${ticket.userId}\n`;
  transcript += `Created: ${ticket.createdAt.toISOString()}\n`;
  transcript += `Status: ${ticket.status}\n`;
  transcript += `\n${'='.repeat(50)}\n\n`;

  for (const msg of sortedMessages) {
    const timestamp = msg.createdAt.toISOString();
    const author = msg.author.tag;
    const content = msg.content || '[No content]';

    transcript += `[${timestamp}] ${author}:\n${content}\n\n`;

    if (msg.embeds.length > 0) {
      transcript += `  [Embed: ${msg.embeds[0].title || 'Untitled'}]\n\n`;
    }
  }

  // Get notes
  const notes = await getTicketNotes({ ticketId: ticket._id, collections });
  if (notes.length > 0) {
    transcript += `\n${'='.repeat(50)}\n`;
    transcript += `Staff Notes:\n\n`;
    for (const note of notes) {
      transcript += `[${note.createdAt.toISOString()}] <@${note.staffId}>:\n${note.noteText}\n\n`;
    }
  }

  return transcript;
}

/**
 * Update ticket last activity
 */
async function updateTicketActivity({ ticketChannelId, collections }) {
  const { applicationTickets } = collections;

  await applicationTickets.updateOne(
    { ticketChannelId },
    { $set: { lastActivity: new Date() } }
  );
}

/**
 * Assign staff member to ticket
 */
async function assignStaff({ ticketId, staffId, collections }) {
  const { applicationTickets } = collections;

  await applicationTickets.updateOne(
    { _id: ticketId },
    {
      $set: {
        assignedStaffId: staffId,
        lastActivity: new Date()
      }
    }
  );

  return { success: true };
}

module.exports = {
  createTicket,
  closeTicket,
  reopenTicket,
  addNote,
  getTicketNotes,
  generateTranscript,
  updateTicketActivity,
  assignStaff
};