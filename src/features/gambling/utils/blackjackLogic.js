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
    payout: 0,
    splitResult: null, // For split hand
    splitPayout: 0
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
      // Main hand busted, switch to split hand
      gameState.activeHand = 'split';
      gameState.status = 'playing'; // Continue playing split hand
    } else {
      // No split hand or split hand also busted
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

  // If playing main hand and there's a split hand, switch to it
  if (gameState.splitHand && gameState.activeHand === 'main') {
    gameState.activeHand = 'split';
    gameState.status = 'playing'; // Continue playing split hand
    return gameState;
  }

  // Either no split hand, or we just finished the split hand
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

  // Disable further actions
  gameState.canDoubleDown = false;
  gameState.canSplit = false;

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

  // Main hand gets first card + new card
  gameState.playerHand = [card1, drawCard(gameState.deck)];

  // Split hand gets second card + new card
  gameState.splitHand = [card2, drawCard(gameState.deck)];

  gameState.playerValue = calculateHandValue(gameState.playerHand);

  // Set active hand to main (play main hand first)
  gameState.activeHand = 'main';

  // After splitting, can't split again or double (unless special rules)
  gameState.canSplit = false;
  gameState.canDoubleDown = false;

  // Status remains 'playing' for the main hand
  gameState.status = 'playing';

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
 * Determine the winner and calculate payout (for single hand or main hand)
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

/**
 * Determine winner for BOTH hands when split (called after dealer plays)
 */
function determineSplitWinner(gameState) {
  if (!gameState.splitHand) {
    throw new Error('No split hand to determine winner for');
  }

  const dealerValue = calculateHandValue(gameState.dealerHand);
  const dealerBusted = isBusted(gameState.dealerHand);
  const dealerBlackjack = isBlackjack(gameState.dealerHand);

  // Determine main hand result
  const mainValue = calculateHandValue(gameState.playerHand);
  const mainBusted = isBusted(gameState.playerHand);
  const mainBlackjack = isBlackjack(gameState.playerHand);

  if (mainBusted) {
    gameState.result = 'loss';
    gameState.payout = -gameState.betAmount;
  } else if (mainBlackjack && dealerBlackjack) {
    gameState.result = 'push';
    gameState.payout = 0;
  } else if (mainBlackjack) {
    gameState.result = 'blackjack';
    gameState.payout = Math.floor(gameState.betAmount * 1.5);
  } else if (dealerBusted) {
    gameState.result = 'win';
    gameState.payout = gameState.betAmount;
  } else if (mainValue > dealerValue) {
    gameState.result = 'win';
    gameState.payout = gameState.betAmount;
  } else if (mainValue < dealerValue) {
    gameState.result = 'loss';
    gameState.payout = -gameState.betAmount;
  } else {
    gameState.result = 'push';
    gameState.payout = 0;
  }

  // Determine split hand result
  const splitValue = calculateHandValue(gameState.splitHand);
  const splitBusted = isBusted(gameState.splitHand);
  const splitBlackjack = isBlackjack(gameState.splitHand);

  if (splitBusted) {
    gameState.splitResult = 'loss';
    gameState.splitPayout = -gameState.betAmount;
  } else if (splitBlackjack && dealerBlackjack) {
    gameState.splitResult = 'push';
    gameState.splitPayout = 0;
  } else if (splitBlackjack) {
    gameState.splitResult = 'blackjack';
    gameState.splitPayout = Math.floor(gameState.betAmount * 1.5);
  } else if (dealerBusted) {
    gameState.splitResult = 'win';
    gameState.splitPayout = gameState.betAmount;
  } else if (splitValue > dealerValue) {
    gameState.splitResult = 'win';
    gameState.splitPayout = gameState.betAmount;
  } else if (splitValue < dealerValue) {
    gameState.splitResult = 'loss';
    gameState.splitPayout = -gameState.betAmount;
  } else {
    gameState.splitResult = 'push';
    gameState.splitPayout = 0;
  }

  return gameState;
}

module.exports = {
  createGame,
  hit,
  stand,
  doubleDown,
  split,
  dealerPlay,
  determineWinner,
  determineSplitWinner
};