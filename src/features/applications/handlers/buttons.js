const { handleCreateBasicModal } = require('../commands/createapplication');
const {
  handleConfigCategory,
  handleConfigRoles,
  handleConfigNaming,
  handleConfigQuestions,
  handleConfigAdvanced,
  handleConfigPreview,
  handleConfigFinish,
  handleConfigCancel,
  handleRemoveLastQuestion
} = require('./configButtons');
const {
  handleApplyButton,
  handleStartApplication,
  handleNextBatch,
  handleEditAnswers
} = require('./applyFlow');
const {
  handleAccept,
  handleAcceptWithMessage,
  handleAcceptDefault,
  handleReject,
  handleFinalSubmit
} = require('./reviewFlow');
const {
  handleAddNote,
  handleViewNotes,
  handleCloseTicket,
  handleCloseConfirm,
  handleCloseCancel,
  handleReopenTicket,
  handleAssignStaff,
  handleGenerateTranscript
} = require('./ticketActions');
const { handleDeleteConfirm } = require('../commands/deleteapplication');

/**
 * Main button handler for application system
 */
async function handleApplicationButtons({ interaction, collections }) {
  const customId = interaction.customId;

  // Configuration buttons
  if (customId === 'app_config_category') {
    return handleConfigCategory({ interaction, collections });
  }
  if (customId === 'app_config_roles') {
    return handleConfigRoles({ interaction, collections });
  }
  if (customId === 'app_config_naming') {
    return handleConfigNaming({ interaction, collections });
  }
  if (customId === 'app_config_questions') {
    return handleConfigQuestions({ interaction, collections });
  }
  if (customId === 'app_question_remove_last') {
    return handleRemoveLastQuestion({ interaction, collections });
  }
  if (customId === 'app_config_advanced') {
    return handleConfigAdvanced({ interaction, collections });
  }
  if (customId === 'app_config_preview') {
    return handleConfigPreview({ interaction, collections });
  }
  if (customId === 'app_config_finish') {
    return handleConfigFinish({ interaction, collections });
  }
  if (customId === 'app_config_cancel') {
    return handleConfigCancel({ interaction, collections });
  }

  // Apply flow buttons
  if (customId === 'app_apply') {
    return handleApplyButton({ interaction, collections });
  }
  if (customId.startsWith('app_start:')) {
    return handleStartApplication({ interaction, collections });
  }
  if (customId.startsWith('app_next_batch:')) {
    return handleNextBatch({ interaction, collections });
  }
  if (customId === 'app_edit_answers') {
    return handleEditAnswers({ interaction, collections });
  }
  if (customId === 'app_submit_final') {
    return handleFinalSubmit({ interaction, collections });
  }
  if (customId === 'app_review_cancel') {
    return interaction.update({ 
      content: '❌ Application cancelled.', 
      components: [] 
    });
  }

  // Review buttons
  if (customId.startsWith('app_accept:')) {
    return handleAccept({ interaction, collections });
  }
  if (customId.startsWith('app_accept_message:')) {
    return handleAcceptWithMessage({ interaction, collections });
  }
  if (customId.startsWith('app_accept_default:')) {
    return handleAcceptDefault({ interaction, collections });
  }
  if (customId.startsWith('app_reject:')) {
    return handleReject({ interaction, collections });
  }
  // REMOVED: Interview button handler - feature removed

  // Ticket action buttons
  if (customId.startsWith('app_add_note:')) {
    return handleAddNote({ interaction, collections });
  }
  if (customId.startsWith('app_view_notes:')) {
    return handleViewNotes({ interaction, collections });
  }
  if (customId.startsWith('app_close:')) {
    return handleCloseTicket({ interaction, collections });
  }
  if (customId.startsWith('app_close_confirm:')) {
    return handleCloseConfirm({ interaction, collections });
  }
  if (customId === 'app_close_cancel') {
    return handleCloseCancel({ interaction, collections });
  }
  if (customId.startsWith('app_reopen:')) {
    return handleReopenTicket({ interaction, collections });
  }
  if (customId.startsWith('app_assign:')) {
    return handleAssignStaff({ interaction, collections });
  }
  if (customId.startsWith('app_transcript:')) {
    return handleGenerateTranscript({ interaction, collections });
  }

  // Delete confirmation
  if (customId.startsWith('app_delete_confirm:')) {
    return handleDeleteConfirm({ interaction, collections });
  }
  if (customId === 'app_delete_cancel') {
    return interaction.update({
      content: '❌ Deletion cancelled.',
      components: []
    });
  }

  // Toggle active status (from edit panel)
  if (customId.startsWith('app_toggle_active:')) {
    const { handleToggleActive } = require('./selects');
    return handleToggleActive({ interaction, collections });
  }
}

module.exports = { handleApplicationButtons };