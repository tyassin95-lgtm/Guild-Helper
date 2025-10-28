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

/**
 * Handle add note button
 */
async function handleAddNote({ interaction, collections }) {
  const ticketId = interaction.customId.split(':')[1];

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
}