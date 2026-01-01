const { createGameButtons, gameTimeouts } = require('../commands/blackjack');
const { hit, stand, doubleDown, split, dealerPlay, determineWinner, determineSplitWinner } = require('../utils/blackjackLogic');
const { createBlackjackEmbed, createBlackjackResultEmbed } = require('../embeds/gameEmbeds');
const { addBalance, processWin, processLoss, processPush, getBalance, subtractBalance } = require('../utils/balanceManager');
const { calculateHandValue } = require('../utils/cardDeck');

async function handleBlackjackButtons({ interaction, collections }) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const { blackjackGames } = collections;

  // Get active game from database
  const gameDoc = await blackjackGames.findOne({ userId, guildId });

  if (!gameDoc) {
    return interaction.update({
      content: '❌ No active game found. Start a new game with `/blackjack`.',
      embeds: [],
      components: []
    });
  }

  const gameState = gameDoc.gameState;
  const action = interaction.customId.split('_')[1];

  // CRITICAL: Cancel the existing timeout whenever user takes an action
  const timeoutKey = `${guildId}-${userId}`;
  if (gameTimeouts.has(timeoutKey)) {
    clearTimeout(gameTimeouts.get(timeoutKey));
    gameTimeouts.delete(timeoutKey);
  }

  try {
    let statusMessage = '';
    let newTimeoutId = null;

    switch (action) {
      case 'hit':
        hit(gameState);
        const playerValue = calculateHandValue(gameState.playerHand);
        const lastCard = gameState.playerHand[gameState.playerHand.length - 1];
        statusMessage = `🎴 **Drew:** ${lastCard.rank}${lastCard.suit}`;

        if (gameState.status === 'playerBusted') {
          statusMessage = `💥 **BUST!** Over 21`;

          // CRITICAL: Set result and payout for the bust
          const { determineWinner } = require('../utils/blackjackLogic');
          determineWinner(gameState);

          await handleGameEnd(interaction, gameState, collections, true);
          await blackjackGames.deleteOne({ userId, guildId });
        } else {
          // Update game in database
          await blackjackGames.updateOne(
            { userId, guildId },
            { $set: { gameState } }
          );

          const embed = createBlackjackEmbed(gameState, true);
          embed.setDescription(`${embed.data.description}\n\n${statusMessage}`);
          embed.setFooter({ text: '⏱️ 60 seconds to make your next move' });

          const buttons = createGameButtons(gameState);
          await interaction.update({ embeds: [embed], components: [buttons] });

          // Set new 60-second timeout for next action
          newTimeoutId = setTimeout(async () => {
            console.log(`⏱️ Auto-standing for user ${userId} due to timeout after hit`);
            await autoStand(userId, guildId, interaction, collections);
            gameTimeouts.delete(timeoutKey);
          }, 60000);
        }
        break;

      case 'stand':
        stand(gameState);

        if (gameState.status === 'dealerTurn') {
          statusMessage = `✋ **You stood with ${calculateHandValue(gameState.playerHand)}**\n\n*Dealer reveals hidden card and plays...*`;

          const standEmbed = createBlackjackEmbed(gameState, true);
          standEmbed.setDescription(`${standEmbed.data.description}\n\n${statusMessage}`);
          await interaction.update({ embeds: [standEmbed], components: [] });

          await new Promise(resolve => setTimeout(resolve, 1500));

          dealerPlay(gameState);

          // If there's a split hand, determine both results
          if (gameState.splitHand) {
            determineSplitWinner(gameState);
          } else {
            determineWinner(gameState);
          }

          await handleGameEnd(interaction, gameState, collections, false, true);
          await blackjackGames.deleteOne({ userId, guildId });
        } else if (gameState.activeHand === 'split') {
          statusMessage = `✋ **First hand complete!**\n\nNow playing your **split hand**...`;

          // Update game in database
          await blackjackGames.updateOne(
            { userId, guildId },
            { $set: { gameState } }
          );

          const embed = createBlackjackEmbed(gameState, true);
          embed.setDescription(`${embed.data.description}\n\n${statusMessage}`);
          embed.setFooter({ text: '⏱️ 60 seconds to make your next move' });

          const buttons = createGameButtons(gameState);
          await interaction.update({ embeds: [embed], components: [buttons] });

          // Set new timeout for split hand
          newTimeoutId = setTimeout(async () => {
            console.log(`⏱️ Auto-standing for user ${userId} on split hand due to timeout`);
            await autoStand(userId, guildId, interaction, collections);
            gameTimeouts.delete(timeoutKey);
          }, 60000);
        }
        break;

      case 'double':
        const balance = await getBalance({ userId, guildId, collections });

        if (balance.balance < gameState.betAmount) {
          // Insufficient balance - show error but keep game active
          const errorEmbed = createBlackjackEmbed(gameState, true);
          errorEmbed.setDescription(
            `${errorEmbed.data.description}\n\n` +
            `❌ **Cannot double down!**\n` +
            `You need **${gameState.betAmount.toLocaleString()} more coins** but only have **${balance.balance.toLocaleString()} coins**.\n\n` +
            `Please choose another action.`
          );
          errorEmbed.setFooter({ text: '⏱️ 60 seconds to make your next move' });

          const buttons = createGameButtons(gameState);

          await interaction.update({ embeds: [errorEmbed], components: [buttons] });

          // Reset timeout since game is still active
          newTimeoutId = setTimeout(async () => {
            console.log(`⏱️ Auto-standing for user ${userId} after failed double down`);
            await autoStand(userId, guildId, interaction, collections);
            gameTimeouts.delete(timeoutKey);
          }, 60000);

          break;
        }

        await subtractBalance({ userId, guildId, amount: gameState.betAmount, collections });

        const originalBet = gameState.betAmount;
        doubleDown(gameState);

        const doubValue = calculateHandValue(gameState.playerHand);
        const doubleCard = gameState.playerHand[gameState.playerHand.length - 1];
        statusMessage = `💰 **Doubled down!** ${originalBet.toLocaleString()} → **${gameState.betAmount.toLocaleString()} coins**\n🎴 **Drew:** ${doubleCard.rank}${doubleCard.suit}`;

        if (gameState.status === 'playerBusted') {
          statusMessage += `\n\n💥 **BUST!** Over 21`;

          // CRITICAL: Set result and payout for the bust
          const { determineWinner } = require('../utils/blackjackLogic');
          determineWinner(gameState);

          await handleGameEnd(interaction, gameState, collections, true);
          await blackjackGames.deleteOne({ userId, guildId });
        } else {
          const doubleEmbed = createBlackjackEmbed(gameState, true);
          doubleEmbed.setDescription(`${doubleEmbed.data.description}\n\n${statusMessage}\n\n*Dealer reveals hidden card and plays...*`);
          await interaction.update({ embeds: [doubleEmbed], components: [] });

          await new Promise(resolve => setTimeout(resolve, 2000));

          dealerPlay(gameState);
          determineWinner(gameState);

          await handleGameEnd(interaction, gameState, collections, false, true);
          await blackjackGames.deleteOne({ userId, guildId });
        }
        break;

      case 'split':
        const balanceForSplit = await getBalance({ userId, guildId, collections });

        if (balanceForSplit.balance < gameState.betAmount) {
          // Insufficient balance - show error but keep game active
          const errorEmbed = createBlackjackEmbed(gameState, true);
          errorEmbed.setDescription(
            `${errorEmbed.data.description}\n\n` +
            `❌ **Cannot split!**\n` +
            `You need **${gameState.betAmount.toLocaleString()} more coins** to split but only have **${balanceForSplit.balance.toLocaleString()} coins**.\n\n` +
            `Please choose another action.`
          );
          errorEmbed.setFooter({ text: '⏱️ 60 seconds to make your next move' });

          const buttons = createGameButtons(gameState);

          await interaction.update({ embeds: [errorEmbed], components: [buttons] });

          // Reset timeout since game is still active
          newTimeoutId = setTimeout(async () => {
            console.log(`⏱️ Auto-standing for user ${userId} after failed split`);
            await autoStand(userId, guildId, interaction, collections);
            gameTimeouts.delete(timeoutKey);
          }, 60000);

          break;
        }

        await subtractBalance({ userId, guildId, amount: gameState.betAmount, collections });

        split(gameState);

        statusMessage = `✂️ **Split!** Your pair has been split into two hands.\n\nPlaying **first hand** now...`;

        // Update game in database
        await blackjackGames.updateOne(
          { userId, guildId },
          { $set: { gameState } }
        );

        const embedAfterSplit = createBlackjackEmbed(gameState, true);
        embedAfterSplit.setDescription(`${embedAfterSplit.data.description}\n\n${statusMessage}`);
        embedAfterSplit.setFooter({ text: '⏱️ 60 seconds to make your next move' });

        const buttonsAfterSplit = createGameButtons(gameState);
        await interaction.update({ embeds: [embedAfterSplit], components: [buttonsAfterSplit] });

        // Set new timeout after split
        newTimeoutId = setTimeout(async () => {
          console.log(`⏱️ Auto-standing for user ${userId} on first hand after split`);
          await autoStand(userId, guildId, interaction, collections);
          gameTimeouts.delete(timeoutKey);
        }, 60000);
        break;
    }

    // Store new timeout if one was created
    if (newTimeoutId) {
      gameTimeouts.set(timeoutKey, newTimeoutId);
    }

  } catch (error) {
    console.error('Blackjack button error:', error);

    // Clean up timeout and game on error
    if (gameTimeouts.has(timeoutKey)) {
      clearTimeout(gameTimeouts.get(timeoutKey));
      gameTimeouts.delete(timeoutKey);
    }

    await blackjackGames.deleteOne({ userId, guildId });

    try {
      await interaction.update({
        content: `❌ Error: ${error.message}`,
        embeds: [],
        components: []
      });
    } catch (e) {
      console.error('Failed to update interaction:', e);
    }
  }
}

/**
 * Auto-stand helper function to avoid code duplication
 */
async function autoStand(userId, guildId, interaction, collections) {
  const { blackjackGames } = collections;

  const game = await blackjackGames.findOne({ userId, guildId });
  if (!game) return;

  const { stand, dealerPlay, determineWinner } = require('../utils/blackjackLogic');

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
}

async function handleGameEnd(interaction, gameState, collections, isUpdate = false, isEdit = false, isTimeout = false) {
  const userId = gameState.userId;
  const guildId = interaction.guildId;

  // Clean up timeout reference
  const timeoutKey = `${guildId}-${userId}`;
  if (gameTimeouts.has(timeoutKey)) {
    clearTimeout(gameTimeouts.get(timeoutKey));
    gameTimeouts.delete(timeoutKey);
  }

  // If split hand exists, process BOTH results
  if (gameState.splitHand && gameState.splitResult) {
    // Process main hand
    await processSingleHandResult(userId, guildId, gameState.betAmount, gameState.result, gameState.payout, collections);

    // Process split hand
    await processSingleHandResult(userId, guildId, gameState.betAmount, gameState.splitResult, gameState.splitPayout, collections);
  } else {
    // Process single hand result
    await processSingleHandResult(userId, guildId, gameState.betAmount, gameState.result, gameState.payout, collections);
  }

  const newBalance = await getBalance({ userId, guildId, collections });
  const resultEmbed = createBlackjackResultEmbed(gameState, newBalance.balance);

  if (isTimeout) {
    resultEmbed.setFooter({ text: '⏱️ Game auto-completed (no action for 60 seconds)' });
  }

  if (isUpdate) {
    await interaction.update({ embeds: [resultEmbed], components: [] });
  } else if (isEdit) {
    await interaction.editReply({ embeds: [resultEmbed], components: [] });
  } else {
    await interaction.update({ embeds: [resultEmbed], components: [] });
  }
}

async function processSingleHandResult(userId, guildId, betAmount, result, payout, collections) {
  if (result === 'win' || result === 'blackjack') {
    await processWin({
      userId,
      guildId,
      betAmount,
      payout,
      gameType: 'blackjack',
      collections
    });
  } else if (result === 'loss') {
    await processLoss({
      userId,
      guildId,
      betAmount,
      gameType: 'blackjack',
      collections
    });
  } else if (result === 'push') {
    // processPush already returns the bet, so just call it once
    await processPush({
      userId,
      guildId,
      betAmount,
      gameType: 'blackjack',
      collections
    });
  }
}

module.exports = { 
  handleBlackjackButtons,
  handleGameEnd
};