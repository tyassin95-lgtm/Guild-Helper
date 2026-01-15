const { getBalance, subtractBalance, addBalance } = require('../utils/balanceManager');
const { createRobEmbed } = require('../embeds/robEmbeds');

const ROB_COOLDOWN_HOURS = 1;
const MIN_BALANCE_TO_ROB = 0;
const MIN_BALANCE_TO_BE_ROBBED = 1000;

async function handleRob({ interaction, collections }) {
  const robberId = interaction.user.id;
  const targetUser = interaction.options.getUser('target');
  const targetId = targetUser.id;
  const guildId = interaction.guildId;

  const { robCooldowns, robStats } = collections;

  // Validation checks (fast, before defer)
  if (targetId === robberId) {
    return interaction.reply({
      content: '❌ You can\'t rob yourself!',
      flags: [64]
    });
  }

  if (targetUser.bot) {
    return interaction.reply({
      content: '❌ You can\'t rob bots!',
      flags: [64]
    });
  }

  // Defer for DB operations
  await interaction.deferReply();

  // Check cooldown
  const cooldown = await robCooldowns.findOne({ userId: robberId, guildId });

  if (cooldown) {
    const now = Date.now();
    const lastRobbed = new Date(cooldown.lastRobbed).getTime();
    const cooldownMs = ROB_COOLDOWN_HOURS * 60 * 60 * 1000;
    const timeRemaining = cooldownMs - (now - lastRobbed);

    if (timeRemaining > 0) {
      const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutesRemaining = Math.ceil((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

      return interaction.editReply({
        content: `⏰ You're on cooldown! You can rob again in **${hoursRemaining}h ${minutesRemaining}m**.`
      });
    }
  }

  // Check balances
  const robberBalance = await getBalance({ userId: robberId, guildId, collections });
  const targetBalance = await getBalance({ userId: targetId, guildId, collections });

  if (robberBalance.balance < MIN_BALANCE_TO_ROB) {
    return interaction.editReply({
      content: `❌ You need at least **${MIN_BALANCE_TO_ROB} coins** to attempt a robbery!`
    });
  }

  if (targetBalance.balance < MIN_BALANCE_TO_BE_ROBBED) {
    return interaction.editReply({
      content: `❌ ${targetUser.username} doesn't have enough coins to rob! (minimum ${MIN_BALANCE_TO_BE_ROBBED} coins)`
    });
  }

  // Calculate success chance
  let successChance = 0.50; // Base 50%

  if (targetBalance.balance >= 10000) {
    successChance = 0.60; // Harder to defend lots of money
  } else if (targetBalance.balance < 1000) {
    successChance = 0.40; // Easier to defend when poor
  }

  const success = Math.random() < successChance;

  let resultEmbed;

  if (success) {
    // SUCCESS: Steal 10-25% of target's balance, capped at 5000
    const stealPercentage = 0.10 + Math.random() * 0.15; // 10-25%
    const stolenAmount = Math.min(
      Math.floor(targetBalance.balance * stealPercentage),
      500000
    );

    // Transfer coins
    await subtractBalance({ userId: targetId, guildId, amount: stolenAmount, collections });
    await addBalance({ userId: robberId, guildId, amount: stolenAmount, collections });

    // Update stats
    await robStats.updateOne(
      { userId: robberId, guildId },
      {
        $inc: {
          successfulRobs: 1,
          totalStolen: stolenAmount
        },
        $setOnInsert: {
          failedRobs: 0,
          totalCaught: 0,
          timesCaughtByPolice: 0
        }
      },
      { upsert: true }
    );

    resultEmbed = createRobEmbed(
      true,
      interaction.user,
      targetUser,
      stolenAmount,
      robberBalance.balance + stolenAmount,
      targetBalance.balance - stolenAmount
    );

    // Try to DM the victim
    try {
      await targetUser.send({
        embeds: [resultEmbed]
      });
    } catch (err) {
      // User has DMs disabled
    }

  } else {
    // FAILURE: Lose 15% of balance as police fine, capped at 9999999999999999
    const finePercentage = 0.15;
    const fineAmount = Math.min(
      Math.floor(robberBalance.balance * finePercentage),
      9999999999999999
    );

    // Deduct fine
    await subtractBalance({ userId: robberId, guildId, amount: fineAmount, collections });

    // Update stats
    await robStats.updateOne(
      { userId: robberId, guildId },
      {
        $inc: {
          failedRobs: 1,
          totalCaught: fineAmount,
          timesCaughtByPolice: 1
        },
        $setOnInsert: {
          successfulRobs: 0,
          totalStolen: 0
        }
      },
      { upsert: true }
    );

    resultEmbed = createRobEmbed(
      false,
      interaction.user,
      targetUser,
      fineAmount,
      robberBalance.balance - fineAmount,
      targetBalance.balance
    );

    // Notify target they were almost robbed
    try {
      await targetUser.send(
        `🚨 **${interaction.user.username}** tried to rob you but got caught by the police! You're safe.`
      );
    } catch (err) {
      // User has DMs disabled
    }
  }

  // Set cooldown
  await robCooldowns.updateOne(
    { userId: robberId, guildId },
    {
      $set: {
        lastRobbed: new Date(),
        expiresAt: new Date(Date.now() + ROB_COOLDOWN_HOURS * 60 * 60 * 1000)
      }
    },
    { upsert: true }
  );

  await interaction.editReply({
    embeds: [resultEmbed]
  });
}

module.exports = { handleRob };