const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { subtractBalance, getBalance } = require('../utils/balanceManager');
const { createGame } = require('../utils/blackjackLogic');
const { createBlackjackEmbed } = require('../embeds/gameEmbeds');
const { isBlackjack, calculateHandValue } = require('../utils/cardDeck');

// Store timeout references so we can cancel them
const gameTimeouts = new Map();

async function handleBlackjack({ interaction, collections }) {
  // REPLY IMMEDIATELY FIRST - before any logic or validation
  await interaction.reply({
    content: '⏳ Starting game...'
  });

  const betAmount = interaction.options.getInteger('bet');
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Validate bet amount AFTER reply
  if (betAmount < 10) {
    return interaction.editReply({
      content: '❌ Minimum bet is **10 coins**.',
      components: []
    });
  }

  if (betAmount > 5000000) {
    return interaction.editReply({
      content: '❌ Maximum bet is **5,000,000 coins**.',
      components: []
    });
  }

  try {
    // Check if user already has an active game
    const { blackjackGames } = collections;
    const existingGame = await blackjackGames.findOne({ userId, guildId });

    if (existingGame) {
      // Cancel any existing timeout for this user
      const timeoutKey = `${guildId}-${userId}`;
      if (gameTimeouts.has(timeoutKey)) {
        clearTimeout(gameTimeouts.get(timeoutKey));
        gameTimeouts.delete(timeoutKey);
      }

      // Clean up the stale game
      await blackjackGames.deleteOne({ userId, guildId });

      return interaction.editReply({
        content: '⚠️ Your previous game was cleaned up. Please try `/blackjack` again.',
        components: []
      });
    }

    // Check balance
    const balance = await getBalance({ userId, guildId, collections });

    if (balance.balance < betAmount) {
      return interaction.editReply({
        content: `❌ Insufficient balance! You have **${balance.balance.toLocaleString()} coins** but tried to bet **${betAmount.toLocaleString()} coins**.`,
        components: []
      });
    }

    // Deduct bet amount
    await subtractBalance({ userId, guildId, amount: betAmount, collections });

    // Create game
    const gameState = createGame(userId, betAmount);

    // Check for immediate player blackjack
    if (isBlackjack(gameState.playerHand)) {
      // Reveal dealer's hand to check for dealer blackjack
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
      await handleGameEnd(interaction, gameState, collections, false, true);
      return;
    }

    // Store game in database with 5 minute expiry
    await blackjackGames.insertOne({
      userId,
      guildId,
      gameState,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });

    // Create buttons
    const buttons = createGameButtons(gameState);

    const embed = createBlackjackEmbed(gameState, true);
    embed.setFooter({ text: '⏱️ You have 60 seconds to make each move' });

    await interaction.editReply({
      content: null,
      embeds: [embed],
      components: [buttons]
    });

    // Set initial 60-second timeout
    const timeoutKey = `${guildId}-${userId}`;
    const timeoutId = setTimeout(async () => {
      console.log(`⏱️ Auto-standing for user ${userId} due to initial timeout`);

      const game = await blackjackGames.findOne({ userId, guildId });
      if (!game) {
        gameTimeouts.delete(timeoutKey);
        return;
      }

      const { stand, dealerPlay, determineWinner } = require('../utils/blackjackLogic');
      const { handleGameEnd } = require('../handlers/blackjackButtons');

      stand(game.gameState);

      if (game.gameState.status === 'dealerTurn') {
        dealerPlay(game.gameState);
        determineWinner(game.gameState);

        try {
          await handleGameEnd(interaction, game.gameState, collections, false, true, true);
        } catch (error) {
          console.error('Error in auto-stand:', error);
        }
      }

      await blackjackGames.deleteOne({ userId, guildId });
      gameTimeouts.delete(timeoutKey);
    }, 60000);

    // Store timeout reference
    gameTimeouts.set(timeoutKey, timeoutId);

  } catch (error) {
    // Clean up timeout on error
    const timeoutKey = `${guildId}-${userId}`;
    if (gameTimeouts.has(timeoutKey)) {
      clearTimeout(gameTimeouts.get(timeoutKey));
      gameTimeouts.delete(timeoutKey);
    }

    await interaction.editReply({
      content: '❌ Failed to start game. Please try again.',
      components: []
    });
    throw error;
  }
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

// Export the timeout map for cleanup in button handler
module.exports = { 
  handleBlackjack,
  createGameButtons,
  gameTimeouts
};