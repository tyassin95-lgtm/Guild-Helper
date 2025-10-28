const { handleCreateBasicModal } = require('../commands/createapplication');
const {
  handleNamingModal,
  handleQuestionModal,
  handleAdvancedModal
} = require('./configButtons');
const { handleAnswerSubmit } = require('./applyFlow');
const {
  handleAcceptConfirm,
  handleRejectConfirm,
  handleInterviewMessage
} = require('./reviewFlow');
const { handleNoteSubmit } = require('./ticketActions');

/**
 * Main modal handler for application system
 */
async function handleApplicationModals({ interaction, collections }) {
  const customId = interaction.customId;

  // Configuration modals
  if (customId === 'app_create_basic') {
    return handleCreateBasicModal({ interaction, collections });
  }
  if (customId === 'app_modal_naming') {
    return handleNamingModal({ interaction, collections });
  }
  if (customId === 'app_modal_question') {
    return handleQuestionModal({ interaction, collections });
  }
  if (customId === 'app_modal_advanced') {
    return handleAdvancedModal({ interaction, collections });
  }

  // Application answer modals
  if (customId.startsWith('app_answer:')) {
    return handleAnswerSubmit({ interaction, collections });
  }

  // Review modals
  if (customId.startsWith('app_accept_confirm:')) {
    return handleAcceptConfirm({ interaction, collections });
  }
  if (customId.startsWith('app_reject_confirm:')) {
    return handleRejectConfirm({ interaction, collections });
  }
  if (customId.startsWith('app_interview_msg:')) {
    return handleInterviewMessage({ interaction, collections });
  }

  // Ticket action modals
  if (customId.startsWith('app_note_submit:')) {
    return handleNoteSubmit({ interaction, collections });
  }
}

module.exports = { handleApplicationModals };