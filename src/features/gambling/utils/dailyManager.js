const { addBalance } = require('./balanceManager');

const BASE_DAILY_REWARD = 500;
const STREAK_GRACE_PERIOD_HOURS = 48;

/**
 * Calculate streak bonus based on current streak
 */
function calculateStreakBonus(streak) {
  if (streak >= 20) return 10000;
  if (streak >= 15) return 5000;
  if (streak >= 10) return 2500;
  if (streak >= 5) return 1000;
  return 0;
}

/**
 * Get streak milestone info for display
 */
function getNextMilestone(currentStreak) {
  const milestones = [5, 10, 15, 20];

  for (const milestone of milestones) {
    if (currentStreak < milestone) {
      return {
        next: milestone,
        daysUntil: milestone - currentStreak,
        bonus: calculateStreakBonus(milestone)
      };
    }
  }

  // At or past all milestones
  return {
    next: 20,
    daysUntil: 0,
    bonus: 10000
  };
}

/**
 * Check if user can claim daily reward
 */
async function canClaimDaily({ userId, guildId, collections }) {
  const { gamblingDailies } = collections;

  const daily = await gamblingDailies.findOne({ userId, guildId });

  if (!daily) {
    return { canClaim: true, isNewUser: true };
  }

  const now = new Date();
  const lastClaimed = new Date(daily.lastClaimed);
  const hoursSinceLastClaim = (now - lastClaimed) / (1000 * 60 * 60);

  if (hoursSinceLastClaim < 24) {
    const hoursRemaining = 24 - hoursSinceLastClaim;
    const minutesRemaining = Math.ceil((hoursRemaining % 1) * 60);
    const hoursDisplay = Math.floor(hoursRemaining);

    return {
      canClaim: false,
      hoursRemaining: hoursDisplay,
      minutesRemaining,
      currentStreak: daily.currentStreak
    };
  }

  return { canClaim: true, daily };
}

/**
 * Claim daily reward
 */
async function claimDaily({ userId, guildId, collections }) {
  const { gamblingDailies } = collections;

  const checkResult = await canClaimDaily({ userId, guildId, collections });

  if (!checkResult.canClaim) {
    throw new Error('DAILY_ALREADY_CLAIMED');
  }

  const now = new Date();
  let currentStreak = 1;
  let longestStreak = 1;

  if (checkResult.daily) {
    const lastClaimed = new Date(checkResult.daily.lastClaimed);
    const hoursSinceLastClaim = (now - lastClaimed) / (1000 * 60 * 60);

    // Check if streak is maintained (within grace period)
    if (hoursSinceLastClaim <= STREAK_GRACE_PERIOD_HOURS) {
      currentStreak = checkResult.daily.currentStreak + 1;
    } else {
      currentStreak = 1; // Streak broken
    }

    longestStreak = Math.max(currentStreak, checkResult.daily.longestStreak);
  }

  // Calculate rewards
  const baseReward = BASE_DAILY_REWARD;
  const streakBonus = calculateStreakBonus(currentStreak);
  const totalReward = baseReward + streakBonus;

  // Update or create daily record
  await gamblingDailies.updateOne(
    { userId, guildId },
    {
      $set: {
        lastClaimed: now,
        currentStreak,
        longestStreak
      }
    },
    { upsert: true }
  );

  // Add money to balance (NO gambling stat tracking - it's free money)
  await addBalance({
    userId,
    guildId,
    amount: totalReward,
    collections
  });

  // Get the updated balance
  const balanceDoc = await collections.gamblingBalances.findOne({ userId, guildId });

  return {
    baseReward,
    streakBonus,
    totalReward,
    currentStreak,
    longestStreak,
    newBalance: balanceDoc.balance,
    isNewStreak: currentStreak === 1 && !checkResult.isNewUser
  };
}

/**
 * Get user's daily statistics
 */
async function getDailyStats({ userId, guildId, collections }) {
  const { gamblingDailies } = collections;

  const daily = await gamblingDailies.findOne({ userId, guildId });

  if (!daily) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastClaimed: null
    };
  }

  return {
    currentStreak: daily.currentStreak,
    longestStreak: daily.longestStreak,
    lastClaimed: daily.lastClaimed
  };
}

module.exports = {
  canClaimDaily,
  claimDaily,
  getDailyStats,
  calculateStreakBonus,
  getNextMilestone,
  BASE_DAILY_REWARD
};