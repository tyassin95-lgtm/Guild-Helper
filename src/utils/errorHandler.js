/**
 * Centralized error handling for Discord interactions
 * Place this file at: src/utils/errorHandler.js
 */

/**
 * Custom error class for operational errors (user-facing errors)
 */
class OperationalError extends Error {
  constructor(message) {
    super(message);
    this.isOperational = true;
    this.name = 'OperationalError';
  }
}

/**
 * Handle errors that occur during interaction processing
 * @param {Interaction} interaction - Discord interaction object
 * @param {Error} error - The error that occurred
 */
async function handleInteractionError(interaction, error) {
  // Log detailed error information for debugging
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

  if (error.isOperational) {
    // Operational errors are safe to show to users
    userMessage = `❌ ${error.message}`;
  } else if (error.code === 10008) {
    // Discord: Unknown Message
    userMessage = '❌ This message no longer exists. Please try again.';
  } else if (error.code === 10062) {
    // Discord: Unknown Interaction
    userMessage = '❌ This interaction has expired. Please try again.';
  } else if (error.code === 50013) {
    // Discord: Missing Permissions
    userMessage = '❌ The bot lacks permissions to perform this action. Please contact an admin.';
  } else if (error.code === 50001) {
    // Discord: Missing Access
    userMessage = '❌ The bot cannot access this resource. Please contact an admin.';
  } else if (error.message?.includes('time')) {
    // Timeout errors
    userMessage = '❌ The operation timed out. Please try again.';
  } else if (error.message?.includes('rate limit')) {
    // Rate limit errors
    userMessage = '⏳ Too many requests. Please wait a moment and try again.';
  } else {
    // Generic error for unexpected issues
    userMessage = '❌ Something went wrong. Please try again or contact an admin if the problem persists.';
  }

  // Attempt to send error message to user
  try {
    if (interaction.deferred || interaction.replied) {
      // Interaction already started, edit the reply
      await interaction.editReply({ content: userMessage, components: [] });
    } else {
      // Interaction not started, send new reply
      await interaction.reply({ content: userMessage, flags: [64] }); // flags: [64] = ephemeral
    }
  } catch (replyError) {
    // If we can't send the error message, log it
    console.error('=== FAILED TO SEND ERROR MESSAGE ===');
    console.error('Original Error:', error.message);
    console.error('Reply Error:', replyError.message);
    console.error('===================================');
  }
}

/**
 * Validate that required parameters exist
 * @param {Object} params - Object containing parameters to validate
 * @param {string[]} requiredFields - Array of required field names
 * @throws {OperationalError} If any required field is missing
 */
function validateRequired(params, requiredFields) {
  for (const field of requiredFields) {
    if (params[field] === undefined || params[field] === null) {
      throw new OperationalError(`Missing required parameter: ${field}`);
    }
  }
}

/**
 * Wrap an async database operation with error handling
 * @param {Function} operation - Async function to execute
 * @param {string} operationName - Name of the operation for logging
 */
async function safeDbOperation(operation, operationName) {
  try {
    return await operation();
  } catch (error) {
    console.error(`Database operation failed: ${operationName}`);
    console.error('Error:', error);
    throw new OperationalError('A database error occurred. Please try again in a moment.');
  }
}

module.exports = {
  OperationalError,
  handleInteractionError,
  validateRequired,
  safeDbOperation
};