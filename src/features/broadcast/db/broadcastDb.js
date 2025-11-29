/**
 * Database operations for broadcast system
 */

async function getSession(collections, guildId) {
  return await collections.broadcastSessions.findOne({ guildId });
}

async function createSession(collections, guildId, sourceChannelId, streamUrl) {
  const session = {
    guildId,
    sourceChannelId,
    streamUrl,
    active: true,
    startedAt: new Date()
  };

  await collections.broadcastSessions.updateOne(
    { guildId },
    { $set: session },
    { upsert: true }
  );

  return session;
}

async function updateSession(collections, guildId, updates) {
  await collections.broadcastSessions.updateOne(
    { guildId },
    { $set: updates }
  );
}

async function endSession(collections, guildId) {
  await collections.broadcastSessions.updateOne(
    { guildId },
    { $set: { active: false, endedAt: new Date() } }
  );
}

async function deleteSession(collections, guildId) {
  await collections.broadcastSessions.deleteOne({ guildId });
}

async function getBroadcastUsers(collections, guildId) {
  return await collections.broadcastUsers
    .find({ guildId, enabled: true })
    .toArray();
}

async function addBroadcastUser(collections, guildId, userId, username) {
  await collections.broadcastUsers.updateOne(
    { guildId, userId },
    {
      $set: {
        guildId,
        userId,
        username,
        enabled: true,
        addedAt: new Date()
      }
    },
    { upsert: true }
  );
}

async function removeBroadcastUser(collections, guildId, userId) {
  await collections.broadcastUsers.deleteOne({ guildId, userId });
}

module.exports = {
  getSession,
  createSession,
  updateSession,
  endSession,
  deleteSession,
  getBroadcastUsers,
  addBroadcastUser,
  removeBroadcastUser
};