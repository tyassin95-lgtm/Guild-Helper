const { getBalance, subtractBalance, addBalance } = require('./balanceManager');

const KILL_COOLDOWN_HOURS = 2;
const MIN_BALANCE_TO_KILL = 500;

/**
 * Check if user can attempt a kill
 */
async function canAttemptKill({ userId, guildId, targetId, collections }) {
  const { killCooldowns } = collections;

  // Check cooldown
  const cooldown = await killCooldowns.findOne({ userId, guildId });

  if (cooldown) {
    const now = Date.now();
    const lastKillTime = new Date(cooldown.lastKillTime).getTime();
    const cooldownMs = KILL_COOLDOWN_HOURS * 60 * 60 * 1000;
    const timeRemaining = cooldownMs - (now - lastKillTime);

    if (timeRemaining > 0) {
      const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutesRemaining = Math.ceil((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

      return {
        canKill: false,
        reason: 'cooldown',
        hoursRemaining,
        minutesRemaining
      };
    }

    // Check if targeting same person as last time
    if (cooldown.lastTargetId === targetId) {
      return {
        canKill: false,
        reason: 'same_target',
        lastTarget: targetId
      };
    }
  }

  return { canKill: true };
}

/**
 * Get or create kill stats for a user
 */
async function getKillStats({ userId, guildId, collections }) {
  const { killStats } = collections;

  let stats = await killStats.findOne({ userId, guildId });

  if (!stats) {
    // Create initial stats
    stats = {
      userId,
      guildId,
      successfulKills: 0,
      deaths: 0,
      totalCoinsStolen: 0,
      totalCoinsLost: 0,
      biggestHeist: 0,
      biggestLoss: 0,
      lastUpdated: new Date()
    };

    await killStats.insertOne(stats);
  }

  return stats;
}

/**
 * Process a kill attempt
 */
async function processKillAttempt({ 
  killerId, 
  targetId, 
  guildId, 
  success, 
  amount, 
  collections 
}) {
  const { killStats, killCooldowns } = collections;

  // Transfer money
  if (success) {
    // Killer takes all target's money
    await subtractBalance({ userId: targetId, guildId, amount, collections });
    await addBalance({ userId: killerId, guildId, amount, collections });

    // Update killer stats
    await killStats.updateOne(
      { userId: killerId, guildId },
      {
        $inc: {
          successfulKills: 1,
          totalCoinsStolen: amount
        },
        $max: {
          biggestHeist: amount
        },
        $set: {
          lastUpdated: new Date()
        },
        $setOnInsert: {
          deaths: 0,
          totalCoinsLost: 0,
          biggestLoss: 0
        }
      },
      { upsert: true }
    );

    // Update target stats (death)
    await killStats.updateOne(
      { userId: targetId, guildId },
      {
        $inc: {
          deaths: 1,
          totalCoinsLost: amount
        },
        $max: {
          biggestLoss: amount
        },
        $set: {
          lastUpdated: new Date()
        },
        $setOnInsert: {
          successfulKills: 0,
          totalCoinsStolen: 0,
          biggestHeist: 0
        }
      },
      { upsert: true }
    );

  } else {
    // Target takes all killer's money
    await subtractBalance({ userId: killerId, guildId, amount, collections });
    await addBalance({ userId: targetId, guildId, amount, collections });

    // Update killer stats (death)
    await killStats.updateOne(
      { userId: killerId, guildId },
      {
        $inc: {
          deaths: 1,
          totalCoinsLost: amount
        },
        $max: {
          biggestLoss: amount
        },
        $set: {
          lastUpdated: new Date()
        },
        $setOnInsert: {
          successfulKills: 0,
          totalCoinsStolen: 0,
          biggestHeist: 0
        }
      },
      { upsert: true }
    );

    // Update target stats (successful defense = counts as a kill)
    await killStats.updateOne(
      { userId: targetId, guildId },
      {
        $inc: {
          successfulKills: 1,
          totalCoinsStolen: amount
        },
        $max: {
          biggestHeist: amount
        },
        $set: {
          lastUpdated: new Date()
        },
        $setOnInsert: {
          deaths: 0,
          totalCoinsLost: 0,
          biggestLoss: 0
        }
      },
      { upsert: true }
    );
  }

  // Set cooldown
  await killCooldowns.updateOne(
    { userId: killerId, guildId },
    {
      $set: {
        lastKillTime: new Date(),
        lastTargetId: targetId,
        expiresAt: new Date(Date.now() + KILL_COOLDOWN_HOURS * 60 * 60 * 1000)
      }
    },
    { upsert: true }
  );
}

module.exports = {
  canAttemptKill,
  getKillStats,
  processKillAttempt,
  KILL_COOLDOWN_HOURS,
  MIN_BALANCE_TO_KILL
};