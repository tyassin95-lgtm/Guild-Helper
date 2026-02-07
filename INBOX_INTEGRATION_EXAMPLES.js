/**
 * Example: How to integrate inbox messages when the bot sends DMs
 * 
 * This file demonstrates how to modify bot code to also save messages
 * to the website inbox when sending DMs to users.
 */

// Example require statement - adjust path based on where you use this
// If used in bot feature files: const { sendInboxMessage } = require('../../utils/inboxHelper');
// If used in root directory: const { sendInboxMessage } = require('./src/utils/inboxHelper');
const { sendInboxMessage } = require('./src/utils/inboxHelper');

/**
 * Example 1: Modify remindparty.js to save party info reminders to inbox
 * 
 * In src/features/parties/commands/remindparty.js, after line 87:
 * 
 * Before:
 *   await member.send({ embeds: [reminderEmbed] });
 *   successCount++;
 * 
 * After:
 *   await member.send({ embeds: [reminderEmbed] });
 *   
 *   // Also save to website inbox
 *   await sendInboxMessage(collections, {
 *     discordUserId: member.id,
 *     title: 'Party Info Setup Reminder',
 *     content: `You haven't set up your party information yet! Please use the /myinfo command in ${interaction.guild.name} to set up your weapons, CP, and gear check.`,
 *     type: 'system',
 *     timestamp: new Date()
 *   });
 *   
 *   successCount++;
 */

/**
 * Example 2: Modify wishlistreminder.js to save wishlist reminders to inbox
 * 
 * In src/features/wishlist/commands/wishlistreminder.js:
 * 
 * After sending the DM:
 *   await member.send({ embeds: [reminderEmbed] });
 *   
 *   // Also save to website inbox
 *   await sendInboxMessage(collections, {
 *     discordUserId: member.id,
 *     title: 'Wishlist Submission Reminder',
 *     content: `Don't forget to submit your wishlist for ${interaction.guild.name}! Use the /mywishlist command to submit your desired items.`,
 *     type: 'system',
 *     timestamp: new Date()
 *   });
 */

/**
 * Example 3: Application system - notify applicant of status
 * 
 * In src/features/applications/handlers/reviewFlow.js:
 * 
 * When approving an application:
 *   await applicant.send({ embeds: [approvalEmbed] });
 *   
 *   await sendInboxMessage(collections, {
 *     discordUserId: applicant.id,
 *     title: 'Application Approved!',
 *     content: `Congratulations! Your application to ${guild.name} has been approved. Welcome to the guild!`,
 *     type: 'reward',
 *     timestamp: new Date()
 *   });
 * 
 * When denying an application:
 *   await applicant.send({ embeds: [denialEmbed] });
 *   
 *   await sendInboxMessage(collections, {
 *     discordUserId: applicant.id,
 *     title: 'Application Status Update',
 *     content: `Your application to ${guild.name} has been reviewed. Unfortunately, we cannot accept your application at this time.`,
 *     type: 'system',
 *     timestamp: new Date()
 *   });
 */

/**
 * Example 4: PvP event attendance reminders
 * 
 * In src/features/pvp/attendanceReminder.js:
 * 
 * After sending reminder DM:
 *   await user.send({ embeds: [reminderEmbed] });
 *   
 *   await sendInboxMessage(collections, {
 *     discordUserId: user.id,
 *     title: 'PvP Event Reminder',
 *     content: `Reminder: PvP event "${eventName}" starts soon! Don't forget to check in and participate.`,
 *     type: 'system',
 *     timestamp: new Date()
 *   });
 */

/**
 * Example 5: Gambling system - large win notification
 * 
 * In src/features/gambling/commands/[game].js:
 * 
 * When user wins big:
 *   await user.send(`Congratulations! You won ${amount} coins!`);
 *   
 *   await sendInboxMessage(collections, {
 *     discordUserId: user.id,
 *     title: 'Big Win! 🎉',
 *     content: `Congratulations! You won ${amount} coins in the gambling game!`,
 *     type: 'reward',
 *     timestamp: new Date()
 *   });
 */

/**
 * Example 6: Guild support - request approved
 * 
 * In src/features (guild support handler):
 * 
 * When support request is approved:
 *   await user.send({ embeds: [approvalEmbed] });
 *   
 *   await sendInboxMessage(collections, {
 *     discordUserId: user.id,
 *     title: 'Guild Support Request Approved',
 *     content: `Your guild support request has been approved! You're now in the priority queue.`,
 *     type: 'support',
 *     timestamp: new Date()
 *   });
 */

/**
 * Example 7: Automod - warning issued
 * 
 * In src/features/automod/utils/warningManager.js:
 * 
 * When warning is issued:
 *   await user.send({ embeds: [warningEmbed] });
 *   
 *   await sendInboxMessage(collections, {
 *     discordUserId: user.id,
 *     title: 'Moderation Warning',
 *     content: `You have received a warning in ${guild.name} for: ${reason}. Please review the server rules.`,
 *     type: 'warning',
 *     timestamp: new Date()
 *   });
 */

/**
 * Example 8: Item roll winner notification
 * 
 * In src/features/itemroll/handlers:
 * 
 * When user wins an item roll:
 *   await winner.send({ embeds: [winnerEmbed] });
 *   
 *   await sendInboxMessage(collections, {
 *     discordUserId: winner.id,
 *     title: 'Item Roll Winner! 🎉',
 *     content: `Congratulations! You won the item roll for: ${itemName}`,
 *     type: 'reward',
 *     timestamp: new Date()
 *   });
 */

/**
 * Important Notes:
 * 
 * 1. The sendInboxMessage function is safe to use - it won't throw errors
 *    if the user doesn't exist in the website database. It will simply
 *    log a message and return null.
 * 
 * 2. Always wrap inbox message calls in try-catch if you want to handle
 *    errors, but it's not required.
 * 
 * 3. Message types available:
 *    - 'system' (default) - General system notifications
 *    - 'support' - Guild support related
 *    - 'reward' - Positive notifications (wins, approvals, etc.)
 *    - 'warning' - Moderation warnings
 * 
 * 4. Title is optional but recommended for better user experience
 * 
 * 5. Content should be plain text (no markdown or embeds)
 * 
 * 6. Timestamp is optional - defaults to current time if not provided
 */

module.exports = {
  // This file is documentation only - no exports needed
};
