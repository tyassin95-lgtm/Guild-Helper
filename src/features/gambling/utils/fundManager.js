const { addBalance } = require('./balanceManager');

const BASE_FUND_REWARD = 5000;
const FUND_COOLDOWN_HOURS = 8;

/**
 * Calculate milestone bonus based on current uses
 */
function calculateMilestoneBonus(uses) {
  // Every 5th use gives 5000 bonus
  if (uses > 0 && uses % 5 === 0) {
    return 5000;
  }
  return 0;
}

/**
 * Get milestone info for display
 */
function getNextMilestone(currentUses) {
  const nextMilestone = Math.ceil((currentUses + 1) / 5) * 5;
  const usesUntil = nextMilestone - currentUses;
  const bonus = 5000;

  return {
    next: nextMilestone,
    usesUntil,
    bonus
  };
}

/**
 * Check if user can claim fund
 */
async function canClaimFund({ userId, guildId, collections }) {
  const { gamblingFunds } = collections;

  const fund = await gamblingFunds.findOne({ userId, guildId });

  if (!fund) {
    return { canClaim: true, isNewUser: true };
  }

  const now = new Date();
  const lastClaimed = new Date(fund.lastClaimed);
  const hoursSinceLastClaim = (now - lastClaimed) / (1000 * 60 * 60);

  if (hoursSinceLastClaim < FUND_COOLDOWN_HOURS) {
    const hoursRemaining = FUND_COOLDOWN_HOURS - hoursSinceLastClaim;
    const minutesRemaining = Math.ceil((hoursRemaining % 1) * 60);
    const hoursDisplay = Math.floor(hoursRemaining);

    return {
      canClaim: false,
      hoursRemaining: hoursDisplay,
      minutesRemaining,
      currentUses: fund.totalUses
    };
  }

  return { canClaim: true, fund };
}

/**
 * Claim fund reward
 */
async function claimFund({ userId, guildId, collections }) {
  const { gamblingFunds } = collections;

  const checkResult = await canClaimFund({ userId, guildId, collections });

  if (!checkResult.canClaim) {
    throw new Error('FUND_ALREADY_CLAIMED');
  }

  const now = new Date();
  let totalUses = 1;
  let lifetimeCoins = BASE_FUND_REWARD;

  if (checkResult.fund) {
    totalUses = checkResult.fund.totalUses + 1;
    lifetimeCoins = checkResult.fund.lifetimeCoins + BASE_FUND_REWARD;
  }

  // Calculate rewards
  const baseReward = BASE_FUND_REWARD;
  const milestoneBonus = calculateMilestoneBonus(totalUses);
  const totalReward = baseReward + milestoneBonus;

  // Update lifetime coins if there's a bonus
  if (milestoneBonus > 0) {
    lifetimeCoins += milestoneBonus;
  }

  // Update or create fund record
  await gamblingFunds.updateOne(
    { userId, guildId },
    {
      $set: {
        lastClaimed: now,
        totalUses,
        lifetimeCoins
      },
      $setOnInsert: {
        createdAt: now
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
    milestoneBonus,
    totalReward,
    totalUses,
    newBalance: balanceDoc.balance,
    isMilestone: milestoneBonus > 0
  };
}

/**
 * Get user's fund statistics
 */
async function getFundStats({ userId, guildId, collections }) {
  const { gamblingFunds } = collections;

  const fund = await gamblingFunds.findOne({ userId, guildId });

  if (!fund) {
    return {
      totalUses: 0,
      lifetimeCoins: 0,
      lastClaimed: null
    };
  }

  return {
    totalUses: fund.totalUses,
    lifetimeCoins: fund.lifetimeCoins,
    lastClaimed: fund.lastClaimed
  };
}

module.exports = {
  canClaimFund,
  claimFund,
  getFundStats,
  calculateMilestoneBonus,
  getNextMilestone,
  BASE_FUND_REWARD,
  FUND_COOLDOWN_HOURS
};