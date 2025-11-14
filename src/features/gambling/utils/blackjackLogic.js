const {
  createDeck,
  calculateHandValue,
  isBlackjack,
  isBusted,
  drawCard,
  canSplit
} = require('./cardDeck');

/**
 * Create a new blackjack game state
 */
function createGame(userId, betAmount) {
  const deck = createDeck();

  // Deal initial cards
  const playerHand = [drawCard(deck), drawCard(deck)];
  const dealerHand = [drawCard(deck), drawCard(deck)];

  return {
    userId,
    betAmount,
    deck,
    playerHand,
    dealerHand,
    playerValue: calculateHandValue(playerHand),
    dealerValue: calculateHandValue([dealerHand[1]]), // Only show one dealer card initially
    status: 'playing', // 'playing', 'playerBusted', 'dealerTurn', 'finished'
    canDoubleDown: true,
    canSplit: canSplit(playerHand),
    splitHand: null,
    activeHand: 'main', // 'main' or 'split'
    doubledDown: false,
    result: null, // Will be set when game ends
    payout: 0
  };
}

/**
 * Player hits (draws a card)
 */
function hit(gameState) {
  const hand = gameState.activeHand === 'main' ? gameState.playerHand : gameState.splitHand;

  const newCard = drawCard(gameState.deck);
  hand.push(newCard);

  const value = calculateHandValue(hand);

  if (gameState.activeHand === 'main') {
    gameState.playerValue = value;
  }

  // Can't double down or split after first action
  gameState.canDoubleDown = false;
  gameState.canSplit = false;

  // Check for bust
  if (isBusted(hand)) {
    if (gameState.splitHand && gameState.activeHand === 'main') {
      // Switch to split hand
      gameState.activeHand = 'split';
    } else {
      gameState.status = 'playerBusted';
    }
  }

  return gameState;
}

/**
 * Player stands (ends their turn)
 */
function stand(gameState) {
  // Disable split and double after any action
  gameState.canDoubleDown = false;
  gameState.canSplit = false;

  // If playing split hand, switch to it
  if (gameState.splitHand && gameState.activeHand === 'main') {
    gameState.activeHand = 'split';
    return gameState;
  }

  gameState.status = 'dealerTurn';
  return gameState;
}

/**
 * Player doubles down (double bet, draw one card, then stand)
 */
function doubleDown(gameState) {
  if (!gameState.canDoubleDown) {
    throw new Error('Cannot double down at this point');
  }

  gameState.betAmount *= 2;
  gameState.doubledDown = true;

  // Draw one card
  const hand = gameState.activeHand === 'main' ? gameState.playerHand : gameState.splitHand;
  const newCard = drawCard(gameState.deck);
  hand.push(newCard);

  const value = calculateHandValue(hand);
  if (gameState.activeHand === 'main') {
    gameState.playerValue = value;
  }

  // Check for bust
  if (isBusted(hand)) {
    gameState.status = 'playerBusted';
  } else {
    // Automatically stand after doubling
    gameState.status = 'dealerTurn';
  }

  return gameState;
}

/**
 * Player splits their hand (if they have a pair)
 */
function split(gameState) {
  if (!gameState.canSplit) {
    throw new Error('Cannot split this hand');
  }

  // Can only split with exactly 2 cards
  if (gameState.playerHand.length !== 2) {
    throw new Error('Can only split with 2 cards');
  }

  // Split the hand
  const [card1, card2] = gameState.playerHand;
  gameState.playerHand = [card1, drawCard(gameState.deck)];
  gameState.splitHand = [card2, drawCard(gameState.deck)];

  gameState.playerValue = calculateHandValue(gameState.playerHand);

  // After splitting, can't split again or double
  gameState.canSplit = false;
  gameState.canDoubleDown = false;

  return gameState;
}

/**
 * Dealer plays their hand (hits on 16 or less, stands on 17+)
 */
function dealerPlay(gameState) {
  while (calculateHandValue(gameState.dealerHand) < 17) {
    gameState.dealerHand.push(drawCard(gameState.deck));
  }

  gameState.dealerValue = calculateHandValue(gameState.dealerHand);
  gameState.status = 'finished';

  return gameState;
}

/**
 * Determine the winner and calculate payout
 */
function determineWinner(gameState) {
  const playerValue = calculateHandValue(gameState.playerHand);
  const dealerValue = calculateHandValue(gameState.dealerHand);

  const playerBlackjack = isBlackjack(gameState.playerHand);
  const dealerBlackjack = isBlackjack(gameState.dealerHand);
  const playerBusted = isBusted(gameState.playerHand);
  const dealerBusted = isBusted(gameState.dealerHand);

  let result;
  let payout = 0;

  // Player busted
  if (playerBusted) {
    result = 'loss';
    payout = -gameState.betAmount;
  }
  // Both blackjack = push
  else if (playerBlackjack && dealerBlackjack) {
    result = 'push';
    payout = 0;
  }
  // Player blackjack = win 3:2
  else if (playerBlackjack) {
    result = 'blackjack';
    payout = Math.floor(gameState.betAmount * 1.5);
  }
  // Dealer busted, player didn't
  else if (dealerBusted) {
    result = 'win';
    payout = gameState.betAmount;
  }
  // Compare hands
  else if (playerValue > dealerValue) {
    result = 'win';
    payout = gameState.betAmount;
  }
  else if (playerValue < dealerValue) {
    result = 'loss';
    payout = -gameState.betAmount;
  }
  else {
    result = 'push';
    payout = 0;
  }

  gameState.result = result;
  gameState.payout = payout;

  return gameState;
}

module.exports = {
  createGame,
  hit,
  stand,
  doubleDown,
  split,
  dealerPlay,
  determineWinner
};