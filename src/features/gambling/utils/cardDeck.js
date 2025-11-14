/**
 * Card deck management for blackjack
 */

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * Create a shuffled deck of cards
 */
function createDeck() {
  const deck = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }

  // Shuffle using Fisher-Yates algorithm
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * Get the value of a card (for calculation purposes)
 */
function getCardValue(card) {
  if (card.rank === 'A') return 11; // Aces are 11 by default
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

/**
 * Calculate the best hand value considering Aces
 */
function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank);
    }
  }

  // Adjust for Aces if busted
  while (value > 21 && aces > 0) {
    value -= 10; // Convert an Ace from 11 to 1
    aces--;
  }

  return value;
}

/**
 * Check if hand is a blackjack (21 with 2 cards)
 */
function isBlackjack(hand) {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

/**
 * Check if hand is busted (over 21)
 */
function isBusted(hand) {
  return calculateHandValue(hand) > 21;
}

/**
 * Format a card for display
 */
function formatCard(card, hidden = false) {
  if (hidden) {
    return '🂠'; // Card back
  }
  return `${card.rank}${card.suit}`;
}

/**
 * Format a hand for display
 */
function formatHand(hand, hideFirst = false) {
  return hand.map((card, index) => {
    if (hideFirst && index === 0) {
      return formatCard(card, true);
    }
    return formatCard(card);
  }).join(' ');
}

/**
 * Check if hand can be split (two cards of same rank)
 */
function canSplit(hand) {
  if (hand.length !== 2) return false;
  return hand[0].rank === hand[1].rank;
}

/**
 * Draw a card from deck
 */
function drawCard(deck) {
  if (deck.length === 0) {
    throw new Error('Deck is empty');
  }
  return deck.pop();
}

module.exports = {
  createDeck,
  getCardValue,
  calculateHandValue,
  isBlackjack,
  isBusted,
  formatCard,
  formatHand,
  canSplit,
  drawCard,
  SUITS,
  RANKS
};