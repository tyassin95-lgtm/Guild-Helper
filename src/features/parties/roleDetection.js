/**
 * Role detection based on weapon combinations
 */

/**
 * Determine role from weapon combination
 * @param {string} weapon1 - Primary weapon
 * @param {string} weapon2 - Secondary weapon
 * @returns {string} - 'tank' | 'healer' | 'dps'
 */
function getRoleFromWeapons(weapon1, weapon2) {
  if (!weapon1 || !weapon2) return 'dps'; // Default to DPS if incomplete

  const w1 = weapon1.toLowerCase().trim();
  const w2 = weapon2.toLowerCase().trim();

  // Tank: Sword & Shield with anything
  if (w1.includes('sword') && w1.includes('shield')) return 'tank';
  if (w2.includes('sword') && w2.includes('shield')) return 'tank';

  // Healer: Orb/Wand or Wand/Bow (any order)
  const hasOrb = w1.includes('orb') || w2.includes('orb');
  const hasWand = w1.includes('wand') || w2.includes('wand');
  const hasBow = w1.includes('bow') || w2.includes('bow');

  if (hasOrb && hasWand) return 'healer';
  if (hasWand && hasBow) return 'healer';

  // Everything else is DPS
  return 'dps';
}

/**
 * Get role emoji
 */
function getRoleEmoji(role) {
  switch (role) {
    case 'tank': return '🛡️';
    case 'healer': return '💚';
    case 'dps': return '⚔️';
    default: return '❓';
  }
}

/**
 * Get role display name
 */
function getRoleDisplayName(role) {
  switch (role) {
    case 'tank': return 'Tank';
    case 'healer': return 'Healer';
    case 'dps': return 'DPS';
    default: return 'Unknown';
  }
}

/**
 * Update player's role in database
 */
async function updatePlayerRole(userId, guildId, weapon1, weapon2, collections) {
  const { partyPlayers } = collections;

  const role = getRoleFromWeapons(weapon1, weapon2);

  await partyPlayers.updateOne(
    { userId, guildId },
    { $set: { role, updatedAt: new Date() } }
  );

  return role;
}

module.exports = {
  getRoleFromWeapons,
  getRoleEmoji,
  getRoleDisplayName,
  updatePlayerRole
};