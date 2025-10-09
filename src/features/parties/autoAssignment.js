const { getRoleFromWeapons } = require('./roleDetection');
const { sendPartyAssignmentDM, sendPartyChangeDM } = require('./notifications');
const { MAX_PARTIES, PARTY_SIZE } = require('./constants');
const { smartRebalanceNewParty } = require('./smartRebalancing');

/**
 * Find parties that are missing a specific role
 * SECURITY: Only returns parties from the specified guild
 */
async function findPartiesMissingRole(guildId, role, collections) {
  const { parties } = collections;

  // CRITICAL: Filter by guildId to prevent cross-guild contamination
  const allParties = await parties.find({ 
    guildId: guildId, // SECURITY: Explicit guild filter
    $expr: { $lt: [{ $size: { $ifNull: ['$members', []] } }, PARTY_SIZE] } // Not full
  }).toArray();

  console.log(`[findPartiesMissingRole] Found ${allParties.length} parties in guild ${guildId}`);

  const partiesNeedingRole = [];

  for (const party of allParties) {
    // SECURITY: Double-check guildId
    if (party.guildId !== guildId) {
      console.error(`[SECURITY VIOLATION] Party ${party.partyNumber} has wrong guildId! Expected: ${guildId}, Got: ${party.guildId}`);
      continue;
    }

    const members = party.members || [];
    const composition = {
      tanks: members.filter(m => m.role === 'tank').length,
      healers: members.filter(m => m.role === 'healer').length,
      dps: members.filter(m => m.role === 'dps').length
    };

    if (role === 'tank' && composition.tanks === 0) {
      partiesNeedingRole.push(party);
    } else if (role === 'healer' && composition.healers === 0) {
      partiesNeedingRole.push(party);
    }
  }

  console.log(`[findPartiesMissingRole] Found ${partiesNeedingRole.length} parties needing ${role}`);

  return partiesNeedingRole;
}

/**
 * Assign player to a party that needs their role (using CP clustering)
 */
async function assignToPartyWithRoleNeed(player, partiesNeedingRole, guildId, client, collections) {
  const { parties, partyPlayers } = collections;

  if (partiesNeedingRole.length === 0) {
    return { success: false, reason: 'No parties need this role' };
  }

  // If only one party needs the role, assign there
  if (partiesNeedingRole.length === 1) {
    const targetParty = partiesNeedingRole[0];

    // SECURITY: Verify party belongs to correct guild
    if (targetParty.guildId !== guildId) {
      console.error(`[SECURITY] Attempted cross-guild assignment! Party guild: ${targetParty.guildId}, Player guild: ${guildId}`);
      return { success: false, reason: 'Guild mismatch error' };
    }

    // Add player to party
    await parties.updateOne(
      { _id: targetParty._id, guildId: guildId }, // FIXED: Add guildId check
      {
        $push: {
          members: {
            userId: player.userId,
            weapon1: player.weapon1,
            weapon2: player.weapon2,
            cp: player.cp || 0,
            role: player.role,
            addedAt: new Date()
          }
        },
        $inc: {
          totalCP: (player.cp || 0),
          [`roleComposition.${player.role}`]: 1
        }
      }
    );

    // Update player record
    await partyPlayers.updateOne(
      { userId: player.userId, guildId },
      {
        $set: {
          partyNumber: targetParty.partyNumber,
          autoAssigned: true,
          lastNotified: new Date()
        }
      }
    );

    // Send DM
    try {
      await sendPartyAssignmentDM(player.userId, targetParty.partyNumber, player.role, client, collections);
    } catch (err) {
      console.error(`Failed to send DM to ${player.userId}:`, err.message);
    }

    return { success: true, partyNumber: targetParty.partyNumber, role: player.role };
  }

  // Multiple parties need this role - use CP clustering
  const playerCP = player.cp || 0;

  // Calculate which party has closest average CP
  let closestParty = null;
  let smallestDiff = Infinity;

  for (const party of partiesNeedingRole) {
    const members = party.members || [];
    if (members.length === 0) {
      closestParty = party;
      break;
    }

    // SECURITY: Skip parties from wrong guild
    if (party.guildId !== guildId) {
      console.error(`[SECURITY] Skipping party from wrong guild! Party guild: ${party.guildId}, Player guild: ${guildId}`);
      continue;
    }

    const totalCP = members.reduce((sum, m) => sum + (m.cp || 0), 0);
    const avgCP = totalCP / members.length;
    const diff = Math.abs(playerCP - avgCP);

    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestParty = party;
    }
  }

  // Add player to closest party
  await parties.updateOne(
    { _id: closestParty._id, guildId: guildId }, // FIXED: Add guildId check
    {
      $push: {
        members: {
          userId: player.userId,
          weapon1: player.weapon1,
          weapon2: player.weapon2,
          cp: player.cp || 0,
          role: player.role,
          addedAt: new Date()
        }
      },
      $inc: {
        totalCP: (player.cp || 0),
        [`roleComposition.${player.role}`]: 1
      }
    }
  );

  // Update player record
  await partyPlayers.updateOne(
    { userId: player.userId, guildId },
    {
      $set: {
        partyNumber: closestParty.partyNumber,
        autoAssigned: true,
        lastNotified: new Date()
      }
    }
  );

  // Send DM
  try {
    await sendPartyAssignmentDM(player.userId, closestParty.partyNumber, player.role, client, collections);
  } catch (err) {
    console.error(`Failed to send DM to ${player.userId}:`, err.message);
  }

  return { success: true, partyNumber: closestParty.partyNumber, role: player.role };
}

/**
 * Auto-assign a player to the best available party
 * ENHANCED: Checks for role needs across ALL parties first
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
    return { success: false, reason: 'Already assigned', partyNumber: player.partyNumber };
  }

  const role = getRoleFromWeapons(player.weapon1, player.weapon2);
  const cp = player.cp || 0;

  // PRIORITY CHECK: If player is tank or healer, check if ANY party needs them
  if (role === 'tank' || role === 'healer') {
    const partiesNeedingRole = await findPartiesMissingRole(guildId, role, collections);

    if (partiesNeedingRole.length > 0) {
      console.log(`Found ${partiesNeedingRole.length} parties needing ${role}, assigning ${userId} there`);
      return await assignToPartyWithRoleNeed(player, partiesNeedingRole, guildId, client, collections);
    }
  }

  // FALLBACK: Use normal assignment logic (CP clustering)
  const allParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();

  // Find best party for this player
  let bestParty = findBestPartyForRole(allParties, role, cp);

  // Track if we need to trigger smart rebalancing
  let shouldRebalance = false;
  let previousFullPartyNumber = null;

  // If no suitable party exists, create a new one
  if (!bestParty) {
    if (allParties.length >= MAX_PARTIES) {
      return { success: false, reason: 'Max parties reached' };
    }

    // Check if there was a previous full party
    const previousFullParty = allParties.find(p => (p.members?.length || 0) >= PARTY_SIZE);
    if (previousFullParty) {
      shouldRebalance = true;
      previousFullPartyNumber = previousFullParty.partyNumber;
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
    { _id: bestParty._id, guildId: guildId }, // FIXED: Add guildId check
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

  // Trigger smart rebalancing if this was a new party created from a full party
  if (shouldRebalance && previousFullPartyNumber) {
    try {
      await smartRebalanceNewParty(
        previousFullPartyNumber,
        bestParty.partyNumber,
        guildId,
        client,
        collections
      );
    } catch (err) {
      console.error('Smart rebalancing failed:', err);
    }
  }

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
 * FIXED: Better error handling and async operations
 */
async function handleRoleChange(userId, guildId, oldRole, newRole, client, collections) {
  const { partyPlayers, parties } = collections;

  try {
    const player = await partyPlayers.findOne({ userId, guildId });
    if (!player || !player.partyNumber) {
      console.log(`[handleRoleChange] Player ${userId} not in a party, skipping`);
      return; // Not assigned to a party
    }

    console.log(`[handleRoleChange] ${userId} role change: ${oldRole} → ${newRole} in Party ${player.partyNumber}`);

    // Update role in party members array AND update weapons
    await parties.updateOne(
      {
        guildId,
        partyNumber: player.partyNumber,
        'members.userId': userId
      },
      {
        $set: { 
          'members.$.role': newRole,
          'members.$.weapon1': player.weapon1,
          'members.$.weapon2': player.weapon2
        },
        $inc: {
          [`roleComposition.${oldRole}`]: -1,
          [`roleComposition.${newRole}`]: 1
        }
      }
    );

    console.log(`[handleRoleChange] Updated party document for ${userId}`);

    // Send DM notification (non-blocking - don't wait for it)
    const { sendRoleChangeDM } = require('./notifications');
    setImmediate(async () => {
      try {
        await sendRoleChangeDM(userId, player.partyNumber, oldRole, newRole, client, collections);
        console.log(`[handleRoleChange] Sent role change DM to ${userId}`);
      } catch (err) {
        console.error(`[handleRoleChange] Failed to send role change DM to ${userId}:`, err.message);
      }
    });
  } catch (err) {
    console.error(`[handleRoleChange] Error for ${userId}:`, err);
    throw err; // Re-throw so caller knows it failed
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
  removePlayerFromParty,
  findPartiesMissingRole
};