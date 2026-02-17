// Available party titles/roles that can be assigned to each party
const PARTY_TITLES = [
  'PvP Main Ball',
  'PvP Flank Party',
  'PvP Capture Party',
  'PvE Damage Party',
  'PvE Event Party',
  'PvP Distraction Party',
  'Reserve',
  'Shotcalls'
];

// Available weapons for role selection
const WEAPONS = [
  { name: 'Orb', emoji: '🔮' },
  { name: 'Wand', emoji: '🪄' },
  { name: 'SnS', emoji: '🛡️' },
  { name: 'Greatsword', emoji: '⚔️' },
  { name: 'Staff', emoji: '🪶' },
  { name: 'Bow', emoji: '🏹' },
  { name: 'Crossbows', emoji: '🎯' },
  { name: 'Daggers', emoji: '🗡️' },
  { name: 'Spear', emoji: '🔱' }
];

const MAX_PARTIES = 10; // Default maximum, can be configured per guild
const PARTY_SIZE = 6;
const RESERVE_PARTY_SIZE = 30;
const MAX_TANKS_PER_PARTY = 1;
const MAX_HEALERS_PER_PARTY = 2;

module.exports = {
  PARTY_TITLES,
  WEAPONS,
  MAX_PARTIES,
  PARTY_SIZE,
  RESERVE_PARTY_SIZE,
  MAX_TANKS_PER_PARTY,
  MAX_HEALERS_PER_PARTY
};