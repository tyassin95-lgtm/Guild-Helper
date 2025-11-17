const { activeGames, createGameButtons } = require('../commands/blackjack');
const { hit, stand, doubleDown, split, dealerPlay, determineWinner, determineSplitWinner } = require('../utils/blackjackLogic');
const { createBlackjackEmbed, createBlackjackResultEmbed } = require('../embeds/gameEmbeds');
const { addBalance, processWin, processLoss, processPush, getBalance, subtractBalance } = require('../utils/balanceManager');
const { calculateHandValue } = require('../utils/cardDeck');

// Store timeouts for auto-stand
const gameTimeouts = new Map();

async function handleBlackjackButtons({ interaction, collections }) {
  const userId = interaction.user.id;

  // Get active game
  const gameData = activeGames.get(userId);

  if (!gameData) {
    return interaction.reply({
      content: '❌ No active game found. Start a new game with `/blackjack`.',
      flags: [64]
    });
  }

  const { gameState, guildId } = gameData;

  // Clear existing timeout
  clearGameTimeout(userId);

  const action = interaction.customId.split('_')[1];

  try {
    let statusMessage = '';

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

          await handleGameEnd(interaction, gameState, collections);
          activeGames.delete(userId);
        } else {
          const embed = createBlackjackEmbed(gameState, true);
          embed.setDescription(`${embed.data.description}\n\n${statusMessage}`);
          embed.setFooter({ text: '⏱️ 30 seconds to make your next move' });

          const buttons = createGameButtons(gameState);
          await interaction.update({ embeds: [embed], components: [buttons] });

          setGameTimeout(userId, interaction, gameState, collections);
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
          activeGames.delete(userId);
        } else if (gameState.activeHand === 'split') {
          statusMessage = `✋ **First hand complete!**\n\nNow playing your **split hand**...`;
          const embed = createBlackjackEmbed(gameState, true);
          embed.setDescription(`${embed.data.description}\n\n${statusMessage}`);
          embed.setFooter({ text: '⏱️ 30 seconds to make your next move' });

          const buttons = createGameButtons(gameState);
          await interaction.update({ embeds: [embed], components: [buttons] });

          setGameTimeout(userId, interaction, gameState, collections);
        }
        break;

      case 'double':
        const balance = await getBalance({ userId, guildId, collections });

        if (balance.balance < gameState.betAmount) {
          return interaction.reply({
            content: '❌ Insufficient balance to double down!',
            flags: [64]
          });
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

          await handleGameEnd(interaction, gameState, collections);
          activeGames.delete(userId);
        } else {
          const doubleEmbed = createBlackjackEmbed(gameState, true);
          doubleEmbed.setDescription(`${doubleEmbed.data.description}\n\n${statusMessage}\n\n*Dealer reveals hidden card and plays...*`);
          await interaction.update({ embeds: [doubleEmbed], components: [] });

          await new Promise(resolve => setTimeout(resolve, 2000));

          dealerPlay(gameState);
          determineWinner(gameState);

          await handleGameEnd(interaction, gameState, collections, false, true);
          activeGames.delete(userId);
        }
        break;

      case 'split':
        const balanceForSplit = await getBalance({ userId, guildId, collections });

        if (balanceForSplit.balance < gameState.betAmount) {
          return interaction.reply({
            content: '❌ Insufficient balance to split!',
            flags: [64]
          });
        }

        await subtractBalance({ userId, guildId, amount: gameState.betAmount, collections });

        split(gameState);

        statusMessage = `✂️ **Split!** Your pair has been split into two hands.\n\nPlaying **first hand** now...`;

        const embedAfterSplit = createBlackjackEmbed(gameState, true);
        embedAfterSplit.setDescription(`${embedAfterSplit.data.description}\n\n${statusMessage}`);
        embedAfterSplit.setFooter({ text: '⏱️ 30 seconds to make your next move' });

        const buttonsAfterSplit = createGameButtons(gameState);
        await interaction.update({ embeds: [embedAfterSplit], components: [buttonsAfterSplit] });

        setGameTimeout(userId, interaction, gameState, collections);
        break;
    }
  } catch (error) {
    console.error('Blackjack button error:', error);

    activeGames.delete(userId);
    clearGameTimeout(userId);

    await interaction.reply({
      content: `❌ Error: ${error.message}`,
      flags: [64]
    }).catch(() => {});
  }
}

function setGameTimeout(userId, interaction, gameState, collections) {
  const timeout = setTimeout(async () => {
    console.log(`⏱️ Auto-standing for user ${userId} due to 30s timeout`);

    stand(gameState);

    if (gameState.status === 'dealerTurn') {
      dealerPlay(gameState);

      // If there's a split hand, determine both results
      if (gameState.splitHand) {
        determineSplitWinner(gameState);
      } else {
        determineWinner(gameState);
      }

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

function clearGameTimeout(userId) {
  if (gameTimeouts.has(userId)) {
    clearTimeout(gameTimeouts.get(userId));
    gameTimeouts.delete(userId);
  }
}

async function handleGameEnd(interaction, gameState, collections, isReply = false, isEdit = false, isTimeout = false) {
  const userId = gameState.userId;
  const guildId = activeGames.get(userId)?.guildId;

  clearGameTimeout(userId);

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
    resultEmbed.setFooter({ text: '⏱️ Game auto-completed (no action for 30 seconds)' });
  }

  if (isReply) {
    await interaction.reply({ embeds: [resultEmbed], components: [] });
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
  handleGameEnd,
  clearGameTimeout,
  gameTimeouts
};