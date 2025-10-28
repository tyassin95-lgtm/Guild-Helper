const { handleCreateBasicModal } = require('../commands/createapplication');
const {
  handleNamingModal,
  handleQuestionModal,
  handleAdvancedModal
} = require('./configButtons');
const { handleBatchAnswerSubmit, handleAnswerSubmit } = require('./applyFlow');
const {
  handleAcceptConfirm,
  handleRejectConfirm
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

  // Batch answer modals (5 questions at a time)
  if (customId.startsWith('app_batch_answer:')) {
    return handleBatchAnswerSubmit({ interaction, collections });
  }

  // Single answer modals (for editing individual questions)
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

  // Ticket action modals
  if (customId.startsWith('app_note_submit:')) {
    return handleNoteSubmit({ interaction, collections });
  }
}

module.exports = { handleApplicationModals };