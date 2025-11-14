const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { subtractBalance, getBalance } = require('../utils/balanceManager');
const { createGame } = require('../utils/blackjackLogic');
const { createBlackjackEmbed } = require('../embeds/gameEmbeds');
const { isBlackjack, calculateHandValue } = require('../utils/cardDeck');

// Store active games in memory (in production, consider using Redis or DB)
const activeGames = new Map();

async function handleBlackjack({ interaction, collections }) {
  const betAmount = interaction.options.getInteger('bet');
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Validate bet amount
  if (betAmount < 10) {
    return interaction.reply({
      content: '❌ Minimum bet is **10 coins**.',
      flags: [64] // MessageFlags.Ephemeral
    });
  }

  if (betAmount > 50000) {
    return interaction.reply({
      content: '❌ Maximum bet is **50,000 coins**.',
      flags: [64] // MessageFlags.Ephemeral
    });
  }

  // Check if user already has an active game
  if (activeGames.has(userId)) {
    return interaction.reply({
      content: '❌ You already have an active blackjack game! Finish it first.',
      flags: [64] // MessageFlags.Ephemeral
    });
  }

  // Check balance
  const balance = await getBalance({ userId, guildId, collections });

  if (balance.balance < betAmount) {
    return interaction.reply({
      content: `❌ Insufficient balance! You have **${balance.balance.toLocaleString()} coins** but tried to bet **${betAmount.toLocaleString()} coins**.`,
      flags: [64] // MessageFlags.Ephemeral
    });
  }

  // Deduct bet amount
  await subtractBalance({ userId, guildId, amount: betAmount, collections });

  // Create game
  const gameState = createGame(userId, betAmount);
  activeGames.set(userId, { gameState, guildId, collections });

  // Check for immediate blackjack
  if (isBlackjack(gameState.playerHand)) {
    // Check dealer for blackjack too
    if (isBlackjack(gameState.dealerHand)) {
      // Push
      gameState.result = 'push';
      gameState.payout = 0;
    } else {
      // Player blackjack wins 3:2
      gameState.result = 'blackjack';
      gameState.payout = Math.floor(betAmount * 1.5);
    }

    gameState.status = 'finished';

    // Process result immediately
    const { handleGameEnd } = require('../handlers/blackjackButtons');
    await handleGameEnd(interaction, gameState, collections, true);
    activeGames.delete(userId);
    return;
  }

  // Check dealer blackjack
  if (isBlackjack(gameState.dealerHand)) {
    gameState.result = 'loss';
    gameState.payout = -betAmount;
    gameState.status = 'finished';

    const { handleGameEnd } = require('../handlers/blackjackButtons');
    await handleGameEnd(interaction, gameState, collections, true);
    activeGames.delete(userId);
    return;
  }

  // Create buttons
  const buttons = createGameButtons(gameState);

  const embed = createBlackjackEmbed(gameState, true);
  embed.setFooter({ text: '⏱️ You have 30 seconds to make each move' });

  await interaction.reply({
    embeds: [embed],
    components: [buttons]
  });

  // Set initial 30-second timeout
  const { gameTimeouts, clearGameTimeout } = require('../handlers/blackjackButtons');

  const timeout = setTimeout(async () => {
    console.log(`⏱️ Auto-standing for user ${userId} due to initial timeout`);

    if (!activeGames.has(userId)) return;

    const { stand, dealerPlay, determineWinner } = require('../utils/blackjackLogic');
    const { handleGameEnd } = require('../handlers/blackjackButtons');

    stand(gameState);

    if (gameState.status === 'dealerTurn') {
      dealerPlay(gameState);
      determineWinner(gameState);

      try {
        await handleGameEnd(interaction, gameState, collections, false, true, true);
      } catch (error) {
        console.error('Error in auto-stand:', error);
      }
    }

    activeGames.delete(userId);
    gameTimeouts.delete(userId);
  }, 30000);

  gameTimeouts.set(userId, timeout);
}

function createGameButtons(gameState) {
  const row = new ActionRowBuilder();

  // Hit and Stand are always available (unless game is over)
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('bj_hit')
      .setLabel('Hit')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🃏')
  );

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('bj_stand')
      .setLabel('Stand')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✋')
  );

  // Double Down: only on first action (2 cards) and not after split
  if (gameState.canDoubleDown && !gameState.splitHand && gameState.playerHand.length === 2) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('bj_double')
        .setLabel('Double Down')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💰')
    );
  }

  // Split: only on first action with a pair (2 matching cards) and not after split
  if (gameState.canSplit && !gameState.splitHand && gameState.playerHand.length === 2) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('bj_split')
        .setLabel('Split')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✂️')
    );
  }

  return row;
}

module.exports = { 
  handleBlackjack, 
  activeGames,
  createGameButtons
};