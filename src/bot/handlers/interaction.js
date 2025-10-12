// src/bot/handlers/interaction.js - COMPLETE FILE
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
const { handlePartyButtons } = require('../../features/parties/handlers/buttons');
const { handlePartySelects } = require('../../features/parties/handlers/selects');
const { handlePartyModals } = require('../../features/parties/handlers/modals');
const { handlePartyManageButtons } = require('../../features/parties/handlers/manageButtons');

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
    }

    // Button Interactions
    if (interaction.isButton()) {
      // NEW: Freeze finish selection button
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

      return handleButtons({ interaction, collections });
    }

    // String Select Menu Interactions
    if (interaction.isStringSelectMenu()) {
      // NEW: Freeze boss selection
      if (interaction.customId.startsWith('freeze_select_')) {
        return handleFreezeBossSelection({ interaction, collections });
      }

      // Party system selects
      if (interaction.customId.startsWith('party_')) {
        return handlePartySelects({ interaction, collections });
      }

      return handleSelects({ interaction, collections });
    }

    // Modal Submit Interactions
    if (interaction.isModalSubmit()) {
      // NEW: Freeze raid setup modal
      if (interaction.customId === 'freeze_raid_setup') {
        return handleFreezeModal({ interaction, collections });
      }

      // Party system modals
      if (interaction.customId.startsWith('party_')) {
        return handlePartyModals({ interaction, collections });
      }
    }

  }); // End of safeExecute wrapper
}

module.exports = { onInteractionCreate };