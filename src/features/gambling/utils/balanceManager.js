const { safeExecute } = require('../../../utils/safeExecute');

/**
 * Get or create a user's gambling balance
 */
async function getBalance({ userId, guildId, collections }) {
  const { gamblingBalances } = collections;

  let balance = await gamblingBalances.findOne({ userId, guildId });

  if (!balance) {
    // Create initial balance
    balance = {
      userId,
      guildId,
      balance: 0, // Starting balance
      totalWon: 0,
      totalLost: 0,
      gamesPlayed: 0,
      createdAt: new Date()
    };

    await gamblingBalances.insertOne(balance);
  }

  return balance;
}

/**
 * Add money to a user's balance (atomic operation)
 */
async function addBalance({ userId, guildId, amount, collections }) {
  const { gamblingBalances } = collections;

  // Ensure user exists first
  await getBalance({ userId, guildId, collections });

  const result = await gamblingBalances.findOneAndUpdate(
    { userId, guildId },
    { 
      $inc: { balance: amount },
      $set: { lastUpdated: new Date() }
    },
    { returnDocument: 'after' }
  );

  return result.balance;
}

/**
 * Subtract money from a user's balance (atomic operation with validation)
 */
async function subtractBalance({ userId, guildId, amount, collections }) {
  const { gamblingBalances } = collections;

  const balance = await getBalance({ userId, guildId, collections });

  if (balance.balance < amount) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

  const result = await gamblingBalances.findOneAndUpdate(
    { userId, guildId, balance: { $gte: amount } },
    { 
      $inc: { balance: -amount },
      $set: { lastUpdated: new Date() }
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

  return result.balance;
}

/**
 * Record a game result and update statistics
 */
async function recordGame({ userId, guildId, gameType, betAmount, result, payout, collections }) {
  const { gamblingBalances, gamblingGames } = collections;

  // Record game in history
  await gamblingGames.insertOne({
    userId,
    guildId,
    gameType,
    betAmount,
    result, // 'win', 'loss', 'push'
    payout, // net gain/loss (negative for losses)
    timestamp: new Date()
  });

  // Update statistics
  const updates = {
    $inc: { gamesPlayed: 1 }
  };

  if (result === 'win') {
    updates.$inc.totalWon = payout;
  } else if (result === 'loss') {
    updates.$inc.totalLost = Math.abs(payout);
  }

  await gamblingBalances.updateOne(
    { userId, guildId },
    updates
  );
}

/**
 * Check if user has sufficient balance for a bet
 */
async function hasBalance({ userId, guildId, amount, collections }) {
  const balance = await getBalance({ userId, guildId, collections });
  return balance.balance >= amount;
}

/**
 * Process a game win (atomic)
 */
async function processWin({ userId, guildId, betAmount, payout, gameType, collections }) {
  // Add the winnings to balance (this is NET winnings, bet was already deducted)
  await addBalance({ userId, guildId, amount: betAmount + payout, collections });
  await recordGame({ userId, guildId, gameType, betAmount, result: 'win', payout, collections });
}

/**
 * Process a game loss (atomic)
 */
async function processLoss({ userId, guildId, betAmount, gameType, collections }) {
  await recordGame({ userId, guildId, gameType, betAmount, result: 'loss', payout: -betAmount, collections });
}

/**
 * Process a push/tie (no money change, just record)
 */
async function processPush({ userId, guildId, betAmount, gameType, collections }) {
  await recordGame({ userId, guildId, gameType, betAmount, result: 'push', payout: 0, collections });
}

module.exports = {
  getBalance,
  addBalance,
  subtractBalance,
  recordGame,
  hasBalance,
  processWin,
  processLoss,
  processPush
};