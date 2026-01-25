const { EmbedBuilder } = require('discord.js');

/**
 * Get or create a gear check thread for a user
 * @param {TextChannel} channel - The gear check channel
 * @param {string} userId - User ID
 * @param {string} displayName - User's display name
 * @returns {Promise<ThreadChannel>}
 */
async function getOrCreateGearThread(channel, userId, displayName) {
  try {
    // Fetch all active and archived threads
    const activeThreads = await channel.threads.fetchActive();
    const archivedThreads = await channel.threads.fetchArchived({ limit: 100 });

    const allThreads = new Map([
      ...activeThreads.threads,
      ...archivedThreads.threads
    ]);

    // Search for existing thread by checking the starter message
    for (const [threadId, thread] of allThreads) {
      try {
        // Fetch starter message
        const starterMessage = await thread.fetchStarterMessage();
        if (starterMessage && starterMessage.content.includes(userId)) {
          // Found existing thread - unarchive if needed
          if (thread.archived) {
            await thread.setArchived(false);
          }
          return thread;
        }
      } catch (err) {
        // Thread might be deleted or inaccessible, skip
        continue;
      }
    }

    // No existing thread found - create new one
    const thread = await channel.threads.create({
      name: displayName,
      autoArchiveDuration: 10080, // 7 days
      reason: `Gear check thread for ${displayName}`
    });

    return thread;
  } catch (error) {
    console.error('Error in getOrCreateGearThread:', error);
    throw error;
  }
}

/**
 * Post a gear check to a thread
 * @param {ThreadChannel} thread - The thread to post in
 * @param {string} userId - User ID
 * @param {string} questlogUrl - Questlog.gg URL
 * @param {string} screenshotUrl - Discord CDN screenshot URL
 * @returns {Promise<Message>}
 */
async function postGearCheckToThread(thread, userId, questlogUrl, screenshotUrl) {
  const embed = new EmbedBuilder()
    .setColor('#e74c3c')
    .setTitle('📋 Gear Check Submission')
    .setDescription(`Gear check for <@${userId}>`)
    .addFields(
      { name: '🔗 Build Link', value: questlogUrl, inline: false },
      { name: '📸 Gear Screenshot', value: '[Click to view](' + screenshotUrl + ')', inline: false }
    )
    .setImage(screenshotUrl)
    .setTimestamp()
    .setFooter({ text: 'Submitted' });

  const message = await thread.send({
    content: `<@${userId}>`,
    embeds: [embed]
  });

  return message;
}

/**
 * Update an existing gear check message in a thread
 * @param {ThreadChannel} thread - The thread containing the message
 * @param {string} messageId - Message ID to update
 * @param {string} userId - User ID
 * @param {string} questlogUrl - Questlog.gg URL
 * @param {string} screenshotUrl - Discord CDN screenshot URL
 * @returns {Promise<Message>}
 */
async function updateGearCheckInThread(thread, messageId, userId, questlogUrl, screenshotUrl) {
  try {
    const message = await thread.messages.fetch(messageId);

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('📋 Gear Check Submission')
      .setDescription(`Gear check for <@${userId}>`)
      .addFields(
        { name: '🔗 Build Link', value: questlogUrl, inline: false },
        { name: '📸 Gear Screenshot', value: '[Click to view](' + screenshotUrl + ')', inline: false }
      )
      .setImage(screenshotUrl)
      .setTimestamp()
      .setFooter({ text: 'Updated' });

    await message.edit({
      content: `<@${userId}>`,
      embeds: [embed]
    });

    return message;
  } catch (error) {
    console.error('Error updating gear check message:', error);
    // If update fails, post new message instead
    return await postGearCheckToThread(thread, userId, questlogUrl, screenshotUrl);
  }
}

module.exports = {
  getOrCreateGearThread,
  postGearCheckToThread,
  updateGearCheckInThread
};