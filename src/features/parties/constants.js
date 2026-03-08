// Available party titles/roles that can be assigned to each party
const PARTY_TITLES = [
  'Shotcalls',
  'Main Ball',
  'Flank Party',
  'Flex Party',
  'Throne Capture',
  'Capture Party',
  'PvP Distraction Party',
  'PvE Damage Party',
  'PvE Farm Party',
  'Spinner',
  'Spawn Campers',
  'Portal 1',
  'Portal 2',
  'Portal 3',
  'Team Yellow',
  'Team Red',
  'Sewers',
  'Benched',
  'Reserve',
  'Unassigned - Fill Other Parties'
];

// Available individual player tags (assigned per-player within a party)
const PLAYER_TAGS = [
  'AoE Bomber',
  'Frontline Tank',
  'Diver',
  'Spinner',
  'Spinner Support',
  'Healer',
  'Scout',
  'Boss Damage'
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
  PLAYER_TAGS,
  WEAPONS,
  MAX_PARTIES,
  PARTY_SIZE,
  RESERVE_PARTY_SIZE,
  MAX_TANKS_PER_PARTY,
  MAX_HEALERS_PER_PARTY
};