const { getRoleFromWeapons } = require('./roleDetection');
const { sendPartyAssignmentDM, sendPartyChangeDM } = require('./notifications');
const { MAX_PARTIES, PARTY_SIZE } = require('./constants');

/**
 * Auto-assign a player to the best available party
 */
async function autoAssignPlayer(userId, guildId, client, collections) {
  const { partyPlayers, parties, guildSettings } = collections;

  // Check if auto-assignment is enabled for this guild
  const settings = await guildSettings.findOne({ guildId });
  if (settings?.autoAssignmentEnabled === false) {
    return { success: false, reason: 'Auto-assignment disabled' };
  }

  // Get player info
  const player = await partyPlayers.findOne({ userId, guildId });
  if (!player || !player.weapon1 || !player.weapon2) {
    return { success: false, reason: 'Incomplete player info' };
  }

  // Check if already assigned
  if (player.partyNumber) {
    // Player already has a party, check if we should rebalance
    return { success: false, reason: 'Already assigned', partyNumber: player.partyNumber };
  }

  const role = getRoleFromWeapons(player.weapon1, player.weapon2);
  const cp = player.cp || 0;

  // Get all parties
  const allParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();

  // Find best party for this player
  let bestParty = findBestPartyForRole(allParties, role, cp);

  // If no suitable party exists, create a new one
  if (!bestParty) {
    if (allParties.length >= MAX_PARTIES) {
      return { success: false, reason: 'Max parties reached' };
    }

    // Create new party
    const newPartyNumber = getNextPartyNumber(allParties);
    await parties.insertOne({
      guildId,
      partyNumber: newPartyNumber,
      members: [],
      totalCP: 0,
      roleComposition: { tank: 0, healer: 0, dps: 0 },
      createdAt: new Date(),
      lastRebalanced: new Date()
    });

    bestParty = await parties.findOne({ guildId, partyNumber: newPartyNumber });
  }

  // Add player to party
  await parties.updateOne(
    { _id: bestParty._id },
    {
      $push: {
        members: {
          userId,
          weapon1: player.weapon1,
          weapon2: player.weapon2,
          cp,
          role,
          addedAt: new Date()
        }
      },
      $inc: {
        totalCP: cp,
        [`roleComposition.${role}`]: 1
      }
    }
  );

  // Update player record
  await partyPlayers.updateOne(
    { userId, guildId },
    {
      $set: {
        partyNumber: bestParty.partyNumber,
        autoAssigned: true,
        lastNotified: new Date()
      }
    }
  );

  // Send DM notification
  try {
    await sendPartyAssignmentDM(userId, bestParty.partyNumber, role, client, collections);
  } catch (err) {
    console.error(`Failed to send DM to ${userId}:`, err.message);
  }

  return { success: true, partyNumber: bestParty.partyNumber, role };
}

/**
 * Find the best party for a player based on their role and CP
 */
function findBestPartyForRole(allParties, role, cp) {
  // Filter parties that have space
  const partiesWithSpace = allParties.filter(p => (p.members?.length || 0) < PARTY_SIZE);

  if (partiesWithSpace.length === 0) {
    return null; // Need to create new party
  }

  // Priority 1: Parties missing this specific role
  if (role === 'tank') {
    const needsTank = partiesWithSpace.filter(p => (p.roleComposition?.tank || 0) === 0);
    if (needsTank.length > 0) {
      return selectPartyByCP(needsTank, cp);
    }
  }

  if (role === 'healer') {
    const needsHealer = partiesWithSpace.filter(p => (p.roleComposition?.healer || 0) === 0);
    if (needsHealer.length > 0) {
      return selectPartyByCP(needsHealer, cp);
    }
  }

  // Priority 2: Any party with space (CP balanced)
  return selectPartyByCP(partiesWithSpace, cp);
}

/**
 * Select party based on CP balancing
 * Prefer parties with below-average total CP
 */
function selectPartyByCP(parties, playerCP) {
  if (parties.length === 0) return null;
  if (parties.length === 1) return parties[0];

  // Calculate average CP across all parties
  const totalCP = parties.reduce((sum, p) => sum + (p.totalCP || 0), 0);
  const avgCP = totalCP / parties.length;

  // Prefer parties below average CP
  const belowAverage = parties.filter(p => (p.totalCP || 0) < avgCP);

  if (belowAverage.length > 0) {
    // Sort by lowest CP first
    belowAverage.sort((a, b) => (a.totalCP || 0) - (b.totalCP || 0));
    return belowAverage[0];
  }

  // If all are above average, just pick the lowest
  parties.sort((a, b) => (a.totalCP || 0) - (b.totalCP || 0));
  return parties[0];
}

/**
 * Get next available party number
 */
function getNextPartyNumber(allParties) {
  const usedNumbers = new Set(allParties.map(p => p.partyNumber));
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber++;
  }
  return nextNumber;
}

/**
 * Handle role change for a player
 */
async function handleRoleChange(userId, guildId, oldRole, newRole, client, collections) {
  const { partyPlayers, parties } = collections;

  const player = await partyPlayers.findOne({ userId, guildId });
  if (!player || !player.partyNumber) {
    return; // Not assigned to a party
  }

  // Update role in party members array
  await parties.updateOne(
    {
      guildId,
      partyNumber: player.partyNumber,
      'members.userId': userId
    },
    {
      $set: { 'members.$.role': newRole },
      $inc: {
        [`roleComposition.${oldRole}`]: -1,
        [`roleComposition.${newRole}`]: 1
      }
    }
  );

  // Check if we should consider moving the player
  // For now, we just notify them of the role change
  const { sendRoleChangeDM } = require('./notifications');
  try {
    await sendRoleChangeDM(userId, player.partyNumber, oldRole, newRole, client, collections);
  } catch (err) {
    console.error(`Failed to send role change DM to ${userId}:`, err.message);
  }
}

/**
 * Remove player from their party
 */
async function removePlayerFromParty(userId, guildId, collections) {
  const { partyPlayers, parties } = collections;

  const player = await partyPlayers.findOne({ userId, guildId });
  if (!player || !player.partyNumber) {
    return { success: false, reason: 'Not in a party' };
  }

  const party = await parties.findOne({ guildId, partyNumber: player.partyNumber });
  if (!party) {
    return { success: false, reason: 'Party not found' };
  }

  const member = party.members?.find(m => m.userId === userId);
  if (!member) {
    return { success: false, reason: 'Member not found in party' };
  }

  // Remove from party
  await parties.updateOne(
    { _id: party._id },
    {
      $pull: { members: { userId } },
      $inc: {
        totalCP: -(member.cp || 0),
        [`roleComposition.${member.role}`]: -1
      }
    }
  );

  // Update player record
  await partyPlayers.updateOne(
    { userId, guildId },
    { $unset: { partyNumber: '', autoAssigned: '' } }
  );

  return { success: true, partyNumber: player.partyNumber };
}

module.exports = {
  autoAssignPlayer,
  handleRoleChange,
  removePlayerFromParty
};