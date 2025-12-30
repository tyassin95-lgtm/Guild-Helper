const { getBalance } = require('../utils/balanceManager');
const { canAttemptKill, getKillStats, processKillAttempt, MIN_BALANCE_TO_KILL } = require('../utils/killManager');
const { getSuccessScenario, getFailureScenario, formatScenario } = require('../utils/killScenarios');
const { createKillResultEmbed, createKillerDMEmbed, createTargetDMEmbed } = require('../embeds/killEmbeds');

async function handleKill({ interaction, collections }) {
  const killerId = interaction.user.id;
  const targetUser = interaction.options.getUser('target');
  const targetId = targetUser.id;
  const guildId = interaction.guildId;

  // Fast validation checks before defer
  if (targetId === killerId) {
    return interaction.reply({
      content: '❌ You cannot attempt to kill yourself!',
      flags: [64]
    });
  }

  if (targetUser.bot) {
    return interaction.reply({
      content: '❌ You cannot attempt to kill bots!',
      flags: [64]
    });
  }

  // Defer for DB operations
  await interaction.deferReply();

  // Check if killer can attempt a kill
  const canKill = await canAttemptKill({ 
    userId: killerId, 
    guildId, 
    targetId, 
    collections 
  });

  if (!canKill.canKill) {
    if (canKill.reason === 'cooldown') {
      return interaction.editReply({
        content: `⏰ You're on cooldown! You can attempt another kill in **${canKill.hoursRemaining}h ${canKill.minutesRemaining}m**.`
      });
    }

    if (canKill.reason === 'same_target') {
      return interaction.editReply({
        content: `❌ You cannot target the same person twice in a row! Try killing someone else first.`
      });
    }
  }

  // Check balances
  const killerBalance = await getBalance({ userId: killerId, guildId, collections });
  const targetBalance = await getBalance({ userId: targetId, guildId, collections });

  if (killerBalance.balance < MIN_BALANCE_TO_KILL) {
    return interaction.editReply({
      content: `❌ You need at least **${MIN_BALANCE_TO_KILL} coins** to attempt a kill!`
    });
  }

  if (targetBalance.balance < MIN_BALANCE_TO_KILL) {
    return interaction.editReply({
      content: `❌ ${targetUser.username} doesn't have enough coins to be worth killing! (minimum ${MIN_BALANCE_TO_KILL} coins)`
    });
  }

  // Use bias system to determine success (allows admins to secretly modify success rates)
  const { calculateKillSuccess } = require('../utils/killBiasManager');
  const success = await calculateKillSuccess({ userId: killerId, guildId, collections });

  // Determine amount transferred (ALL money from loser)
  const amount = success ? targetBalance.balance : killerBalance.balance;

  // Get server display names (nicknames or usernames) BEFORE formatting scenario
  let killerDisplayName = interaction.user.username;
  let targetDisplayName = targetUser.username;

  try {
    const killerMember = await interaction.guild.members.fetch(killerId);
    killerDisplayName = killerMember.displayName || killerMember.user.username;
  } catch (err) {
    console.warn(`Could not fetch killer member ${killerId}`);
  }

  try {
    const targetMember = await interaction.guild.members.fetch(targetId);
    targetDisplayName = targetMember.displayName || targetMember.user.username;
  } catch (err) {
    console.warn(`Could not fetch target member ${targetId}`);
  }

  // Get appropriate scenario (using server nickname for target)
  const rawScenario = success ? getSuccessScenario() : getFailureScenario();
  const scenario = formatScenario(rawScenario, targetDisplayName, amount);

  // Process the kill attempt
  await processKillAttempt({
    killerId,
    targetId,
    guildId,
    success,
    amount,
    collections
  });

  // Get updated balances and stats
  const killerNewBalance = await getBalance({ userId: killerId, guildId, collections });
  const targetNewBalance = await getBalance({ userId: targetId, guildId, collections });
  const killerStats = await getKillStats({ userId: killerId, guildId, collections });
  const targetStats = await getKillStats({ userId: targetId, guildId, collections });

  // Calculate cooldown timestamp (2 hours from now)
  const cooldownTimestamp = Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000);

  // Create public embed (everyone sees)
  const publicEmbed = createKillResultEmbed(
    success,
    interaction.user,
    targetUser,
    amount,
    scenario,
    killerStats,
    killerNewBalance.balance,
    targetNewBalance.balance,
    cooldownTimestamp,
    killerDisplayName,
    targetDisplayName
  );

  // Post to channel
  await interaction.editReply({
    embeds: [publicEmbed]
  });

  // Send DM to killer
  try {
    const killerDMEmbed = createKillerDMEmbed(
      success,
      targetUser,
      amount,
      killerNewBalance.balance,
      killerStats
    );
    await interaction.user.send({ embeds: [killerDMEmbed] });
  } catch (err) {
    // User has DMs disabled
    console.warn(`Failed to send DM to killer ${killerId}`);
  }

  // Send DM to target
  try {
    const targetDMEmbed = createTargetDMEmbed(
      success,
      interaction.user,
      amount,
      targetNewBalance.balance,
      targetStats
    );
    await targetUser.send({ embeds: [targetDMEmbed] });
  } catch (err) {
    // User has DMs disabled
    console.warn(`Failed to send DM to target ${targetId}`);
  }
}

module.exports = { handleKill };