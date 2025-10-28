// src/bot/handlers/interaction.js - COMPLETE FILE WITH APPLICATION SYSTEM
const { handleCreatePanel } = require('./commands/createpanel');
const { handleMyWishlist } = require('./commands/mywishlist');
const { handleSummary } = require('./commands/summary');
const { handleGrantTokens } = require('./commands/granttokens');
const { handleRemoveTokens } = require('./commands/removetokens');
const { handleResetUser } = require('./commands/resetuser');
const { handleResetAll, handleResetAllConfirmation } = require('./commands/resetall');
const { handleStats } = require('./commands/stats');
const { handleSummaryLive } = require('./commands/summarylive');
const { handleFreeze, handleFreezeStatus, handleFreezeModal, handleFreezeBossSelection } = require('./commands/freeze');
const { handleRemind } = require('./commands/remind');
const { handleExcludeRole } = require('./commands/excluderole');

const { handleButtons } = require('./buttons');
const { handleSelects } = require('./selects');

// Party system imports
const { handleMyInfo } = require('../../features/parties/commands/myinfo');
const { handleViewParties } = require('../../features/parties/commands/viewparties');
const { handlePlayerList } = require('../../features/parties/commands/playerlist');
const { handlePartiesPanel } = require('../../features/parties/commands/partiespanel');
const { handleAutoAssign } = require('../../features/parties/commands/autoassign');
const { handleResetParties, handleResetPartiesConfirmation } = require('../../features/parties/commands/resetparties');
const { handleRemindParty } = require('../../features/parties/commands/remindparty');
const { handleViewReserve } = require('../../features/parties/commands/viewreserve');
const { handlePartyButtons } = require('../../features/parties/handlers/buttons');
const { handlePartySelects } = require('../../features/parties/handlers/selects');
const { handlePartyModals } = require('../../features/parties/handlers/modals');
const { handlePartyManageButtons } = require('../../features/parties/handlers/manageButtons');

// PvP system imports
const { handlePvPEvent } = require('../../features/pvp/commands/pvpevent');
const { handleResetBonuses, handleResetBonusesConfirmation } = require('../../features/pvp/commands/resetbonuses');
const { handlePvPButtons } = require('../../features/pvp/handlers/buttons');
const { handlePvPSelects } = require('../../features/pvp/handlers/selects');
const { handlePvPModals } = require('../../features/pvp/handlers/modals');

// Application system imports
const { handleCreateApplication, handleCreateBasicModal } = require('../../features/applications/commands/createapplication');
const { handleDeleteApplication } = require('../../features/applications/commands/deleteapplication');
const { handleEditApplication } = require('../../features/applications/commands/editapplication');
const { handleApplicationStats } = require('../../features/applications/commands/applicationstats');
const { handleApplicationHistory } = require('../../features/applications/commands/applicationhistory');
const { handleBlacklist } = require('../../features/applications/commands/blacklist');
const { handleClearOldTickets } = require('../../features/applications/commands/clearoldtickets');
const { handleApplicationButtons } = require('../../features/applications/handlers/buttons');
const { handleApplicationSelects } = require('../../features/applications/handlers/selects');
const { handleApplicationModals } = require('../../features/applications/handlers/modals');
const { 
  handleApplyButton,
  handleStartApplication,
  handleAnswerSubmit,
  handleNextQuestion,
  handleEditAnswers,
  handleEditQuestionSelect
} = require('../../features/applications/handlers/applyFlow');
const {
  handleFinalSubmit,
  handleAccept,
  handleAcceptConfirm,
  handleReject,
  handleRejectConfirm,
  handleInterview
} = require('../../features/applications/handlers/reviewFlow');

// Safe execution wrapper
const { safeExecute } = require('../../utils/safeExecute');

async function onInteractionCreate({ client, interaction, db, collections }) {
  // Wrap everything in safeExecute for automatic error handling
  await safeExecute(interaction, async () => {

    // Chat Input Commands
    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;

      // Wishlist commands
      if (name === 'createpanel') return handleCreatePanel({ interaction, collections });
      if (name === 'mywishlist')  return handleMyWishlist({ interaction, collections });
      if (name === 'summary')     return handleSummary({ interaction, collections });
      if (name === 'summarylive') return handleSummaryLive({ interaction, collections });
      if (name === 'stats')       return handleStats({ interaction, collections });
      if (name === 'granttokens') return handleGrantTokens({ interaction, collections });
      if (name === 'removetokens')return handleRemoveTokens({ interaction, collections });
      if (name === 'resetuser')   return handleResetUser({ interaction, collections });
      if (name === 'resetall')    return handleResetAll({ interaction, collections });
      if (name === 'freeze')      return handleFreeze({ interaction, collections });
      if (name === 'freezestatus')return handleFreezeStatus({ interaction, collections });
      if (name === 'remind')      return handleRemind({ interaction, collections });
      if (name === 'excluderole') return handleExcludeRole({ interaction, collections });

      // Party commands
      if (name === 'myinfo')      return handleMyInfo({ interaction, collections });
      if (name === 'viewparties') return handleViewParties({ interaction, collections });
      if (name === 'playerlist')  return handlePlayerList({ interaction, collections });
      if (name === 'partiespanel') return handlePartiesPanel({ interaction, collections });
      if (name === 'autoassign')  return handleAutoAssign({ interaction, collections });
      if (name === 'resetparties') return handleResetParties({ interaction, collections });
      if (name === 'remindparty') return handleRemindParty({ interaction, collections });
      if (name === 'viewreserve') return handleViewReserve({ interaction, collections });

      // PvP commands
      if (name === 'pvpevent')    return handlePvPEvent({ interaction, collections });
      if (name === 'resetbonuses') return handleResetBonuses({ interaction, collections });

      // Application commands
      if (name === 'createapplication')   return handleCreateApplication({ interaction, collections });
      if (name === 'deleteapplication')   return handleDeleteApplication({ interaction, collections });
      if (name === 'editapplication')     return handleEditApplication({ interaction, collections });
      if (name === 'applicationstats')    return handleApplicationStats({ interaction, collections });
      if (name === 'applicationhistory')  return handleApplicationHistory({ interaction, collections });
      if (name === 'blacklist')           return handleBlacklist({ interaction, collections });
      if (name === 'clearoldtickets')     return handleClearOldTickets({ interaction, collections });
    }

    // Button Interactions
    if (interaction.isButton()) {
      // Freeze finish selection button
      if (interaction.customId === 'freeze_finish_selection') {
        const { handleFreezeFinishButton } = require('./commands/freeze');
        return handleFreezeFinishButton({ interaction, collections });
      }

      // Handle reset all confirmation buttons
      if (interaction.customId.startsWith('confirm_reset_all_')) {
        return handleResetAllConfirmation({ interaction, collections });
      }

      // Handle reset parties confirmation buttons
      if (interaction.customId.startsWith('confirm_reset_parties_')) {
        return handleResetPartiesConfirmation({ interaction, collections });
      }

      // Handle reset bonuses confirmation buttons
      if (interaction.customId.startsWith('confirm_reset_bonuses_')) {
        return handleResetBonusesConfirmation({ interaction, collections });
      }

      // PvP system buttons
      if (interaction.customId.startsWith('pvp_')) {
        return handlePvPButtons({ interaction, collections });
      }

      // Party system buttons
      if (interaction.customId.startsWith('party_')) {
        // Management buttons (add/remove/move)
        if (interaction.customId.startsWith('party_add_member:') ||
            interaction.customId.startsWith('party_remove_member:') ||
            interaction.customId.startsWith('party_move_member:')) {
          return handlePartyManageButtons({ interaction, collections });
        }

        return handlePartyButtons({ interaction, collections });
      }

      // Application system buttons
      if (interaction.customId.startsWith('app_')) {
        // Apply flow buttons
        if (interaction.customId === 'app_apply') {
          return handleApplyButton({ interaction, collections });
        }
        if (interaction.customId.startsWith('app_start:')) {
          return handleStartApplication({ interaction, collections });
        }
        if (interaction.customId.startsWith('app_next:')) {
          return handleNextQuestion({ interaction, collections });
        }
        if (interaction.customId === 'app_edit_answers') {
          return handleEditAnswers({ interaction, collections });
        }
        if (interaction.customId === 'app_submit_final') {
          return handleFinalSubmit({ interaction, collections });
        }
        if (interaction.customId === 'app_review_cancel') {
          return interaction.update({ 
            content: '❌ Application cancelled.', 
            components: [] 
          });
        }

        // Review flow buttons
        if (interaction.customId.startsWith('app_accept:')) {
          return handleAccept({ interaction, collections });
        }
        if (interaction.customId.startsWith('app_accept_confirm:')) {
          return handleAcceptConfirm({ interaction, collections });
        }
        if (interaction.customId.startsWith('app_reject:')) {
          return handleReject({ interaction, collections });
        }
        if (interaction.customId.startsWith('app_reject_confirm:')) {
          return handleRejectConfirm({ interaction, collections });
        }
        if (interaction.customId.startsWith('app_interview:')) {
          return handleInterview({ interaction, collections });
        }

        // Configuration buttons (during panel creation)
        return handleApplicationButtons({ interaction, collections });
      }

      return handleButtons({ interaction, collections });
    }

    // String Select Menu Interactions
    if (interaction.isStringSelectMenu()) {
      // Freeze boss selection
      if (interaction.customId.startsWith('freeze_select_')) {
        return handleFreezeBossSelection({ interaction, collections });
      }

      // PvP system selects
      if (interaction.customId.startsWith('pvp_')) {
        return handlePvPSelects({ interaction, collections });
      }

      // Party system selects
      if (interaction.customId.startsWith('party_')) {
        return handlePartySelects({ interaction, collections });
      }

      // Application system selects
      if (interaction.customId.startsWith('app_')) {
        if (interaction.customId === 'app_select_edit_question') {
          return handleEditQuestionSelect({ interaction, collections });
        }
        return handleApplicationSelects({ interaction, collections });
      }

      return handleSelects({ interaction, collections });
    }

    // Role Select Menu Interactions
    if (interaction.isRoleSelectMenu()) {
      // Application system role selects
      if (interaction.customId === 'app_select_roles') {
        const { handleSelectRoles } = require('../../features/applications/handlers/configButtons');
        return handleSelectRoles({ interaction, collections });
      }
    }

    // Modal Submit Interactions
    if (interaction.isModalSubmit()) {
      // Freeze raid setup modal
      if (interaction.customId === 'freeze_raid_setup') {
        return handleFreezeModal({ interaction, collections });
      }

      // PvP system modals
      if (interaction.customId.startsWith('pvp_')) {
        return handlePvPModals({ interaction, collections });
      }

      // Party system modals
      if (interaction.customId.startsWith('party_')) {
        return handlePartyModals({ interaction, collections });
      }

      // Application system modals
      if (interaction.customId.startsWith('app_')) {
        // Basic configuration modal
        if (interaction.customId === 'app_create_basic') {
          return handleCreateBasicModal({ interaction, collections });
        }
        // Answer submission modals
        if (interaction.customId.startsWith('app_answer:')) {
          return handleAnswerSubmit({ interaction, collections });
        }
        return handleApplicationModals({ interaction, collections });
      }
    }

  }); // End of safeExecute wrapper
}

module.exports = { onInteractionCreate };