const { subtractBalance, processWin, processLoss, getBalance } = require('../utils/balanceManager');
const { createCoinflipEmbed, createCoinflipResultEmbed } = require('../embeds/gameEmbeds');

async function handleCoinflip({ interaction, collections }) {
  const betAmount = interaction.options.getInteger('bet');
  const choice = interaction.options.getString('choice');
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Validate bet amount (fast, no defer needed)
  if (betAmount < 10) {
    return interaction.reply({
      content: '❌ Minimum bet is **10 coins**.',
      flags: [64] // MessageFlags.Ephemeral
    });
  }

  if (betAmount > 1000000000000000) {
    return interaction.reply({
      content: '❌ Maximum bet is **1,000,000,000,000,000 coins**.',
      flags: [64] // MessageFlags.Ephemeral
    });
  }

  // Check balance (needs DB, so defer first)
  await interaction.deferReply();

  const balance = await getBalance({ userId, guildId, collections });

  if (balance.balance < betAmount) {
    return interaction.editReply({
      content: `❌ Insufficient balance! You have **${balance.balance.toLocaleString()} coins** but tried to bet **${betAmount.toLocaleString()} coins**.`
    });
  }

  // Deduct bet amount
  await subtractBalance({ userId, guildId, amount: betAmount, collections });

  // Show flipping animation
  const flipEmbed = createCoinflipEmbed(betAmount, choice, true);
  await interaction.editReply({ embeds: [flipEmbed] });

  // Simulate flip delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Determine result (50/50 chance)
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const won = result === choice;

  let newBalance;

  if (won) {
    // Win: get bet back + winnings (2x total)
    await processWin({
      userId,
      guildId,
      betAmount,
      payout: betAmount,
      gameType: 'coinflip',
      collections
    });
    newBalance = balance.balance + betAmount; // Net gain = betAmount (lost bet, gained 2x)
  } else {
    // Loss: already deducted
    await processLoss({
      userId,
      guildId,
      betAmount,
      gameType: 'coinflip',
      collections
    });
    newBalance = balance.balance - betAmount;
  }

  const resultEmbed = createCoinflipResultEmbed(betAmount, choice, result, won, newBalance);

  await interaction.editReply({ embeds: [resultEmbed] });
}

module.exports = { handleCoinflip };