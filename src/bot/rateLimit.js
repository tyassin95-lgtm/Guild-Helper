const { USER_ACTION_COOLDOWN_MS } = require('../config');

/**
 * Check if a user is on cooldown for a specific interaction type
 * @returns {Promise<boolean>} true if allowed, false if on cooldown
 */
async function checkUserCooldown(userId, interactionType, collections) {
  const { userCooldowns } = collections;

  const existing = await userCooldowns.findOne({
    userId,
    interactionType,
    expiresAt: { $gt: new Date() }
  });

  if (existing) {
    return false; // User is on cooldown
  }

  // Set new cooldown
  const expiresAt = new Date(Date.now() + USER_ACTION_COOLDOWN_MS);
  await userCooldowns.insertOne({
    userId,
    interactionType,
    createdAt: new Date(),
    expiresAt
  });

  return true; // User is allowed
}

/**
 * Clear cooldown for a user (useful for admin commands)
 */
async function clearUserCooldown(userId, interactionType, collections) {
  const { userCooldowns } = collections;
  await userCooldowns.deleteMany({ userId, interactionType });
}

module.exports = { checkUserCooldown, clearUserCooldown };