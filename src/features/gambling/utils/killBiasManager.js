const { getBalance } = require('./balanceManager');

/**
 * Get or create kill bias settings for a user
 * Returns the success rate multiplier (0-100)
 */
async function getKillBias({ userId, guildId, collections }) {
  const { killBiases } = collections;

  const bias = await killBiases.findOne({ userId, guildId });

  if (!bias) {
    return 50; // Default 50% success rate
  }

  return bias.successRate;
}

/**
 * Set kill bias for a user
 * @param {string} userId - User ID
 * @param {string} guildId - Guild ID
 * @param {number} successRate - Success rate (0-100)
 * @param {string} setBy - Admin user ID who set this
 * @param {string} reason - Optional reason for the bias
 * @param {Object} collections - Database collections
 */
async function setKillBias({ userId, guildId, successRate, setBy, reason = null, collections }) {
  const { killBiases } = collections;

  if (successRate < 0 || successRate > 100) {
    throw new Error('Success rate must be between 0 and 100');
  }

  await killBiases.updateOne(
    { userId, guildId },
    {
      $set: {
        userId,
        guildId,
        successRate,
        setBy,
        reason,
        lastUpdated: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  return successRate;
}

/**
 * Remove kill bias for a user (reset to 50%)
 */
async function removeKillBias({ userId, guildId, collections }) {
  const { killBiases } = collections;

  const result = await killBiases.deleteOne({ userId, guildId });

  return result.deletedCount > 0;
}

/**
 * Get all users with kill bias in a guild
 */
async function getAllKillBiases({ guildId, collections }) {
  const { killBiases } = collections;

  const biases = await killBiases.find({ guildId }).toArray();

  return biases;
}

/**
 * Calculate if a kill attempt should succeed based on bias
 * @param {string} userId - User ID attempting the kill
 * @param {string} guildId - Guild ID
 * @param {Object} collections - Database collections
 * @returns {Promise<boolean>} - Whether the kill succeeds
 */
async function calculateKillSuccess({ userId, guildId, collections }) {
  const successRate = await getKillBias({ userId, guildId, collections });

  // Generate random number 0-100
  const roll = Math.random() * 100;

  // If roll is less than success rate, kill succeeds
  return roll < successRate;
}

module.exports = {
  getKillBias,
  setKillBias,
  removeKillBias,
  getAllKillBiases,
  calculateKillSuccess
};