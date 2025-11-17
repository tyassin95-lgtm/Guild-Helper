const { EmbedBuilder } = require('discord.js');
const { formatHand, calculateHandValue, isBlackjack } = require('../utils/cardDeck');

/**
 * Create balance display embed
 */
function createBalanceEmbed(user, balance, stats = null) {
  const embed = new EmbedBuilder()
    .setColor(0xFFD700) // Gold
    .setTitle(`💰 ${user.username}'s Gambling Balance`)
    .addFields(
      { name: '💵 Current Balance', value: `**${balance.balance.toLocaleString()}** coins`, inline: true }
    )
    .setTimestamp();

  if (stats) {
    const netProfitLoss = balance.totalWon - balance.totalLost;
    const profitLossDisplay = netProfitLoss >= 0 
      ? `+${netProfitLoss.toLocaleString()}` 
      : `${netProfitLoss.toLocaleString()}`;

    embed.addFields(
      { name: '🎰 Games Played', value: balance.gamesPlayed.toString(), inline: true },
      { name: '✅ Total Won (Gambling)', value: `${balance.totalWon.toLocaleString()} coins`, inline: true },
      { name: '❌ Total Lost (Gambling)', value: `${balance.totalLost.toLocaleString()} coins`, inline: true },
      { name: '📈 Net Gambling Profit', value: `${profitLossDisplay} coins`, inline: true }
    )
    .setFooter({ text: '💡 Stats only track gambling games (Blackjack, Coinflip)' });
  }

  return embed;
}

/**
 * Create daily claim success embed
 */
function createDailyClaimEmbed(user, claimResult) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle('🎁 Daily Reward Claimed!')
    .setDescription(`**+${claimResult.totalReward.toLocaleString()} coins**`)
    .addFields(
      { name: '💰 Base Reward', value: `${claimResult.baseReward.toLocaleString()} coins`, inline: true }
    );

  if (claimResult.streakBonus > 0) {
    embed.addFields(
      { name: '🔥 Streak Bonus', value: `${claimResult.streakBonus.toLocaleString()} coins`, inline: true }
    );
  }

  embed.addFields(
    { name: '📅 Current Streak', value: `${claimResult.currentStreak} day${claimResult.currentStreak !== 1 ? 's' : ''}`, inline: true },
    { name: '💵 New Balance', value: `${claimResult.newBalance.toLocaleString()} coins`, inline: false }
  );

  if (claimResult.isNewStreak) {
    embed.setFooter({ text: '⚠️ Your streak was reset! Claim daily to build it back up.' });
  } else if (claimResult.currentStreak < 20) {
    const nextMilestone = claimResult.currentStreak < 5 ? 5 : 
                         claimResult.currentStreak < 10 ? 10 :
                         claimResult.currentStreak < 15 ? 15 : 20;
    const daysUntil = nextMilestone - claimResult.currentStreak;
    embed.setFooter({ text: `Next milestone: ${nextMilestone} days (${daysUntil} days away!)` });
  }

  return embed;
}

/**
 * Create blackjack game embed
 */
function createBlackjackEmbed(gameState, hideDealer = true) {
  const playerValue = calculateHandValue(gameState.playerHand);
  const playerCards = formatHand(gameState.playerHand);

  let dealerCards, dealerValue, dealerDisplay;

  if (hideDealer) {
    // Show only one dealer card
    const visibleCard = gameState.dealerHand[1];
    const visibleValue = calculateHandValue([visibleCard]);
    dealerCards = `${formatHand([visibleCard])} 🂠`;
    dealerValue = `${visibleValue}+?`;
    dealerDisplay = `**Showing:** ${visibleValue}+?`;
  } else {
    dealerCards = formatHand(gameState.dealerHand);
    dealerValue = calculateHandValue(gameState.dealerHand);
    dealerDisplay = `**Total:** ${dealerValue}`;
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF0000) // Red
    .setTitle('🎰 BLACKJACK')
    .setDescription(`**💰 Current Bet:** ${gameState.betAmount.toLocaleString()} coins`)
    .addFields(
      { 
        name: '═══════════════════════════════════════',
        value: '** **',
        inline: false
      },
      { 
        name: `🤖 Dealer's Hand`, 
        value: `🃏 ${dealerCards}\n${dealerDisplay}`,
        inline: false 
      },
      { 
        name: '─────────────────────────────────────',
        value: '** **',
        inline: false
      },
      { 
        name: `👤 Your Hand`, 
        value: `🃏 ${playerCards}\n**Total:** ${playerValue}`,
        inline: false 
      },
      { 
        name: '═══════════════════════════════════════',
        value: '** **',
        inline: false
      }
    );

  // Add split hand if exists
  if (gameState.splitHand) {
    const splitValue = calculateHandValue(gameState.splitHand);
    const splitCards = formatHand(gameState.splitHand);

    const activeIndicator = gameState.activeHand === 'split' ? '👉 ' : '';

    embed.addFields({
      name: `${activeIndicator}👤 Your Split Hand`,
      value: `🃏 ${splitCards}\n**Total:** ${splitValue}`,
      inline: false
    });
  }

  return embed;
}

/**
 * Create blackjack result embed
 */
function createBlackjackResultEmbed(gameState, newBalance) {
  const playerValue = calculateHandValue(gameState.playerHand);
  const dealerValue = calculateHandValue(gameState.dealerHand);

  let color, title, resultText, resultEmoji;

  // If there's a split hand, show combined results
  if (gameState.splitHand && gameState.splitResult) {
    const splitValue = calculateHandValue(gameState.splitHand);
    const mainPayout = gameState.payout;
    const splitPayout = gameState.splitPayout;
    const totalPayout = mainPayout + splitPayout;

    // Determine overall color based on net result
    if (totalPayout > 0) {
      color = 0x00FF00; // Green
      title = '✅ NET WIN!';
      resultEmoji = '💰';
    } else if (totalPayout < 0) {
      color = 0xFF0000; // Red
      title = '❌ NET LOSS';
      resultEmoji = '💸';
    } else {
      color = 0xFFFF00; // Yellow
      title = '🤝 EVEN';
      resultEmoji = '⚖️';
    }

    // Build result text
    const mainResultText = formatSingleResult(gameState.result, mainPayout);
    const splitResultText = formatSingleResult(gameState.splitResult, splitPayout);

    resultText = 
      `**Hand 1:** ${mainResultText}\n` +
      `**Hand 2:** ${splitResultText}\n\n` +
      `**Net Result:** ${totalPayout >= 0 ? '+' : ''}${totalPayout.toLocaleString()} coins`;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${resultEmoji} ${title} (SPLIT)`)
      .setDescription(`**💰 Bet Per Hand:** ${gameState.betAmount.toLocaleString()} coins\n${resultText}`)
      .addFields(
        { 
          name: '═══════════════════════════════════════',
          value: '** **',
          inline: false
        },
        { 
          name: `🤖 Dealer's Hand`, 
          value: `🃏 ${formatHand(gameState.dealerHand)}\n**Total:** ${dealerValue}`,
          inline: false 
        },
        { 
          name: '─────────────────────────────────────',
          value: '** **',
          inline: false
        },
        { 
          name: `👤 Your Hand 1`, 
          value: `🃏 ${formatHand(gameState.playerHand)}\n**Total:** ${playerValue}\n**Result:** ${formatResultEmoji(gameState.result)}`,
          inline: true 
        },
        { 
          name: `👤 Your Hand 2`, 
          value: `🃏 ${formatHand(gameState.splitHand)}\n**Total:** ${splitValue}\n**Result:** ${formatResultEmoji(gameState.splitResult)}`,
          inline: true 
        },
        { 
          name: '═══════════════════════════════════════',
          value: '** **',
          inline: false
        },
        {
          name: '💵 New Balance',
          value: `**${newBalance.toLocaleString()} coins**`,
          inline: false
        }
      );

    return embed;
  }

  // Single hand result (original logic)
  switch (gameState.result) {
    case 'blackjack':
      color = 0xFFD700; // Gold
      title = 'BLACKJACK!';
      resultEmoji = '🎉';
      resultText = `You won **${gameState.payout.toLocaleString()} coins**! (3:2 payout)`;
      break;
    case 'win':
      color = 0x00FF00; // Green
      title = 'YOU WIN!';
      resultEmoji = '✅';
      resultText = `You won **${gameState.payout.toLocaleString()} coins**!`;
      break;
    case 'loss':
      color = 0xFF0000; // Red
      title = 'YOU LOSE';
      resultEmoji = '❌';
      resultText = `You lost **${Math.abs(gameState.payout).toLocaleString()} coins**`;
      break;
    case 'push':
      color = 0xFFFF00; // Yellow
      title = 'PUSH (TIE)';
      resultEmoji = '🤝';
      resultText = 'Your bet has been returned.';
      break;
    default:
      color = 0x808080; // Gray fallback
      title = 'GAME OVER';
      resultEmoji = '🎰';
      resultText = 'Game ended.';
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${resultEmoji} ${title}`)
    .setDescription(`**💰 Bet:** ${gameState.betAmount.toLocaleString()} coins\n${resultText}`)
    .addFields(
      { 
        name: '═══════════════════════════════════════',
        value: '** **',
        inline: false
      },
      { 
        name: `🤖 Dealer's Hand`, 
        value: `🃏 ${formatHand(gameState.dealerHand)}\n**Total:** ${dealerValue}`,
        inline: true 
      },
      { 
        name: `👤 Your Hand`, 
        value: `🃏 ${formatHand(gameState.playerHand)}\n**Total:** ${playerValue}`,
        inline: true 
      },
      { 
        name: '═══════════════════════════════════════',
        value: '** **',
        inline: false
      },
      {
        name: '💵 New Balance',
        value: `**${newBalance.toLocaleString()} coins**`,
        inline: false
      }
    );

  return embed;
}

/**
 * Helper: Format a single hand result
 */
function formatSingleResult(result, payout) {
  switch (result) {
    case 'blackjack':
      return `Blackjack! +${payout.toLocaleString()} coins 🎉`;
    case 'win':
      return `Win! +${payout.toLocaleString()} coins ✅`;
    case 'loss':
      return `Loss ${payout.toLocaleString()} coins ❌`;
    case 'push':
      return `Push (tie) 🤝`;
    default:
      return 'Unknown';
  }
}

/**
 * Helper: Get result emoji
 */
function formatResultEmoji(result) {
  switch (result) {
    case 'blackjack': return '🎉 Blackjack';
    case 'win': return '✅ Win';
    case 'loss': return '❌ Loss';
    case 'push': return '🤝 Push';
    default: return '❓';
  }
}

/**
 * Create coinflip game embed (during flip)
 */
function createCoinflipEmbed(betAmount, choice, flipping = true) {
  const embed = new EmbedBuilder()
    .setColor(0xC0C0C0) // Silver
    .setTitle('🪙 COINFLIP')
    .setDescription(`**Bet:** ${betAmount.toLocaleString()} coins`)
    .addFields(
      { name: 'Your Choice', value: choice === 'heads' ? '🦅 HEADS' : '🌊 TAILS', inline: true }
    );

  if (flipping) {
    embed.addFields({ name: 'Result', value: '🪙 Flipping...', inline: true });
  }

  return embed;
}

/**
 * Create coinflip result embed
 */
function createCoinflipResultEmbed(betAmount, choice, result, won, newBalance) {
  const resultEmoji = result === 'heads' ? '🦅' : '🌊';
  const resultText = result === 'heads' ? 'HEADS' : 'TAILS';
  const choiceEmoji = choice === 'heads' ? '🦅' : '🌊';
  const choiceText = choice === 'heads' ? 'HEADS' : 'TAILS';

  const color = won ? 0x00FF00 : 0xFF0000; // Green or Red
  const title = won ? '✅ YOU WIN!' : '❌ YOU LOSE';
  const description = won 
    ? `You won **${betAmount.toLocaleString()} coins**!` 
    : `You lost **${betAmount.toLocaleString()} coins**`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(`**Bet:** ${betAmount.toLocaleString()} coins\n\n${description}`)
    .addFields(
      { name: 'Your Choice', value: `${choiceEmoji} ${choiceText}`, inline: true },
      { name: 'Result', value: `${resultEmoji} ${resultText}`, inline: true },
      { name: '💰 New Balance', value: `${newBalance.toLocaleString()} coins`, inline: false }
    );

  return embed;
}

module.exports = {
  createBalanceEmbed,
  createDailyClaimEmbed,
  createBlackjackEmbed,
  createBlackjackResultEmbed,
  createCoinflipEmbed,
  createCoinflipResultEmbed
};