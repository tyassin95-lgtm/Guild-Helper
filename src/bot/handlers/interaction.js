const { handleCreatePanel } = require('./commands/createpanel');
const { handleMyWishlist } = require('./commands/mywishlist');
const { handleSummary } = require('./commands/summary');
const { handleGrantTokens } = require('./commands/granttokens');
const { handleRemoveTokens } = require('./commands/removetokens');
const { handleResetUser } = require('./commands/resetuser');
const { handleResetAll, handleResetAllConfirmation } = require('./commands/resetall');
const { handleStats } = require('./commands/stats');
const { handleSummaryLive } = require('./commands/summarylive');
const { handleFreeze, handleFreezeStatus } = require('./commands/freeze');
const { handleRemind } = require('./commands/remind');

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

// ============================================================================
// ERROR HANDLING - Inline implementation (no external dependencies)
// ============================================================================

/**
 * Handle errors that occur during interaction processing
 */
async function handleInteractionError(interaction, error) {
  // Log detailed error information
  console.error('=== INTERACTION ERROR ===');
  console.error('Timestamp:', new Date().toISOString());
  console.error('Type:', interaction.type);
  console.error('Command:', interaction.commandName || interaction.customId || 'unknown');
  console.error('User:', interaction.user?.tag || 'unknown');
  console.error('User ID:', interaction.user?.id || 'unknown');
  console.error('Guild:', interaction.guild?.name || 'DM');
  console.error('Guild ID:', interaction.guildId || 'DM');
  console.error('Channel ID:', interaction.channelId || 'unknown');
  console.error('Error Type:', error.name);
  console.error('Error Message:', error.message);
  console.error('Stack Trace:', error.stack);
  console.error('========================');

  // Determine user-friendly error message
  let userMessage;

  if (error.code === 10008) {
    userMessage = '❌ This message no longer exists. Please try again.';
  } else if (error.code === 10062) {
    userMessage = '❌ This interaction has expired. Please try again.';
  } else if (error.code === 50013) {
    userMessage = '❌ The bot lacks permissions to perform this action. Please contact an admin.';
  } else if (error.code === 50001) {
    userMessage = '❌ The bot cannot access this resource. Please contact an admin.';
  } else if (error.message?.includes('time')) {
    userMessage = '❌ The operation timed out. Please try again.';
  } else if (error.message?.includes('rate limit')) {
    userMessage = '⏳ Too many requests. Please wait a moment and try again.';
  } else {
    userMessage = '❌ Something went wrong. Please try again or contact an admin if the problem persists.';
  }

  // Attempt to send error message to user
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: userMessage, components: [] });
    } else {
      await interaction.reply({ content: userMessage, flags: [64] });
    }
  } catch (replyError) {
    console.error('=== FAILED TO SEND ERROR MESSAGE ===');
    console.error('Original Error:', error.message);
    console.error('Reply Error:', replyError.message);
    console.error('===================================');
  }
}

// ============================================================================
// MAIN INTERACTION HANDLER
// ============================================================================

async function onInteractionCreate({ client, interaction, db, collections }) {
  // Wrap everything in try-catch for error handling
  try {
    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;

      // Wishlist commands
      if (name === 'createpanel') return await handleCreatePanel({ interaction, collections });
      if (name === 'mywishlist')  return await handleMyWishlist({ interaction, collections });
      if (name === 'summary')     return await handleSummary({ interaction, collections });
      if (name === 'summarylive') return await handleSummaryLive({ interaction, collections });
      if (name === 'stats')       return await handleStats({ interaction, collections });
      if (name === 'granttokens') return await handleGrantTokens({ interaction, collections });
      if (name === 'removetokens')return await handleRemoveTokens({ interaction, collections });
      if (name === 'resetuser')   return await handleResetUser({ interaction, collections });
      if (name === 'resetall')    return await handleResetAll({ interaction, collections });
      if (name === 'freeze')      return await handleFreeze({ interaction, collections });
      if (name === 'freezestatus')return await handleFreezeStatus({ interaction, collections });
      if (name === 'remind')      return await handleRemind({ interaction, collections });

      // Party commands
      if (name === 'myinfo')      return await handleMyInfo({ interaction, collections });
      if (name === 'viewparties') return await handleViewParties({ interaction, collections });
      if (name === 'playerlist')  return await handlePlayerList({ interaction, collections });
      if (name === 'partiespanel') return await handlePartiesPanel({ interaction, collections });
      if (name === 'autoassign')  return await handleAutoAssign({ interaction, collections });
      if (name === 'resetparties') return await handleResetParties({ interaction, collections });
    }

    if (interaction.isButton()) {
      // Handle reset all confirmation buttons
      if (interaction.customId.startsWith('confirm_reset_all_')) {
        return await handleResetAllConfirmation({ interaction, collections });
      }

      // Handle reset parties confirmation buttons
      if (interaction.customId.startsWith('confirm_reset_parties_')) {
        return await handleResetPartiesConfirmation({ interaction, collections });
      }

      // Party system buttons
      if (interaction.customId.startsWith('party_')) {
        // Management buttons (add/remove/move)
        if (interaction.customId.startsWith('party_add_member:') ||
            interaction.customId.startsWith('party_remove_member:') ||
            interaction.customId.startsWith('party_move_member:')) {
          return await handlePartyManageButtons({ interaction, collections });
        }

        return await handlePartyButtons({ interaction, collections });
      }

      return await handleButtons({ interaction, collections });
    }

    if (interaction.isStringSelectMenu()) {
      // Party system selects
      if (interaction.customId.startsWith('party_')) {
        return await handlePartySelects({ interaction, collections });
      }

      return await handleSelects({ interaction, collections });
    }

    if (interaction.isModalSubmit()) {
      // Party system modals
      if (interaction.customId.startsWith('party_')) {
        return await handlePartyModals({ interaction, collections });
      }
    }
  } catch (error) {
    // Catch all errors and handle them gracefully
    await handleInteractionError(interaction, error);
  }
}

module.exports = { onInteractionCreate };