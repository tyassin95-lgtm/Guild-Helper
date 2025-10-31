const { sendReservePromotionDM, sendReserveDemotionDM } = require('./notifications');
const { getRoleFromWeapons } = require('./roleDetection');
const { PARTY_SIZE } = require('./constants');

/**
 * Move a player to reserve pool
 */
async function moveToReserve(userId, guildId, reason, collections) {
  const { partyPlayers } = collections;

  await partyPlayers.updateOne(
    { userId, guildId },
    {
      $set: {
        inReserve: true,
        reservedAt: new Date(),
        reserveReason: reason
      },
      $unset: {
        partyNumber: '',
        autoAssigned: ''
      }
    }
  );

  console.log(`[Reserve] Moved ${userId} to reserve: ${reason}`);
}

/**
 * Remove a player from reserve pool (promote to active)
 */
async function removeFromReserve(userId, guildId, partyNumber, collections) {
  const { partyPlayers } = collections;

  await partyPlayers.updateOne(
    { userId, guildId },
    {
      $set: {
        partyNumber,
        autoAssigned: true
      },
      $unset: {
        inReserve: '',
        reservedAt: '',
        reserveReason: ''
      }
    }
  );

  console.log(`[Reserve] Removed ${userId} from reserve, assigned to Party ${partyNumber}`);
}

/**
 * Get all reserve players sorted by priority
 */
async function getReservePlayers(guildId, collections) {
  const { partyPlayers } = collections;

  // Priority: Tank > Healer > DPS, then by CP descending, then by time in reserve ascending (FIFO)
  const reserves = await partyPlayers.find({
    guildId,
    inReserve: true
  }).toArray();

  // Custom sort
  reserves.sort((a, b) => {
    // Role priority
    const roleOrder = { tank: 0, healer: 1, dps: 2 };
    const roleDiff = roleOrder[a.role] - roleOrder[b.role];
    if (roleDiff !== 0) return roleDiff;

    // CP descending
    const cpDiff = (b.cp || 0) - (a.cp || 0);
    if (cpDiff !== 0) return cpDiff;

    // Time in reserve ascending (older first)
    return new Date(a.reservedAt) - new Date(b.reservedAt);
  });

  return reserves;
}

/**
 * Add player directly to party (when there's room)
 */
async function addToParty(player, party, guildId, collections) {
  const { parties, partyPlayers } = collections;

  await parties.updateOne(
    { _id: party._id },
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

  await removeFromReserve(player.userId, guildId, party.partyNumber, collections);

  console.log(`[Reserve] Added ${player.userId} (${player.role}) to Party ${party.partyNumber}`);

  return {
    success: true,
    partyNumber: party.partyNumber,
    action: 'added'
  };
}

/**
 * Substitute player into party, displacing another member
 */
async function substituteIntoParty(reservePlayer, party, reason, displacedMember, guildId, client, collections) {
  const { parties, partyPlayers } = collections;

  // If no specific member to displace, find lowest CP DPS
  if (!displacedMember) {
    const dpsList = party.members.filter(m => m.role === 'dps');
    if (dpsList.length === 0) {
      console.log(`[Reserve] Cannot substitute - no DPS to displace in Party ${party.partyNumber}`);
      return { success: false, reason: 'No DPS to displace' };
    }
    displacedMember = dpsList.reduce((min, d) => (d.cp || 0) < (min.cp || 0) ? d : min);
  }

  console.log(`[Reserve] Substituting ${reservePlayer.userId} → Party ${party.partyNumber}, displacing ${displacedMember.userId}`);

  // Remove displaced member from party
  await parties.updateOne(
    { _id: party._id },
    {
      $pull: { members: { userId: displacedMember.userId } },
      $inc: {
        totalCP: -(displacedMember.cp || 0),
        [`roleComposition.${displacedMember.role}`]: -1
      }
    }
  );

  // Add reserve player to party
  await parties.updateOne(
    { _id: party._id },
    {
      $push: {
        members: {
          userId: reservePlayer.userId,
          weapon1: reservePlayer.weapon1,
          weapon2: reservePlayer.weapon2,
          cp: reservePlayer.cp || 0,
          role: reservePlayer.role,
          addedAt: new Date()
        }
      },
      $inc: {
        totalCP: (reservePlayer.cp || 0),
        [`roleComposition.${reservePlayer.role}`]: 1
      }
    }
  );

  // Update reserve player status
  await removeFromReserve(reservePlayer.userId, guildId, party.partyNumber, collections);

  // Move displaced member to reserve
  await moveToReserve(displacedMember.userId, guildId, `Substituted by higher CP ${reservePlayer.role}`, collections);

  return {
    success: true,
    partyNumber: party.partyNumber,
    action: 'substituted',
    displaced: displacedMember
  };
}

/**
 * Attempt to assign a reserve player to an active party
 */
async function attemptReserveAssignment(reservePlayer, guildId, client, collections) {
  const { parties, guildSettings } = collections;

  const settings = await guildSettings.findOne({ guildId });
  const maxParties = settings?.maxParties || 10;

  const allParties = await parties.find({ guildId })
    .sort({ partyNumber: 1 })
    .toArray();

  // Only consider parties up to maxParties limit
  const activeParties = allParties.filter(p => p.partyNumber <= maxParties);

  if (activeParties.length === 0) {
    return { success: false, reason: 'No active parties' };
  }

  const { role, cp, userId } = reservePlayer;

  // TANK LOGIC (Max 1 per party)
  if (role === 'tank') {
    // Priority 1: Parties without tank
    for (const party of activeParties) {
      const hasTank = party.members?.some(m => m.role === 'tank');
      if (!hasTank) {
        const totalMembers = party.members?.length || 0;

        if (totalMembers < PARTY_SIZE) {
          // Room available
          return await addToParty(reservePlayer, party, guildId, collections);
        } else {
          // Full, displace lowest DPS
          return await substituteIntoParty(reservePlayer, party, 'tank_needed', null, guildId, client, collections);
        }
      }
    }

    // Priority 2: Replace weaker tank
    for (const party of activeParties) {
      const existingTank = party.members?.find(m => m.role === 'tank');
      if (existingTank && cp > (existingTank.cp || 0)) {
        return await substituteIntoParty(reservePlayer, party, 'higher_cp', existingTank, guildId, client, collections);
      }
    }
  }

  // HEALER LOGIC (Max 2 per party)
  if (role === 'healer') {
    // Priority 1: Parties with < 2 healers (prioritize fewer healers first)
    for (let targetHealerCount = 0; targetHealerCount < 2; targetHealerCount++) {
      for (const party of activeParties) {
        const healerCount = party.members?.filter(m => m.role === 'healer').length || 0;

        if (healerCount === targetHealerCount) {
          const totalMembers = party.members?.length || 0;

          if (totalMembers < PARTY_SIZE) {
            // Room available
            return await addToParty(reservePlayer, party, guildId, collections);
          } else {
            // Full, displace lowest DPS
            return await substituteIntoParty(reservePlayer, party, 'healer_needed', null, guildId, client, collections);
          }
        }
      }
    }

    // Priority 2: All parties have 2 healers - replace weakest
    for (const party of activeParties) {
      const healers = party.members?.filter(m => m.role === 'healer') || [];
      if (healers.length >= 2) {
        const weakestHealer = healers.reduce((min, h) => (h.cp || 0) < (min.cp || 0) ? h : min);

        if (cp > (weakestHealer.cp || 0)) {
          return await substituteIntoParty(reservePlayer, party, 'higher_cp', weakestHealer, guildId, client, collections);
        }
      }
    }
  }

  // DPS LOGIC (Fills remaining slots)
  if (role === 'dps') {
    // Priority 1: Parties with open slots
    for (const party of activeParties) {
      const totalMembers = party.members?.length || 0;
      if (totalMembers < PARTY_SIZE) {
        return await addToParty(reservePlayer, party, guildId, collections);
      }
    }

    // Priority 2: Replace weaker DPS (compare across ALL parties, substitute into lowest party number possible)
    // Sort parties by party number to prefer substituting into lower parties
    const sortedParties = [...activeParties].sort((a, b) => a.partyNumber - b.partyNumber);

    for (const party of sortedParties) {
      const dpsList = party.members?.filter(m => m.role === 'dps') || [];
      if (dpsList.length > 0) {
        // Find weakest DPS in this party
        const weakestDPS = dpsList.reduce((min, d) => (d.cp || 0) < (min.cp || 0) ? d : min);

        // Substitute if reserve DPS has higher CP
        if (cp > (weakestDPS.cp || 0)) {
          console.log(`[Reserve Assignment] DPS substitution: ${cp} CP → Party ${party.partyNumber}, replacing ${weakestDPS.cp} CP`);
          return await substituteIntoParty(reservePlayer, party, 'higher_cp', weakestDPS, guildId, client, collections);
        }
      }
    }
  }

  return { success: false, reason: 'No suitable placement found' };
}

/**
 * Process entire reserve pool during rebalancing
 */
async function processReservePool(guildId, client, collections) {
  console.log(`[Reserve Pool] Processing reserve pool for guild ${guildId}`);

  const reservePlayers = await getReservePlayers(guildId, collections);

  if (reservePlayers.length === 0) {
    console.log(`[Reserve Pool] No players in reserve`);
    return { processed: 0, promoted: 0 };
  }

  console.log(`[Reserve Pool] Found ${reservePlayers.length} reserve player(s)`);

  let promoted = 0;
  const promotedPlayers = [];

  for (const reservePlayer of reservePlayers) {
    try {
      const result = await attemptReserveAssignment(reservePlayer, guildId, client, collections);

      if (result.success) {
        promoted++;
        promotedPlayers.push({
          userId: reservePlayer.userId,
          partyNumber: result.partyNumber,
          role: reservePlayer.role
        });

        console.log(`[Reserve Pool] ✅ Promoted ${reservePlayer.userId} (${reservePlayer.role}) to Party ${result.partyNumber}`);

        // Send promotion DM asynchronously (non-blocking)
        setImmediate(async () => {
          try {
            await sendReservePromotionDM(
              reservePlayer.userId,
              result.partyNumber,
              reservePlayer.role,
              guildId,
              client,
              collections
            );
          } catch (dmErr) {
            console.error(`[Reserve Pool] Failed to send promotion DM to ${reservePlayer.userId}:`, dmErr.message);
          }
        });

        // If someone was displaced, send them demotion DM asynchronously
        if (result.displaced) {
          setImmediate(async () => {
            try {
              await sendReserveDemotionDM(
                result.displaced.userId,
                result.partyNumber,
                guildId,
                client,
                collections
              );
            } catch (dmErr) {
              console.error(`[Reserve Pool] Failed to send demotion DM to ${result.displaced.userId}:`, dmErr.message);
            }
          });
        }
      } else {
        console.log(`[Reserve Pool] ❌ Could not promote ${reservePlayer.userId}: ${result.reason}`);
      }
    } catch (err) {
      console.error(`[Reserve Pool] Error processing ${reservePlayer.userId}:`, err);
    }
  }

  console.log(`[Reserve Pool] Complete - Promoted ${promoted}/${reservePlayers.length} player(s)`);

  return {
    processed: reservePlayers.length,
    promoted,
    promotedPlayers
  };
}

/**
 * Move entire party to reserve (used when reducing maxParties)
 */
async function movePartyToReserve(partyNumber, guildId, client, collections) {
  const { parties, partyPlayers } = collections;

  const party = await parties.findOne({ guildId, partyNumber });
  if (!party) {
    console.log(`[Reserve] Party ${partyNumber} not found`);
    return { moved: 0 };
  }

  const members = party.members || [];
  console.log(`[Reserve] Moving Party ${partyNumber} (${members.length} members) to reserve`);

  for (const member of members) {
    await moveToReserve(
      member.userId,
      guildId,
      `Party ${partyNumber} disbanded - max parties reduced`,
      collections
    );

    // Send notification asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        await sendReserveDemotionDM(
          member.userId,
          partyNumber,
          guildId,
          client,
          collections
        );
      } catch (err) {
        console.error(`Failed to send demotion DM to ${member.userId}:`, err.message);
      }
    });
  }

  // Delete the party
  await parties.deleteOne({ _id: party._id });

  console.log(`[Reserve] Party ${partyNumber} disbanded, ${members.length} member(s) moved to reserve`);

  return { moved: members.length };
}

/**
 * Check if a player should go to reserve instead of creating new party
 */
async function shouldRouteToReserve(guildId, collections) {
  const { parties, guildSettings } = collections;

  const settings = await guildSettings.findOne({ guildId });
  const maxParties = settings?.maxParties || 10;

  const existingParties = await parties.find({ guildId }).toArray();
  const activePartyCount = existingParties.filter(p => p.partyNumber <= maxParties).length;

  // If we haven't reached max parties, don't route to reserve
  if (activePartyCount < maxParties) {
    return false;
  }

  // Max parties reached - check if all are viable
  const viableParties = existingParties.filter(p => {
    if (p.partyNumber > maxParties) return false; // Ignore parties beyond limit

    const members = p.members || [];
    const hasTank = members.some(m => m.role === 'tank');
    const hasHealer = members.some(m => m.role === 'healer');

    return hasTank && hasHealer;
  });

  // Only route to reserve if we're at max AND all parties are viable
  return viableParties.length >= maxParties;
}

/**
 * Handle max parties change
 */
async function handleMaxPartiesChange(oldMax, newMax, guildId, client, collections) {
  const { parties } = collections;

  console.log(`[Max Parties] Changing from ${oldMax} → ${newMax} for guild ${guildId}`);

  if (newMax > oldMax) {
    // INCREASING - create empty parties up to new limit, then promote reserve players
    console.log(`[Max Parties] Increasing limit - creating empty parties up to ${newMax}`);

    const existingParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();
    const existingNumbers = new Set(existingParties.map(p => p.partyNumber));

    // Create empty parties for any missing numbers up to newMax
    let partiesCreated = 0;
    for (let i = 1; i <= newMax; i++) {
      if (!existingNumbers.has(i)) {
        await parties.insertOne({
          guildId,
          partyNumber: i,
          members: [],
          totalCP: 0,
          roleComposition: { tank: 0, healer: 0, dps: 0 },
          createdAt: new Date(),
          lastRebalanced: new Date()
        });
        console.log(`[Max Parties] Created empty Party ${i}`);
        partiesCreated++;
      }
    }

    console.log(`[Max Parties] Created ${partiesCreated} new empty party/parties`);

    // Now try to promote reserve players to fill new slots
    console.log(`[Max Parties] Attempting to fill new party slots from reserve...`);
    const result = await processReservePool(guildId, client, collections);
    console.log(`[Max Parties] Promoted ${result.promoted} player(s) from reserve`);

    return {
      action: 'increased',
      partiesCreated,
      promoted: result.promoted
    };
  } else if (newMax < oldMax) {
    // DECREASING - disband excess parties
    console.log(`[Max Parties] Decreasing limit - disbanding excess parties`);

    const allParties = await parties.find({ guildId }).sort({ partyNumber: -1 }).toArray();
    const partiesToDisband = allParties.filter(p => p.partyNumber > newMax);

    let totalMoved = 0;

    for (const party of partiesToDisband) {
      const result = await movePartyToReserve(party.partyNumber, guildId, client, collections);
      totalMoved += result.moved;
    }

    console.log(`[Max Parties] Disbanded ${partiesToDisband.length} parties, moved ${totalMoved} players to reserve`);

    // Process reserve pool to pull back highest priority players
    const pullBackResult = await processReservePool(guildId, client, collections);
    console.log(`[Max Parties] Pulled back ${pullBackResult.promoted} player(s) from reserve`);

    // CRITICAL FIX: Run full strength-based rebalance after reserve processing
    // This ensures proper CP distribution across all roles and parties
    console.log(`[Max Parties] Running full rebalance to optimize party compositions...`);

    const { strengthBasedRebalance } = require('./rebalancing');
    const rebalanceResult = await strengthBasedRebalance(guildId, client, collections);

    console.log(`[Max Parties] Rebalance complete - ${rebalanceResult.moves?.length || 0} optimization moves made`);

    return {
      action: 'decreased',
      disbanded: partiesToDisband.length,
      movedToReserve: totalMoved,
      pulledBack: pullBackResult.promoted,
      rebalanceMoves: rebalanceResult.moves?.length || 0
    };
  }

  return { action: 'unchanged' };
}

module.exports = {
  moveToReserve,
  removeFromReserve,
  getReservePlayers,
  addToParty,
  substituteIntoParty,
  attemptReserveAssignment,
  processReservePool,
  movePartyToReserve,
  shouldRouteToReserve,
  handleMaxPartiesChange
};