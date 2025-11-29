/**
 * Manages broadcast session state and database persistence
 */

async function getActiveSession(collections, guildId) {
  return await collections.broadcastSessions.findOne({ 
    guildId, 
    active: true 
  });
}

async function createSession(collections, guildId, sourceChannelId, targetChannelIds, startedBy) {
  // Deactivate any existing sessions
  await collections.broadcastSessions.updateMany(
    { guildId, active: true },
    { $set: { active: false, endedAt: new Date() } }
  );

  const session = {
    guildId,
    sourceChannelId,
    targetChannelIds,
    active: true,
    startedAt: new Date(),
    startedBy,
    settings: {
      volume: 100
    }
  };

  await collections.broadcastSessions.insertOne(session);
  return session;
}

async function updateSessionTargets(collections, guildId, targetChannelIds) {
  await collections.broadcastSessions.updateOne(
    { guildId, active: true },
    { $set: { targetChannelIds } }
  );
}

async function updateSessionVolume(collections, guildId, volume) {
  await collections.broadcastSessions.updateOne(
    { guildId, active: true },
    { $set: { 'settings.volume': volume } }
  );
}

async function endSession(collections, guildId) {
  await collections.broadcastSessions.updateMany(
    { guildId, active: true },
    { $set: { active: false, endedAt: new Date() } }
  );
}

async function saveConfig(collections, guildId, configName, sourceChannelId, targetChannelIds, createdBy) {
  // Check if config name already exists
  const existing = await collections.broadcastConfigs.findOne({ guildId, configName });

  if (existing) {
    // Update existing config
    await collections.broadcastConfigs.updateOne(
      { guildId, configName },
      { 
        $set: { 
          sourceChannelId, 
          targetChannelIds,
          updatedAt: new Date(),
          updatedBy: createdBy
        } 
      }
    );
  } else {
    // Create new config
    await collections.broadcastConfigs.insertOne({
      guildId,
      configName,
      sourceChannelId,
      targetChannelIds,
      createdBy,
      createdAt: new Date()
    });
  }
}

async function getConfig(collections, guildId, configName) {
  return await collections.broadcastConfigs.findOne({ guildId, configName });
}

async function listConfigs(collections, guildId) {
  return await collections.broadcastConfigs
    .find({ guildId })
    .sort({ createdAt: -1 })
    .toArray();
}

async function deleteConfig(collections, guildId, configName) {
  await collections.broadcastConfigs.deleteOne({ guildId, configName });
}

module.exports = {
  getActiveSession,
  createSession,
  updateSessionTargets,
  updateSessionVolume,
  endSession,
  saveConfig,
  getConfig,
  listConfigs,
  deleteConfig
};