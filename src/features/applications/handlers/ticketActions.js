const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');
const { ObjectId } = require('mongodb');
const { addNote, getTicketNotes, closeTicket, reopenTicket, generateTranscript } = require('../utils/ticketManager');
const { formatNotesEmbed } = require('../utils/applicationFormatter');
const { isStaff } = require('../utils/permissions');

/**
 * Handle add note button
 */
async function handleAddNote({ interaction, collections }) {
  const { applicationTickets, applicationPanels } = collections;

  try {
    const ticketId = interaction.customId.split(':')[1];

    const ticket = await applicationTickets.findOne({ _id: new ObjectId(ticketId) });
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(ticket.panelId) });

    // Check if user is staff
    if (!isStaff(interaction.member, panel)) {
      return interaction.reply({
        content: '❌ You do not have permission to add notes!',
        flags: [64]
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`app_note_submit:${ticketId}`)
      .setTitle('Add Staff Note');

    const noteInput = new TextInputBuilder()
      .setCustomId('note')
      .setLabel('Note (visible only to staff)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Add your observations, concerns, or comments...')
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(noteInput));

    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error in handleAddNote:', error);
    return interaction.reply({
      content: '❌ An error occurred.',
      flags: [64]
    });
  }
}

/**
 * Handle note submission
 */
async function handleNoteSubmit({ interaction, collections }) {
  try {
    const ticketId = interaction.customId.split(':')[1];
    const noteText = interaction.fields.getTextInputValue('note');

    await interaction.deferReply({ flags: [64] });

    const result = await addNote({
      ticketId: new ObjectId(ticketId),
      staffId: interaction.user.id,
      noteText,
      collections
    });

    if (result.error) {
      return interaction.editReply({ content: `❌ ${result.error}` });
    }

    await interaction.editReply({
      content: '✅ Note added successfully!'
    });
  } catch (error) {
    console.error('Error in handleNoteSubmit:', error);
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ An error occurred while adding the note.'
      });
    }
  }
}

/**
 * Handle view notes button
 */
async function handleViewNotes({ interaction, collections }) {
  const { applicationTickets, applicationPanels } = collections;

  try {
    const ticketId = interaction.customId.split(':')[1];

    const ticket = await applicationTickets.findOne({ _id: new ObjectId(ticketId) });
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(ticket.panelId) });

    // Check if user is staff
    if (!isStaff(interaction.member, panel)) {
      return interaction.reply({
        content: '❌ You do not have permission to view notes!',
        flags: [64]
      });
    }

    await interaction.deferReply({ flags: [64] });

    const notes = await getTicketNotes({
      ticketId: new ObjectId(ticketId),
      collections
    });

    const embed = formatNotesEmbed(notes, interaction.guild);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleViewNotes:', error);
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ An error occurred while fetching notes.'
      });
    } else {
      return interaction.reply({
        content: '❌ An error occurred.',
        flags: [64]
      });
    }
  }
}

/**
 * Handle close ticket button
 */
async function handleCloseTicket({ interaction, collections }) {
  const { applicationTickets, applicationPanels } = collections;

  try {
    const ticketId = interaction.customId.split(':')[1];

    const ticket = await applicationTickets.findOne({ _id: new ObjectId(ticketId) });
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(ticket.panelId) });

    // Check if user is staff
    if (!isStaff(interaction.member, panel)) {
      return interaction.reply({
        content: '❌ You do not have permission to close tickets!',
        flags: [64]
      });
    }

    // Show confirmation
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_close_confirm:${ticketId}`)
        .setLabel('Confirm Close')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId('app_close_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌')
    );

    await interaction.reply({
      content: '⚠️ **Are you sure you want to close this ticket?**\n\nThe channel will be archived or deleted based on panel configuration.',
      components: [row],
      flags: [64]
    });
  } catch (error) {
    console.error('Error in handleCloseTicket:', error);
    return interaction.reply({
      content: '❌ An error occurred.',
      flags: [64]
    });
  }
}

/**
 * Handle close confirmation
 */
async function handleCloseConfirm({ interaction, collections }) {
  const { applicationTickets, applicationPanels } = collections;

  try {
    const ticketId = interaction.customId.split(':')[1];

    const ticket = await applicationTickets.findOne({ _id: new ObjectId(ticketId) });
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(ticket.panelId) });
    const archiveChannelId = panel?.config?.archiveCategoryId || null;

    // FIXED: Reply with success message BEFORE deleting, then delete after a delay
    await interaction.reply({
      content: '✅ Closing ticket... This channel will be deleted in 3 seconds.',
      flags: [64]
    });

    // Wait 3 seconds so user can see the message
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Now delete the channel
    const result = await closeTicket({
      guild: interaction.guild,
      ticketId: new ObjectId(ticketId),
      archiveChannelId,
      deleteChannel: true,
      collections
    });

    // Note: We can't edit the reply after channel deletion, so we just let it delete
    // The success message was already shown to the user

  } catch (error) {
    console.error('Error in handleCloseConfirm:', error);

    // Try to send error message if interaction hasn't expired
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while closing the ticket.',
          flags: [64]
        });
      } else if (interaction.channel && !interaction.channel.deleted) {
        // If we already replied but channel still exists, just send a new message
        await interaction.channel.send({
          content: '❌ An error occurred while closing the ticket.'
        });
      }
    } catch (replyError) {
      // If we can't send any message, just log it
      console.error('Could not send error message (channel may be deleted):', replyError.message);
    }
  }
}

/**
 * Handle close cancel
 */
async function handleCloseCancel({ interaction, collections }) {
  try {
    await interaction.update({
      content: '❌ Ticket closure cancelled.',
      components: []
    });
  } catch (error) {
    console.error('Error in handleCloseCancel:', error);
  }
}

/**
 * Handle reopen ticket
 */
async function handleReopenTicket({ interaction, collections }) {
  const { applicationTickets, applicationPanels } = collections;

  try {
    const ticketId = interaction.customId.split(':')[1];

    const ticket = await applicationTickets.findOne({ _id: new ObjectId(ticketId) });
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(ticket.panelId) });

    // Check if user is staff
    if (!isStaff(interaction.member, panel)) {
      return interaction.reply({
        content: '❌ You do not have permission to reopen tickets!',
        flags: [64]
      });
    }

    await interaction.deferReply({ flags: [64] });

    const result = await reopenTicket({
      guild: interaction.guild,
      ticketId: new ObjectId(ticketId),
      collections
    });

    if (result.error) {
      return interaction.editReply({ content: `❌ ${result.error}` });
    }

    await interaction.editReply({
      content: '✅ Ticket has been reopened!'
    });

    // Send reopened message
    const channel = result.channel;
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('🔓 Ticket Reopened')
        .setDescription(`This ticket has been reopened by ${interaction.user.tag}.`)
        .setColor(0x57F287)
        .setTimestamp();

      await channel.send({
        content: `<@${ticket.userId}>`,
        embeds: [embed]
      });
    }
  } catch (error) {
    console.error('Error in handleReopenTicket:', error);
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ An error occurred while reopening the ticket.'
      });
    } else {
      return interaction.reply({
        content: '❌ An error occurred.',
        flags: [64]
      });
    }
  }
}

/**
 * Handle assign staff
 */
async function handleAssignStaff({ interaction, collections }) {
  const { applicationTickets, applicationPanels } = collections;

  try {
    const ticketId = interaction.customId.split(':')[1];

    const ticket = await applicationTickets.findOne({ _id: new ObjectId(ticketId) });
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(ticket.panelId) });

    // Check if user is staff
    if (!isStaff(interaction.member, panel)) {
      return interaction.reply({
        content: '❌ You do not have permission to assign staff!',
        flags: [64]
      });
    }

    await interaction.deferReply({ flags: [64] });

    // Assign the interaction user to the ticket
    const { assignStaff } = require('../utils/ticketManager');

    await assignStaff({
      ticketId: new ObjectId(ticketId),
      staffId: interaction.user.id,
      collections
    });

    await interaction.editReply({
      content: `✅ You have been assigned to this ticket!`
    });

    // Send notification in ticket
    const channel = interaction.guild.channels.cache.get(ticket.ticketChannelId);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('👨‍💼 Staff Assigned')
        .setDescription(`${interaction.user} has been assigned to this application.`)
        .setColor(0x5865F2)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('Error in handleAssignStaff:', error);
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ An error occurred while assigning staff.'
      });
    } else {
      return interaction.reply({
        content: '❌ An error occurred.',
        flags: [64]
      });
    }
  }
}

/**
 * Handle generate transcript
 */
async function handleGenerateTranscript({ interaction, collections }) {
  const { applicationTickets, applicationPanels } = collections;

  try {
    const ticketId = interaction.customId.split(':')[1];

    const ticket = await applicationTickets.findOne({ _id: new ObjectId(ticketId) });
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(ticket.panelId) });

    // Check if user is staff
    if (!isStaff(interaction.member, panel)) {
      return interaction.reply({
        content: '❌ You do not have permission to generate transcripts!',
        flags: [64]
      });
    }

    await interaction.deferReply({ flags: [64] });

    const channel = interaction.guild.channels.cache.get(ticket.ticketChannelId);
    if (!channel) {
      return interaction.editReply({
        content: '❌ Ticket channel not found!'
      });
    }

    // Generate transcript
    const transcriptText = await generateTranscript({
      guild: interaction.guild,
      channel,
      ticket,
      collections
    });

    // Create attachment
    const attachment = new AttachmentBuilder(
      Buffer.from(transcriptText, 'utf-8'),
      { name: `transcript-${ticket._id}.txt` }
    );

    await interaction.editReply({
      content: '✅ **Transcript Generated**',
      files: [attachment]
    });
  } catch (error) {
    console.error('Error in handleGenerateTranscript:', error);
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ An error occurred while generating the transcript.'
      });
    } else {
      return interaction.reply({
        content: '❌ An error occurred.',
        flags: [64]
      });
    }
  }
}

module.exports = {
  handleAddNote,
  handleNoteSubmit,
  handleViewNotes,
  handleCloseTicket,
  handleCloseConfirm,
  handleCloseCancel,
  handleReopenTicket,
  handleAssignStaff,
  handleGenerateTranscript
};