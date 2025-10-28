const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { ObjectId } = require('mongodb');

/**
 * Create a new application ticket
 */
async function createTicket({ guild, user, panel, collections }) {
  const { applicationTickets } = collections;

  try {
    // Generate ticket number
    const ticketCount = await applicationTickets.countDocuments({
      guildId: guild.id,
      panelId: panel._id.toString()
    });

    const ticketNumber = String(ticketCount + 1).padStart(4, '0');

    // Generate ticket name
    let ticketName = panel.config.ticketNameFormat || 'application-{username}-{number}';
    ticketName = ticketName
      .replace('{username}', user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .replace('{displayName}', user.displayName.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .replace('{number}', ticketNumber);

    // Get category
    const category = guild.channels.cache.get(panel.config.ticketCategoryId);
    if (!category) {
      return { error: 'Ticket category not found! Please contact an administrator.' };
    }

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
        ]
      }
    ];

    // Add staff roles
    if (panel.config.staffRoleIds) {
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
    }

    // Create channel
    const channel = await guild.channels.create({
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
      ticketChannelId: channel.id,
      ticketNumber,
      status: 'open',
      createdAt: new Date(),
      lastActivity: new Date()
    };

    const result = await applicationTickets.insertOne(ticketDoc);
    ticketDoc._id = result.insertedId;

    return { success: true, ticket: ticketDoc, channel };
  } catch (error) {
    console.error('Error creating ticket:', error);
    return { error: 'Failed to create ticket. Please try again.' };
  }
}

/**
 * Close a ticket
 */
async function closeTicket({ guild, ticketId, archiveChannelId, deleteChannel, collections }) {
  const { applicationTickets } = collections;

  try {
    const ticket = await applicationTickets.findOne({ _id: ticketId });
    if (!ticket) {
      return { error: 'Ticket not found!' };
    }

    const channel = guild.channels.cache.get(ticket.ticketChannelId);
    if (!channel) {
      return { error: 'Channel not found!' };
    }

    // Update ticket status
    await applicationTickets.updateOne(
      { _id: ticketId },
      {
        $set: {
          status: 'closed',
          closedAt: new Date(),
          lastActivity: new Date()
        }
      }
    );

    // FIXED: Delete the channel if requested
    if (deleteChannel) {
      await channel.delete('Ticket closed');
      return { success: true, action: 'deleted' };
    }

    // Otherwise, archive or lock
    if (archiveChannelId) {
      // Move to archive category
      await channel.setParent(archiveChannelId);
      await channel.lockPermissions();
      return { success: true, action: 'archived' };
    } else {
      // Just lock the channel
      await channel.permissionOverwrites.edit(ticket.userId, {
        SendMessages: false
      });
      return { success: true, action: 'locked' };
    }
  } catch (error) {
    console.error('Error closing ticket:', error);
    return { error: 'Failed to close ticket.' };
  }
}

/**
 * Reopen a ticket
 */
async function reopenTicket({ guild, ticketId, collections }) {
  const { applicationTickets } = collections;

  try {
    const ticket = await applicationTickets.findOne({ _id: ticketId });
    if (!ticket) {
      return { error: 'Ticket not found!' };
    }

    const channel = guild.channels.cache.get(ticket.ticketChannelId);
    if (!channel) {
      return { error: 'Channel not found! It may have been deleted.' };
    }

    // Update ticket status
    await applicationTickets.updateOne(
      { _id: ticketId },
      {
        $set: {
          status: 'open',
          reopenedAt: new Date(),
          lastActivity: new Date()
        }
      }
    );

    // Unlock channel for applicant
    await channel.permissionOverwrites.edit(ticket.userId, {
      SendMessages: true
    });

    return { success: true, channel };
  } catch (error) {
    console.error('Error reopening ticket:', error);
    return { error: 'Failed to reopen ticket.' };
  }
}

/**
 * Add a staff note to a ticket
 */
async function addNote({ ticketId, staffId, noteText, collections }) {
  const { applicationNotes } = collections;

  try {
    const note = {
      ticketId: ticketId.toString(),
      staffId,
      noteText,
      createdAt: new Date()
    };

    await applicationNotes.insertOne(note);
    return { success: true };
  } catch (error) {
    console.error('Error adding note:', error);
    return { error: 'Failed to add note.' };
  }
}

/**
 * Get all notes for a ticket
 */
async function getTicketNotes({ ticketId, collections }) {
  const { applicationNotes } = collections;

  try {
    const notes = await applicationNotes
      .find({ ticketId: ticketId.toString() })
      .sort({ createdAt: -1 })
      .toArray();

    return notes;
  } catch (error) {
    console.error('Error getting notes:', error);
    return [];
  }
}

/**
 * Assign a staff member to a ticket
 */
async function assignStaff({ ticketId, staffId, collections }) {
  const { applicationTickets } = collections;

  try {
    await applicationTickets.updateOne(
      { _id: ticketId },
      {
        $set: {
          assignedStaffId: staffId,
          assignedAt: new Date(),
          lastActivity: new Date()
        }
      }
    );

    return { success: true };
  } catch (error) {
    console.error('Error assigning staff:', error);
    return { error: 'Failed to assign staff.' };
  }
}

/**
 * Update ticket activity timestamp
 */
async function updateTicketActivity({ ticketId, collections }) {
  const { applicationTickets } = collections;

  try {
    await applicationTickets.updateOne(
      { _id: ticketId },
      { $set: { lastActivity: new Date() } }
    );
  } catch (error) {
    console.error('Error updating ticket activity:', error);
  }
}

/**
 * Generate ticket transcript
 */
async function generateTranscript({ guild, channel, ticket, collections }) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMessages = Array.from(messages.values()).reverse();

    let transcript = `Ticket Transcript: ${channel.name}\n`;
    transcript += `Ticket ID: ${ticket._id}\n`;
    transcript += `Created: ${ticket.createdAt.toISOString()}\n`;
    transcript += `User: ${ticket.userId}\n`;
    transcript += `Status: ${ticket.status}\n`;
    transcript += `\n${'='.repeat(50)}\n\n`;

    for (const msg of sortedMessages) {
      const timestamp = msg.createdAt.toISOString();
      const author = `${msg.author.tag} (${msg.author.id})`;
      const content = msg.content || '[No content]';

      transcript += `[${timestamp}] ${author}:\n${content}\n`;

      if (msg.embeds.length > 0) {
        transcript += `  [Embeds: ${msg.embeds.length}]\n`;
      }

      if (msg.attachments.size > 0) {
        transcript += `  [Attachments: ${Array.from(msg.attachments.values()).map(a => a.url).join(', ')}]\n`;
      }

      transcript += '\n';
    }

    return transcript;
  } catch (error) {
    console.error('Error generating transcript:', error);
    return 'Error generating transcript.';
  }
}

module.exports = {
  createTicket,
  closeTicket,
  reopenTicket,
  addNote,
  getTicketNotes,
  assignStaff,
  updateTicketActivity,
  generateTranscript
};