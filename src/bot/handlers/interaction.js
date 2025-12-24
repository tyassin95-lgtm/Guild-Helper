const { handleExcludeRole } = require('./commands/excluderole');

// Party system imports
const { handleMyInfo } = require('../../features/parties/commands/myinfo');
const { handleViewParties } = require('../../features/parties/commands/viewparties');
const { handlePlayerList } = require('../../features/parties/commands/playerlist');
const { handlePartiesPanel } = require('../../features/parties/commands/partiespanel');
const { handleResetParties, handleResetPartiesConfirmation } = require('../../features/parties/commands/resetparties');
const { handleRemindParty } = require('../../features/parties/commands/remindparty');
const { handleGuildRoster } = require('../../features/parties/commands/guildroster');
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

// Item Roll system imports
const { handleItemRoll } = require('../../features/itemroll/commands/itemroll');
const { handleItemRollButtons } = require('../../features/itemroll/handlers/itemRollButtons');
const { handleItemRollSelects } = require('../../features/itemroll/handlers/itemRollSelects');
const { handleItemRollModals } = require('../../features/itemroll/handlers/itemRollModals');

// Raid system imports
const { handleCreateRaid, handleCreateBasicModal } = require('../../features/raids/commands/createraid');
const { handleDeleteRaid } = require('../../features/raids/commands/deleteraid');
const { handleCloseRaid, handleCloseConfirm } = require('../../features/raids/commands/closeraid');
const { handleRaidButtons } = require('../../features/raids/handlers/buttons');
const { handleRaidModals } = require('../../features/raids/handlers/modals');

// Application system imports
const { handleCreateApplication, handleCreateBasicModal: handleAppCreateBasicModal } = require('../../features/applications/commands/createapplication');
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

// Gambling system imports
const { handleGamblingBalance } = require('../../features/gambling/commands/gamblingbalance');
const { handleGamblingDaily } = require('../../features/gambling/commands/gamblingdaily');
const { handleGiveGamblingMoney } = require('../../features/gambling/commands/givegamblingmoney');
const { handleBlackjack } = require('../../features/gambling/commands/blackjack');
const { handleCoinflip } = require('../../features/gambling/commands/coinflip');
const { handleTrivia } = require('../../features/gambling/commands/trivia');
const { handleRob } = require('../../features/gambling/commands/rob');
const { handleSend, handleSendConfirmation } = require('../../features/gambling/commands/send');
const { handleLeaderboard } = require('../../features/gambling/commands/leaderboard');
const { handleBlackjackButtons } = require('../../features/gambling/handlers/blackjackButtons');
const { handleTriviaButtons } = require('../../features/gambling/handlers/triviaButtons');

// Broadcast system imports
const { handleStartBroadcast } = require('../../features/broadcast/commands/startbroadcast');
const { handleStopBroadcast } = require('../../features/broadcast/commands/stopbroadcast');
const { handleAddBroadcaster } = require('../../features/broadcast/commands/addbroadcaster');
const { handleRemoveBroadcaster } = require('../../features/broadcast/commands/removebroadcaster');
const { handleListBroadcasters } = require('../../features/broadcast/commands/listbroadcasters');
const { handleBroadcastStatus } = require('../../features/broadcast/commands/broadcaststatus');

// Wishlist system imports
const { handleMyWishlist } = require('../../features/wishlist/commands/mywishlist');
const { handleWishlists } = require('../../features/wishlist/commands/wishlists');
const { handleResetUserWishlist } = require('../../features/wishlist/commands/resetuserwishlist');
const { handleFreezeWishlists } = require('../../features/wishlist/commands/freezewishlists');
const { handleWishlistReminder } = require('../../features/wishlist/commands/wishlistreminder');
const { 
  handleGiveItem, 
  handleItemSelection, 
  handleUserSelection, 
  handleBackToItems, 
  handleViewPending, 
  handleReviewSelect, 
  handleFinalize, 
  handleCancel, 
  handleClearItem, 
  handleItemPagination 
} = require('../../features/wishlist/commands/giveitem');
const { handleWishlistButtons } = require('../../features/wishlist/handlers/wishlistButtons');
const { handleWishlistSelects } = require('../../features/wishlist/handlers/wishlistSelects');

// Safe execution wrapper
const { safeExecute } = require('../../utils/safeExecute');

async function onInteractionCreate({ client, interaction, db, collections }) {
  // Wrap everything in safeExecute for automatic error handling
  await safeExecute(interaction, async () => {

    // Chat Input Commands
    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;

      // Admin commands
      if (name === 'excluderole') return handleExcludeRole({ interaction, collections });

      // Party commands
      if (name === 'myinfo')      return handleMyInfo({ interaction, collections });
      if (name === 'viewparties') return handleViewParties({ interaction, collections });
      if (name === 'playerlist')  return handlePlayerList({ interaction, collections });
      if (name === 'partiespanel') return handlePartiesPanel({ interaction, collections });
      if (name === 'resetparties') return handleResetParties({ interaction, collections });
      if (name === 'remindparty') return handleRemindParty({ interaction, collections });
      if (name === 'guildroster') return handleGuildRoster({ interaction, collections });

      // PvP commands
      if (name === 'pvpevent')    return handlePvPEvent({ interaction, collections });
      if (name === 'resetbonuses') return handleResetBonuses({ interaction, collections });
      if (name === 'itemroll')    return handleItemRoll({ interaction, collections });

      // Raid commands
      if (name === 'createraid')  return handleCreateRaid({ interaction, collections });
      if (name === 'deleteraid')  return handleDeleteRaid({ interaction, collections });
      if (name === 'closeraid')   return handleCloseRaid({ interaction, collections });

      // Application commands
      if (name === 'createapplication')   return handleCreateApplication({ interaction, collections });
      if (name === 'deleteapplication')   return handleDeleteApplication({ interaction, collections });
      if (name === 'editapplication')     return handleEditApplication({ interaction, collections });
      if (name === 'applicationstats')    return handleApplicationStats({ interaction, collections });
      if (name === 'applicationhistory')  return handleApplicationHistory({ interaction, collections });
      if (name === 'blacklist')           return handleBlacklist({ interaction, collections });
      if (name === 'clearoldtickets')     return handleClearOldTickets({ interaction, collections });

      // Gambling commands
      if (name === 'gamblingbalance')     return handleGamblingBalance({ interaction, collections });
      if (name === 'gamblingdaily')       return handleGamblingDaily({ interaction, collections });
      if (name === 'givegamblingmoney')   return handleGiveGamblingMoney({ interaction, collections });
      if (name === 'blackjack')           return handleBlackjack({ interaction, collections });
      if (name === 'coinflip')            return handleCoinflip({ interaction, collections });
      if (name === 'trivia')              return handleTrivia({ interaction, collections });
      if (name === 'rob')                 return handleRob({ interaction, collections });
      if (name === 'send')                return handleSend({ interaction, collections });
      if (name === 'leaderboard')         return handleLeaderboard({ interaction, collections });

      // Broadcast commands
      if (name === 'startbroadcast')      return handleStartBroadcast({ interaction, collections, client });
      if (name === 'stopbroadcast')       return handleStopBroadcast({ interaction, collections, client });
      if (name === 'addbroadcaster')      return handleAddBroadcaster({ interaction, collections });
      if (name === 'removebroadcaster')   return handleRemoveBroadcaster({ interaction, collections });
      if (name === 'listbroadcasters')    return handleListBroadcasters({ interaction, collections });
      if (name === 'broadcaststatus')     return handleBroadcastStatus({ interaction, collections, client });

      // Wishlist commands
      if (name === 'mywishlist')          return handleMyWishlist({ interaction, collections });
      if (name === 'wishlists')           return handleWishlists({ interaction, collections });
      if (name === 'resetuserwishlist')   return handleResetUserWishlist({ interaction, collections, client });
      if (name === 'freezewishlists')     return handleFreezeWishlists({ interaction, collections, client });
      if (name === 'wishlistreminder')    return handleWishlistReminder({ interaction, collections });
      if (name === 'giveitem')            return handleGiveItem({ interaction, collections, client });
    }

    // Button Interactions
    if (interaction.isButton()) {
      // Handle reset parties confirmation buttons
      if (interaction.customId.startsWith('confirm_reset_parties_')) {
        return handleResetPartiesConfirmation({ interaction, collections });
      }

      // Handle reset bonuses confirmation buttons
      if (interaction.customId.startsWith('confirm_reset_bonuses_')) {
        return handleResetBonusesConfirmation({ interaction, collections });
      }

      // Gambling blackjack buttons
      if (interaction.customId.startsWith('bj_')) {
        return handleBlackjackButtons({ interaction, collections });
      }

      // Trivia buttons
      if (interaction.customId.startsWith('trivia_')) {
        return handleTriviaButtons({ interaction, collections });
      }

      // Send confirmation buttons
      if (interaction.customId.startsWith('send_confirm:')) {
        return handleSendConfirmation({ interaction, collections });
      }

      // Item Roll buttons
      if (interaction.customId.startsWith('itemroll_')) {
        return handleItemRollButtons({ interaction, collections });
      }

      // PvP system buttons
      if (interaction.customId.startsWith('pvp_')) {
        return handlePvPButtons({ interaction, collections });
      }

      // Raid system buttons
      if (interaction.customId.startsWith('raid_')) {
        // Handle close raid confirmation
        if (interaction.customId.startsWith('raid_close_confirm:')) {
          return handleCloseConfirm({ interaction, collections });
        }
        return handleRaidButtons({ interaction, collections });
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

      // Wishlist system buttons
      if (interaction.customId.startsWith('wishlist_')) {
        return handleWishlistButtons({ interaction, collections, client });
      }

      // Give item buttons
      if (interaction.customId.startsWith('giveitem_page_items:')) {
        return handleItemPagination({ interaction, collections });
      }
      if (interaction.customId.startsWith('giveitem_back_to_items:')) {
        return handleBackToItems({ interaction, collections });
      }
      if (interaction.customId.startsWith('giveitem_view_pending:')) {
        return handleViewPending({ interaction, collections, client });
      }
      if (interaction.customId.startsWith('giveitem_finalize:')) {
        return handleFinalize({ interaction, collections, client });
      }
      if (interaction.customId.startsWith('giveitem_cancel:')) {
        return handleCancel({ interaction });
      }
      if (interaction.customId.startsWith('giveitem_clear_item:')) {
        return handleClearItem({ interaction, collections, client });
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
    }

    // String Select Menu Interactions
    if (interaction.isStringSelectMenu()) {
      // Item Roll select handlers (CATEGORY, SUBCATEGORY, ITEM, USERS)
      if (interaction.customId === 'itemroll_select_category' ||
          interaction.customId.startsWith('itemroll_select_subcategory:') ||
          interaction.customId.startsWith('itemroll_select_item:') ||
          interaction.customId.startsWith('itemroll_select_users:')) {
        return handleItemRollSelects({ interaction, collections });
      }

      // Raid signup selects
      if (interaction.customId.startsWith('raid_signup_')) {
        const { handleRaidSelects } = require('../../features/raids/handlers/selects');
        return handleRaidSelects({ interaction, collections });
      }

      // PvP system selects
      if (interaction.customId.startsWith('pvp_')) {
        return handlePvPSelects({ interaction, collections });
      }

      // Party system selects
      if (interaction.customId.startsWith('party_')) {
        return handlePartySelects({ interaction, collections });
      }

      // Wishlist system selects
      if (interaction.customId.startsWith('wishlist_')) {
        return handleWishlistSelects({ interaction, collections });
      }

      // Give item selects
      if (interaction.customId.startsWith('giveitem_select_item:')) {
        return handleItemSelection({ interaction, collections, client });
      }
      if (interaction.customId.startsWith('giveitem_select_users:')) {
        return handleUserSelection({ interaction, collections, client });
      }
      if (interaction.customId.startsWith('giveitem_review_select:')) {
        return handleReviewSelect({ interaction, collections, client });
      }

      // Application system selects
      if (interaction.customId.startsWith('app_')) {
        if (interaction.customId === 'app_select_edit_question') {
          return handleEditQuestionSelect({ interaction, collections });
        }
        return handleApplicationSelects({ interaction, collections });
      }
    }

    // User Select Menu Interactions
    if (interaction.isUserSelectMenu()) {
      // Item Roll user selection - MOVED TO STRING SELECT SECTION ABOVE
      // (kept here as fallback if needed)
      if (interaction.customId.startsWith('itemroll_select_users:')) {
        return handleItemRollSelects({ interaction, collections });
      }

      // Application system role selects
      if (interaction.customId === 'app_select_roles') {
        const { handleSelectRoles } = require('../../features/applications/handlers/configButtons');
        return handleSelectRoles({ interaction, collections });
      }
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
      // Item Roll trait and duration modal
      if (interaction.customId.startsWith('itemroll_trait_duration_modal:')) {
        return handleItemRollModals({ interaction, collections });
      }

      // PvP system modals
      if (interaction.customId.startsWith('pvp_')) {
        return handlePvPModals({ interaction, collections });
      }

      // Raid system modals
      if (interaction.customId.startsWith('raid_')) {
        // Raid creation modal
        if (interaction.customId === 'raid_create_basic') {
          return handleCreateBasicModal({ interaction, collections });
        }
        // Raid time slot modal
        if (interaction.customId.startsWith('raid_add_time_modal:')) {
          return handleRaidModals({ interaction, collections });
        }
        return handleRaidModals({ interaction, collections });
      }

      // Party system modals
      if (interaction.customId.startsWith('party_')) {
        return handlePartyModals({ interaction, collections });
      }

      // Application system modals
      if (interaction.customId.startsWith('app_')) {
        // Basic configuration modal
        if (interaction.customId === 'app_create_basic') {
          return handleAppCreateBasicModal({ interaction, collections });
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