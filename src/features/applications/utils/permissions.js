/**
 * Check if user is staff for a panel
 */
function isStaff(member, panel) {
  if (member.permissions.has('Administrator')) return true;

  return panel.config.staffRoleIds.some(roleId => 
    member.roles.cache.has(roleId)
  );
}

/**
 * Check if user is blacklisted
 */
async function isBlacklisted({ userId, guildId, collections }) {
  const { applicationBlacklist } = collections;

  const entry = await applicationBlacklist.findOne({
    guildId,
    userId,
    $or: [
      { expiresAt: { $exists: false } }, // Permanent
      { expiresAt: { $gt: new Date() } }  // Not expired
    ]
  });

  return entry !== null;
}

/**
 * Add user to blacklist
 */
async function addToBlacklist({ userId, guildId, reason, duration, addedBy, collections }) {
  const { applicationBlacklist } = collections;

  const doc = {
    guildId,
    userId,
    reason,
    addedBy,
    addedAt: new Date()
  };

  // If duration is provided, set expiration
  if (duration) {
    doc.expiresAt = new Date(Date.now() + duration);
  }

  await applicationBlacklist.updateOne(
    { guildId, userId },
    { $set: doc },
    { upsert: true }
  );

  return { success: true };
}

/**
 * Remove user from blacklist
 */
async function removeFromBlacklist({ userId, guildId, collections }) {
  const { applicationBlacklist } = collections;

  await applicationBlacklist.deleteOne({ guildId, userId });

  return { success: true };
}

/**
 * Check if user has cooldown
 */
async function hasCooldown({ userId, guildId, panelId, cooldownMs, collections }) {
  const { applicationResponses } = collections;

  if (!cooldownMs || cooldownMs === 0) return false;

  // Find most recent rejected application for this panel
  const recentApp = await applicationResponses.findOne({
    guildId,
    userId,
    panelId,
    status: 'rejected'
  }, {
    sort: { reviewedAt: -1 }
  });

  if (!recentApp || !recentApp.reviewedAt) return false;

  const timeSinceRejection = Date.now() - recentApp.reviewedAt.getTime();
  return timeSinceRejection < cooldownMs;
}

/**
 * Get remaining cooldown time
 */
async function getRemainingCooldown({ userId, guildId, panelId, cooldownMs, collections }) {
  const { applicationResponses } = collections;

  if (!cooldownMs || cooldownMs === 0) return 0;

  const recentApp = await applicationResponses.findOne({
    guildId,
    userId,
    panelId,
    status: 'rejected'
  }, {
    sort: { reviewedAt: -1 }
  });

  if (!recentApp || !recentApp.reviewedAt) return 0;

  const timeSinceRejection = Date.now() - recentApp.reviewedAt.getTime();
  const remaining = cooldownMs - timeSinceRejection;

  return remaining > 0 ? remaining : 0;
}

/**
 * Format cooldown time for display
 */
function formatCooldown(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = {
  isStaff,
  isBlacklisted,
  addToBlacklist,
  removeFromBlacklist,
  hasCooldown,
  getRemainingCooldown,
  formatCooldown
};