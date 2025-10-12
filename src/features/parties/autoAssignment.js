const { getRoleFromWeapons } = require('./roleDetection');
const { sendPartyAssignmentDM, sendPartyChangeDM } = require('./notifications');
const { MAX_PARTIES, PARTY_SIZE } = require('./constants');

/**
 * Analyze party composition
 */
function analyzePartyComposition(party) {
  const members = party.members || [];
  return {
    tanks: members.filter(m => m.role === 'tank').length,
    healers: members.filter(m => m.role === 'healer').length,
    dps: members.filter(m => m.role === 'dps').length,
    totalMembers: members.length
  };
}

/**
 * Add player to a party
 */
async function addPlayerToParty(player, party, guildId, collections) {
  const { parties, partyPlayers } = collections;

  await parties.updateOne(
    { _id: party._id, guildId: guildId },
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

  await partyPlayers.updateOne(
    { userId: player.userId, guildId },
    {
      $set: {
        partyNumber: party.partyNumber,
        autoAssigned: true,
        lastNotified: new Date()
      }
    }
  );
}

/**
 * Remove player from their current party
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

  await partyPlayers.updateOne(
    { userId, guildId },
    { $unset: { partyNumber: '', autoAssigned: '' } }
  );

  return { success: true, partyNumber: player.partyNumber };
}

/**
 * Assign tank or healer by priority (sequential party filling + substitution)
 */
async function assignTankOrHealerByPriority(player, role, allParties, guildId, client, collections) {
  const { parties, partyPlayers } = collections;

  // Sort parties by party number (lowest first)
  const sortedParties = [...allParties]
    .filter(p => (p.members?.length || 0) < PARTY_SIZE)
    .sort((a, b) => a.partyNumber - b.partyNumber);

  // Phase 1: Find first party missing this role
  for (const party of sortedParties) {
    const comp = analyzePartyComposition(party);

    if (role === 'tank' && comp.tanks === 0) {
      await addPlayerToParty(player, party, guildId, collections);
      console.log(`[Priority Assignment] ${role} assigned to Party ${party.partyNumber} (filling gap)`);
      return { success: true, partyNumber: party.partyNumber };
    }

    if (role === 'healer' && comp.healers === 0) {
      await addPlayerToParty(player, party, guildId, collections);
      console.log(`[Priority Assignment] ${role} assigned to Party ${party.partyNumber} (filling gap)`);
      return { success: true, partyNumber: party.partyNumber };
    }
  }

  // Phase 2: All parties have this role - check for substitution (higher CP replaces lower CP in lower party numbers)
  const allSortedParties = [...allParties].sort((a, b) => a.partyNumber - b.partyNumber);

  for (const party of allSortedParties) {
    const members = party.members || [];
    const existingRole = members.find(m => m.role === role);

    if (existingRole && player.cp > existingRole.cp) {
      console.log(`[Substitution] Swapping ${role}: ${existingRole.cp} CP → ${player.cp} CP in Party ${party.partyNumber}`);

      // Remove lower CP player
      await parties.updateOne(
        { _id: party._id },
        {
          $pull: { members: { userId: existingRole.userId } },
          $inc: {
            totalCP: -(existingRole.cp || 0),
            [`roleComposition.${role}`]: -1
          }
        }
      );

      // Add higher CP player
      await addPlayerToParty(player, party, guildId, collections);

      // Send DM to substituted player
      try {
        await sendPartyChangeDM(
          player.userId,
          null,
          party.partyNumber,
          `Higher CP ${role} substitution`,
          client,
          collections
        );
      } catch (err) {
        console.error(`Failed to send substitution DM:`, err.message);
      }

      // Reassign the removed player to a new party
      const removedPlayerData = await partyPlayers.findOne({ userId: existingRole.userId, guildId });
      if (removedPlayerData) {
        removedPlayerData.partyNumber = null; // Clear assignment
        await partyPlayers.updateOne(
          { userId: existingRole.userId, guildId },
          { $unset: { partyNumber: '', autoAssigned: '' } }
        );

        // Re-auto-assign them
        setTimeout(async () => {
          await autoAssignPlayer(existingRole.userId, guildId, client, collections);
        }, 1000);
      }

      return { success: true, partyNumber: party.partyNumber, substituted: true };
    }
  }

  // Phase 3: No substitution possible, assign to any available party
  if (sortedParties.length > 0) {
    const targetParty = sortedParties[0];
    await addPlayerToParty(player, targetParty, guildId, collections);
    console.log(`[Priority Assignment] ${role} assigned to Party ${targetParty.partyNumber} (no substitution)`);
    return { success: true, partyNumber: targetParty.partyNumber };
  }

  return { success: false, reason: 'No suitable party found' };
}

/**
 * Assign DPS by strength priority (higher CP → lower party numbers)
 */
async function assignDPSByStrength(player, allParties, guildId, collections) {
  // Sort parties by party number (lowest first)
  const sortedParties = [...allParties]
    .filter(p => (p.members?.length || 0) < PARTY_SIZE)
    .sort((a, b) => a.partyNumber - b.partyNumber);

  if (sortedParties.length === 0) return null;

  // Strategy: Assign to the lowest-numbered party that needs DPS
  for (const party of sortedParties) {
    const comp = analyzePartyComposition(party);

    // Ensure party has viability (1T + 1H) before accepting more DPS
    if (comp.tanks === 0 || comp.healers === 0) {
      continue; // Skip this party, needs critical roles first
    }

    // Assign here
    await addPlayerToParty(player, party, guildId, collections);
    console.log(`[DPS Assignment] DPS (${player.cp} CP) assigned to Party ${party.partyNumber}`);
    return { success: true, partyNumber: party.partyNumber };
  }

  // No viable party found - assign to first available (even if missing T/H)
  const firstAvailable = sortedParties[0];
  if (firstAvailable) {
    await addPlayerToParty(player, firstAvailable, guildId, collections);
    console.log(`[DPS Assignment] DPS (${player.cp} CP) assigned to Party ${firstAvailable.partyNumber} (non-viable)`);
    return { success: true, partyNumber: firstAvailable.partyNumber };
  }

  return null;
}

/**
 * Auto-assign a player to the best available party (strength-based system)
 */
async function autoAssignPlayer(userId, guildId, client, collections) {
  const { partyPlayers, parties, guildSettings } = collections;

  // Check if auto-assignment is enabled
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

  // Get all existing parties
  let allParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();

  // If no parties exist, create Party 1
  if (allParties.length === 0) {
    await parties.insertOne({
      guildId,
      partyNumber: 1,
      members: [],
      totalCP: 0,
      roleComposition: { tank: 0, healer: 0, dps: 0 },
      createdAt: new Date(),
      lastRebalanced: new Date()
    });

    allParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();
  }

  let result;

  // Route based on role
  if (role === 'tank' || role === 'healer') {
    result = await assignTankOrHealerByPriority(player, role, allParties, guildId, client, collections);
  } else {
    result = await assignDPSByStrength(player, allParties, guildId, collections);
  }

  // If no suitable party found, create a new one
  if (!result || !result.success) {
    if (allParties.length >= MAX_PARTIES) {
      return { success: false, reason: 'Max parties reached' };
    }

    const nextNumber = getNextPartyNumber(allParties);
    await parties.insertOne({
      guildId,
      partyNumber: nextNumber,
      members: [],
      totalCP: 0,
      roleComposition: { tank: 0, healer: 0, dps: 0 },
      createdAt: new Date(),
      lastRebalanced: new Date()
    });

    const newParty = await parties.findOne({ guildId, partyNumber: nextNumber });
    await addPlayerToParty(player, newParty, guildId, collections);

    result = { success: true, partyNumber: nextNumber };
  }

  // Send DM notification
  if (result.success && !result.substituted) {
    try {
      await sendPartyAssignmentDM(userId, result.partyNumber, role, client, collections);
    } catch (err) {
      console.error(`Failed to send DM to ${userId}:`, err.message);
    }
  }

  return result;
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

  try {
    const player = await partyPlayers.findOne({ userId, guildId });
    if (!player || !player.partyNumber) {
      console.log(`[handleRoleChange] Player ${userId} not in a party, skipping`);
      return;
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

    // Send DM notification (non-blocking)
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
    throw err;
  }
}

module.exports = {
  autoAssignPlayer,
  handleRoleChange,
  removePlayerFromParty,
  analyzePartyComposition,
  addPlayerToParty
};