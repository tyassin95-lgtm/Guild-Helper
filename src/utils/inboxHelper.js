const { ObjectId } = require('mongodb');

/**
 * Send an inbox message to a user
 * This function stores bot DM messages in the website inbox
 * 
 * @param {Object} collections - MongoDB collections
 * @param {Object} params - Message parameters
 * @param {string} params.discordUserId - Discord user ID
 * @param {string} params.title - Message title (optional)
 * @param {string} params.content - Message content
 * @param {string} params.type - Message type (system, warning, reward, support)
 * @param {Date} params.timestamp - Message timestamp (optional, defaults to now)
 * @returns {Promise<Object>} The created inbox message document
 */
async function sendInboxMessage(collections, { discordUserId, title, content, type = 'system', timestamp }) {
  if (!collections || !collections.inboxMessages) {
    console.error('Inbox collections not available');
    return null;
  }

  // Look up website user by Discord ID
  // Users are stored in partyPlayers collection with userId (Discord ID)
  const user = await collections.partyPlayers.findOne({ userId: discordUserId });
  
  if (!user) {
    console.log(`No website user found for Discord ID ${discordUserId}, message not stored in inbox`);
    return null;
  }

  const inboxMessage = {
    userId: user.userId, // Discord user ID - website users are identified by Discord ID
    discordUserId: discordUserId,
    messageTitle: title || null,
    messageContent: content,
    messageType: type,
    messageTimestamp: timestamp || new Date(),
    isRead: false,
    createdAt: new Date()
  };

  try {
    const result = await collections.inboxMessages.insertOne(inboxMessage);
    console.log(`Inbox message created for user ${discordUserId}: ${result.insertedId}`);
    return { ...inboxMessage, _id: result.insertedId };
  } catch (error) {
    console.error('Error creating inbox message:', error);
    return null;
  }
}

/**
 * Mark an inbox message as read
 * 
 * @param {Object} collections - MongoDB collections
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<boolean>} Success status
 */
async function markMessageAsRead(collections, messageId, userId) {
  if (!collections || !collections.inboxMessages) {
    return false;
  }

  try {
    const result = await collections.inboxMessages.updateOne(
      { _id: new ObjectId(messageId), userId: userId },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    console.error('Error marking message as read:', error);
    return false;
  }
}

/**
 * Get unread message count for a user
 * 
 * @param {Object} collections - MongoDB collections
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread message count
 */
async function getUnreadCount(collections, userId) {
  if (!collections || !collections.inboxMessages) {
    return 0;
  }

  try {
    return await collections.inboxMessages.countDocuments({ userId: userId, isRead: false });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

/**
 * Get inbox messages for a user
 * 
 * @param {Object} collections - MongoDB collections
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Max number of messages
 * @param {number} options.skip - Number of messages to skip
 * @param {boolean} options.unreadOnly - Only return unread messages
 * @returns {Promise<Array>} Array of inbox messages
 */
async function getInboxMessages(collections, userId, { limit = 50, skip = 0, unreadOnly = false } = {}) {
  if (!collections || !collections.inboxMessages) {
    return [];
  }

  try {
    const query = { userId: userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    return await collections.inboxMessages
      .find(query)
      .sort({ messageTimestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error('Error fetching inbox messages:', error);
    return [];
  }
}

/**
 * Mark all messages as read for a user
 * 
 * @param {Object} collections - MongoDB collections
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of messages marked as read
 */
async function markAllAsRead(collections, userId) {
  if (!collections || !collections.inboxMessages) {
    return 0;
  }

  try {
    const result = await collections.inboxMessages.updateMany(
      { userId: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return result.modifiedCount;
  } catch (error) {
    console.error('Error marking all as read:', error);
    return 0;
  }
}

/**
 * Delete an inbox message
 * 
 * @param {Object} collections - MongoDB collections
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<boolean>} Success status
 */
async function deleteMessage(collections, messageId, userId) {
  if (!collections || !collections.inboxMessages) {
    return false;
  }

  try {
    const result = await collections.inboxMessages.deleteOne(
      { _id: new ObjectId(messageId), userId: userId }
    );
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting message:', error);
    return false;
  }
}

module.exports = {
  sendInboxMessage,
  markMessageAsRead,
  getUnreadCount,
  getInboxMessages,
  markAllAsRead,
  deleteMessage
};
