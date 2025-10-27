// Available weapons for role selection
const WEAPONS = [
  { name: 'Orb', emoji: '🔮' },
  { name: 'Wand', emoji: '🪄' },
  { name: 'Sword & Shield', emoji: '🛡️' },
  { name: 'Greatsword', emoji: '⚔️' },
  { name: 'Staff', emoji: '🪶' },
  { name: 'Bow', emoji: '🏹' },
  { name: 'Crossbows', emoji: '🎯' },
  { name: 'Daggers', emoji: '🗡️' },
  { name: 'Spear', emoji: '🔱' }
];

const MAX_PARTIES = 10; // Default maximum, can be configured per guild
const PARTY_SIZE = 6;
const MAX_TANKS_PER_PARTY = 1;
const MAX_HEALERS_PER_PARTY = 2;

module.exports = { 
  WEAPONS, 
  MAX_PARTIES, 
  PARTY_SIZE,
  MAX_TANKS_PER_PARTY,
  MAX_HEALERS_PER_PARTY
};