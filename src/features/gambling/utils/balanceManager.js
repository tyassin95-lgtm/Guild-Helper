const { safeExecute } = require('../../../utils/safeExecute');

/**
 * Get or create a user's gambling balance
 */
async function getBalance({ userId, guildId, collections }) {
  const { gamblingBalances } = collections;

  // Try to find existing
  let balance = await gamblingBalances.findOne({ userId, guildId });
  if (balance) return balance;

  // Create initial balance atomically (upsert) and return the document after creation
  const result = await gamblingBalances.findOneAndUpdate(
    { userId, guildId },
    {
      $setOnInsert: {
        userId,
        guildId,
        balance: 0,
        totalWon: 0,        // Only from gambling games (blackjack, coinflip)
        totalLost: 0,       // Only from gambling games
        gamesPlayed: 0,     // Only gambling games
        createdAt: new Date(),
        lastUpdated: new Date()
      }
    },
    { upsert: true, returnDocument: 'after' } // MongoDB v4+ option
  );

  return result.value;
}

/**
 * Add money to a user's balance (atomic operation)
 * This is for balance changes that DON'T affect gambling stats
 * (daily rewards, trivia, transfers, pushes, etc.)
 */
async function addBalance({ userId, guildId, amount, collections }) {
  const { gamblingBalances } = collections;

  // Ensure user exists first (atomic upsert)
  await getBalance({ userId, guildId, collections });

  const result = await gamblingBalances.findOneAndUpdate(
    { userId, guildId },
    {
      $inc: { balance: amount },
      $set: { lastUpdated: new Date() }
    },
    { returnDocument: 'after' }
  );

  if (!result || !result.value) {
    throw new Error('FAILED_TO_ADD_BALANCE');
  }

  return result.value; // return the full updated document
}

/**
 * Subtract money from a user's balance (atomic operation with validation)
 */
async function subtractBalance({ userId, guildId, amount, collections }) {
  const { gamblingBalances } = collections;

  // Ensure user exists
  await getBalance({ userId, guildId, collections });

  const result = await gamblingBalances.findOneAndUpdate(
    { userId, guildId, balance: { $gte: amount } }, // conditional update
    {
      $inc: { balance: -amount },
      $set: { lastUpdated: new Date() }
    },
    { returnDocument: 'after' }
  );

  // If no document matched (insufficient balance or missing user), result.value will be null
  if (!result || !result.value) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

  return result.value;
}

/**
 * Record a game result and update statistics
 * This is ONLY for gambling games (blackjack, coinflip)
 * Daily rewards, trivia, transfers do NOT use this
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

  // Update statistics ONLY for wins and losses (not pushes)
  const inc = { gamesPlayed: 1 };
  if (result === 'win') {
    // payout is the actual winnings (not including bet return)
    inc.totalWon = payout;
  } else if (result === 'loss') {
    // payout is negative, so we take absolute value
    inc.totalLost = Math.abs(payout);
  }
  // push has gamesPlayed++ but no totalWon/totalLost changes

  await gamblingBalances.updateOne(
    { userId, guildId },
    { $inc: inc, $set: { lastUpdated: new Date() } }
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
 * ONLY for gambling games (blackjack, coinflip)
 *
 * Note: we assume the bet was already deducted when the game started.
 * - `payout` should be the winnings (not including the original bet).
 * To restore the bet + winnings, we add (betAmount + payout).
 * 
 * Stats are updated by recordGame()
 */
async function processWin({ userId, guildId, betAmount, payout, gameType, collections }) {
  // Add the bet back + winnings (no stat tracking here)
  await addBalance({ userId, guildId, amount: betAmount + payout, collections });
  // Record the game and update stats (adds payout to totalWon)
  await recordGame({ userId, guildId, gameType, betAmount, result: 'win', payout, collections });
}

/**
 * Process a game loss (atomic)
 * ONLY for gambling games (blackjack, coinflip)
 */
async function processLoss({ userId, guildId, betAmount, gameType, collections }) {
  // Bet already deducted; just record the loss (payout negative bet)
  await recordGame({ userId, guildId, gameType, betAmount, result: 'loss', payout: -betAmount, collections });
}

/**
 * Process a push/tie (no money change, just record)
 * ONLY for gambling games (blackjack)
 */
async function processPush({ userId, guildId, betAmount, gameType, collections }) {
  // Return bet to the player (no stat tracking)
  await addBalance({ userId, guildId, amount: betAmount, collections });
  // Record the push (gamesPlayed++ but no totalWon/totalLost changes)
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