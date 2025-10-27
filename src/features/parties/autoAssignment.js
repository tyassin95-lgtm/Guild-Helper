const { getRoleFromWeapons } = require('./roleDetection');
const { sendPartyAssignmentDM, sendPartyChangeDM } = require('./notifications');
const { MAX_PARTIES, PARTY_SIZE, MAX_TANKS_PER_PARTY, MAX_HEALERS_PER_PARTY } = require('./constants');
const { shouldRouteToReserve, attemptReserveAssignment, moveToReserve } = require('./reserve');

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
 * Check if party can accept this role (respecting caps)
 */
function canAcceptRole(party, role) {
  const comp = analyzePartyComposition(party);

  if (role === 'tank' && comp.tanks >= MAX_TANKS_PER_PARTY) {
    return false;
  }

  if (role === 'healer' && comp.healers >= MAX_HEALERS_PER_PARTY) {
    return false;
  }

  // DPS can fill any remaining slots
  if (comp.totalMembers >= PARTY_SIZE) {
    return false;
  }

  return true;
}

/**
 * Assign tank or healer by priority (sequential party filling + substitution)
 */
async function assignTankOrHealerByPriority(player, role, allParties, guildId, client, collections) {
  const { parties, partyPlayers, guildSettings } = collections;

  const settings = await guildSettings.findOne({ guildId });
  const maxParties = settings?.maxParties || MAX_PARTIES;

  // Filter to only active parties within limit
  const activeParties = allParties.filter(p => p.partyNumber <= maxParties);

  // Sort parties by party number (lowest first)
  const sortedParties = [...activeParties]
    .filter(p => (p.members?.length || 0) < PARTY_SIZE)
    .sort((a, b) => a.partyNumber - b.partyNumber);

  // Phase 1: Find first party missing this role (respecting caps)
  for (const party of sortedParties) {
    const comp = analyzePartyComposition(party);

    if (role === 'tank' && comp.tanks === 0) {
      await addPlayerToParty(player, party, guildId, collections);
      console.log(`[Priority Assignment] ${role} assigned to Party ${party.partyNumber} (filling gap)`);
      return { success: true, partyNumber: party.partyNumber };
    }

    if (role === 'healer' && comp.healers < MAX_HEALERS_PER_PARTY) {
      if (canAcceptRole(party, role)) {
        await addPlayerToParty(player, party, guildId, collections);
        console.log(`[Priority Assignment] ${role} assigned to Party ${party.partyNumber} (filling gap)`);
        return { success: true, partyNumber: party.partyNumber };
      }
    }
  }

  // Phase 2: Check for substitution if at max parties
  if (activeParties.length >= maxParties) {
    console.log(`[Priority Assignment] Max parties reached, checking substitution for ${role}`);

    const allSortedParties = [...activeParties].sort((a, b) => a.partyNumber - b.partyNumber);

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
            existingRole.userId,
            party.partyNumber,
            null,
            `Higher CP ${role} substitution`,
            guildId,
            client,
            collections
          );
        } catch (err) {
          console.error(`Failed to send substitution DM:`, err.message);
        }

        // Move displaced player to reserve
        await moveToReserve(existingRole.userId, guildId, `Substituted by higher CP ${role}`, collections);

        // Try to reassign from reserve immediately
        const removedPlayerData = await partyPlayers.findOne({ userId: existingRole.userId, guildId });
        if (removedPlayerData) {
          setTimeout(async () => {
            await attemptReserveAssignment(removedPlayerData, guildId, client, collections);
          }, 1000);
        }

        return { success: true, partyNumber: party.partyNumber, substituted: true };
      }
    }

    // No substitution possible - route to reserve
    console.log(`[Priority Assignment] No substitution possible for ${role}, routing to reserve`);
    await moveToReserve(player.userId, guildId, 'Party limit reached - awaiting slot', collections);
    return { success: true, routed: 'reserve' };
  }

  // Phase 3: No substitution needed, assign to any available party
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
async function assignDPSByStrength(player, allParties, guildId, client, collections) {
  const { guildSettings } = collections;

  const settings = await guildSettings.findOne({ guildId });
  const maxParties = settings?.maxParties || MAX_PARTIES;

  // Filter to only active parties within limit
  const activeParties = allParties.filter(p => p.partyNumber <= maxParties);

  // Sort parties by party number (lowest first)
  const sortedParties = [...activeParties]
    .filter(p => (p.members?.length || 0) < PARTY_SIZE)
    .sort((a, b) => a.partyNumber - b.partyNumber);

  if (sortedParties.length === 0) {
    // Check if we're at max parties
    if (activeParties.length >= maxParties) {
      // Try substitution
      for (const party of activeParties) {
        const dpsList = party.members?.filter(m => m.role === 'dps') || [];
        if (dpsList.length > 0) {
          const weakestDPS = dpsList.reduce((min, d) => (d.cp || 0) < (min.cp || 0) ? d : min);

          if (player.cp > (weakestDPS.cp || 0)) {
            console.log(`[DPS Substitution] ${player.cp} CP > ${weakestDPS.cp} CP in Party ${party.partyNumber}`);

            // Remove weaker DPS
            await collections.parties.updateOne(
              { _id: party._id },
              {
                $pull: { members: { userId: weakestDPS.userId } },
                $inc: {
                  totalCP: -(weakestDPS.cp || 0),
                  'roleComposition.dps': -1
                }
              }
            );

            // Add stronger DPS
            await addPlayerToParty(player, party, guildId, collections);

            // Move displaced DPS to reserve
            await moveToReserve(weakestDPS.userId, guildId, 'Substituted by higher CP DPS', collections);

            return { success: true, partyNumber: party.partyNumber, substituted: true };
          }
        }
      }

      // No substitution possible - route to reserve
      console.log(`[DPS Assignment] Cannot substitute, routing to reserve`);
      await moveToReserve(player.userId, guildId, 'Party limit reached - lower CP', collections);
      return { success: true, routed: 'reserve' };
    }

    return null;
  }

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
 * Auto-assign a player to the best available party (strength-based system with reserve support)
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

  // Check if in reserve - try to assign from reserve
  if (player.inReserve) {
    console.log(`[Auto-Assign] Player ${userId} in reserve, attempting assignment`);
    const result = await attemptReserveAssignment(player, guildId, client, collections);

    if (result.success) {
      return { success: true, partyNumber: result.partyNumber, fromReserve: true };
    } else {
      return { success: false, reason: 'Still in reserve - no suitable placement' };
    }
  }

  const role = getRoleFromWeapons(player.weapon1, player.weapon2);
  const cp = player.cp || 0;

  const maxParties = settings?.maxParties || MAX_PARTIES;

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

  // Check if should route to reserve (max parties reached and all viable)
  const shouldReserve = await shouldRouteToReserve(guildId, collections);

  let result;

  // Route based on role
  if (role === 'tank' || role === 'healer') {
    result = await assignTankOrHealerByPriority(player, role, allParties, guildId, client, collections);
  } else {
    result = await assignDPSByStrength(player, allParties, guildId, collections);
  }

  // If routed to reserve, notify player
  if (result && result.routed === 'reserve') {
    console.log(`[Auto-Assign] Player ${userId} routed to reserve`);

    const { sendReserveDemotionDM } = require('./notifications');
    try {
      await sendReserveDemotionDM(userId, null, guildId, client, collections);
    } catch (err) {
      console.error(`Failed to send reserve DM to ${userId}:`, err.message);
    }

    return { success: true, routed: 'reserve' };
  }

  // If no suitable party found and not at max, create a new one
  if (!result || !result.success) {
    const activePartyCount = allParties.filter(p => p.partyNumber <= maxParties).length;

    if (activePartyCount >= maxParties) {
      // Route to reserve
      console.log(`[Auto-Assign] Max parties reached, routing ${userId} to reserve`);
      await moveToReserve(player.userId, guildId, 'Party limit reached - awaiting slot', collections);

      const { sendReserveDemotionDM } = require('./notifications');
      try {
        await sendReserveDemotionDM(userId, null, guildId, client, collections);
      } catch (err) {
        console.error(`Failed to send reserve DM to ${userId}:`, err.message);
      }

      return { success: true, routed: 'reserve' };
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

  // Send DM notification (if not substituted and not routed to reserve)
  if (result.success && !result.substituted && !result.routed) {
    try {
      await sendPartyAssignmentDM(userId, result.partyNumber, role, guildId, client, collections);
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

    // If in reserve, try to reassign with new role
    if (player.inReserve) {
      console.log(`[handleRoleChange] Player ${userId} in reserve with role change: ${oldRole} → ${newRole}`);

      const result = await attemptReserveAssignment(player, guildId, client, collections);

      if (result.success) {
        console.log(`[handleRoleChange] Player ${userId} promoted from reserve to Party ${result.partyNumber} with new role`);

        const { sendReservePromotionDM } = require('./notifications');
        try {
          await sendReservePromotionDM(userId, result.partyNumber, newRole, guildId, client, collections);
        } catch (err) {
          console.error(`Failed to send promotion DM:`, err.message);
        }
      }

      return;
    }

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
        await sendRoleChangeDM(userId, player.partyNumber, oldRole, newRole, guildId, client, collections);
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