const { sendPartyChangeDM } = require('./notifications');
const { PARTY_SIZE } = require('./constants');
const { analyzePartyComposition } = require('./autoAssignment');

const DEFAULT_REBALANCE_THRESHOLD = 0.20;
const MIN_REBALANCE_INTERVAL_MS = 5 * 60 * 1000;
const PERIODIC_REBALANCE_INTERVAL_MS = 72 * 60 * 60 * 1000;

/**
 * Calculate average CP of party members
 */
function calculateAverageCP(members) {
  if (!members || members.length === 0) return 0;
  const totalCP = members.reduce((sum, m) => sum + (m.cp || 0), 0);
  return totalCP / members.length;
}

/**
 * Move a player between parties
 */
async function movePlayerBetweenParties(userId, guildId, fromParty, toParty, client, collections) {
  const { parties, partyPlayers } = collections;

  const sourceParty = await parties.findOne({ guildId, partyNumber: fromParty });
  if (!sourceParty) throw new Error('Source party not found');

  const member = sourceParty.members?.find(m => m.userId === userId);
  if (!member) throw new Error('Member not found in source party');

  const destParty = await parties.findOne({ guildId, partyNumber: toParty });
  if (!destParty) throw new Error('Destination party not found');

  if ((destParty.members?.length || 0) >= PARTY_SIZE) {
    throw new Error('Destination party is full');
  }

  // Remove from source party
  await parties.updateOne(
    { _id: sourceParty._id },
    {
      $pull: { members: { userId } },
      $inc: {
        totalCP: -(member.cp || 0),
        [`roleComposition.${member.role}`]: -1
      }
    }
  );

  // Add to destination party
  await parties.updateOne(
    { _id: destParty._id },
    {
      $push: { members: { ...member, addedAt: new Date() } },
      $inc: {
        totalCP: (member.cp || 0),
        [`roleComposition.${member.role}`]: 1
      }
    }
  );

  // Update player record
  await partyPlayers.updateOne(
    { userId, guildId },
    { $set: { partyNumber: toParty } }
  );

  console.log(`[Move] ${userId} (${member.role}, ${member.cp} CP) moved from Party ${fromParty} to Party ${toParty}`);
}

/**
 * Clean up duplicate members in all parties
 * Removes duplicate entries where the same userId appears multiple times in a party
 */
async function cleanupDuplicateMembers(guildId, collections) {
  const { parties } = collections;

  console.log(`[Cleanup] Starting duplicate cleanup for guild ${guildId}`);

  const allParties = await parties.find({ guildId }).toArray();
  let totalDuplicatesRemoved = 0;

  for (const party of allParties) {
    const members = party.members || [];
    const seenUserIds = new Set();
    const uniqueMembers = [];
    const duplicates = [];

    // Identify duplicates
    for (const member of members) {
      if (seenUserIds.has(member.userId)) {
        duplicates.push(member);
        console.log(`[Cleanup] Found duplicate: ${member.userId} in Party ${party.partyNumber}`);
      } else {
        seenUserIds.add(member.userId);
        uniqueMembers.push(member);
      }
    }

    // Remove duplicates if found
    if (duplicates.length > 0) {
      console.log(`[Cleanup] Removing ${duplicates.length} duplicate(s) from Party ${party.partyNumber}`);

      // Calculate correct totalCP and roleComposition
      const newTotalCP = uniqueMembers.reduce((sum, m) => sum + (m.cp || 0), 0);
      const newRoleComposition = {
        tank: uniqueMembers.filter(m => m.role === 'tank').length,
        healer: uniqueMembers.filter(m => m.role === 'healer').length,
        dps: uniqueMembers.filter(m => m.role === 'dps').length
      };

      // Update party with cleaned data
      await parties.updateOne(
        { _id: party._id },
        {
          $set: {
            members: uniqueMembers,
            totalCP: newTotalCP,
            roleComposition: newRoleComposition
          }
        }
      );

      totalDuplicatesRemoved += duplicates.length;
    }
  }

  console.log(`[Cleanup] Cleanup complete. Removed ${totalDuplicatesRemoved} total duplicate(s)`);

  return {
    duplicatesRemoved: totalDuplicatesRemoved,
    partiesChecked: allParties.length
  };
}

/**
 * Fix data inconsistencies between partyPlayers and parties collections
 * Ensures that if a player thinks they're in a party, they actually are in that party
 */
async function fixDataInconsistencies(guildId, collections) {
  const { parties, partyPlayers } = collections;

  console.log(`[Data Sync] Starting data consistency check for guild ${guildId}`);

  // Get all players who think they're assigned to a party
  const allPlayers = await partyPlayers.find({ 
    guildId, 
    partyNumber: { $exists: true, $ne: null }
  }).toArray();

  // Get all parties
  const allParties = await parties.find({ guildId }).toArray();

  let playersFixed = 0;
  let orphanedPlayers = [];

  for (const player of allPlayers) {
    // Find the party they think they're in
    const party = allParties.find(p => p.partyNumber === player.partyNumber);

    if (!party) {
      // Party doesn't exist - clear player's assignment
      console.log(`[Data Sync] Player ${player.userId} assigned to non-existent Party ${player.partyNumber}, clearing assignment`);
      await partyPlayers.updateOne(
        { userId: player.userId, guildId },
        { $unset: { partyNumber: '', autoAssigned: '' } }
      );
      orphanedPlayers.push(player.userId);
      playersFixed++;
      continue;
    }

    // Check if player is actually in the party's members array
    const isInParty = party.members?.some(m => m.userId === player.userId);

    if (!isInParty) {
      console.log(`[Data Sync] Player ${player.userId} not found in Party ${player.partyNumber} members, adding them back`);

      // Player is missing from party - add them back
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

      playersFixed++;
    }
  }

  // Check for players in parties who don't have partyNumber set
  for (const party of allParties) {
    const members = party.members || [];

    for (const member of members) {
      const playerRecord = await partyPlayers.findOne({ userId: member.userId, guildId });

      if (!playerRecord || playerRecord.partyNumber !== party.partyNumber) {
        console.log(`[Data Sync] Player ${member.userId} in Party ${party.partyNumber} but record says Party ${playerRecord?.partyNumber || 'none'}, fixing`);

        await partyPlayers.updateOne(
          { userId: member.userId, guildId },
          { $set: { partyNumber: party.partyNumber } },
          { upsert: true }
        );

        playersFixed++;
      }
    }
  }

  console.log(`[Data Sync] Consistency check complete. Fixed ${playersFixed} inconsistencies`);

  return {
    playersFixed,
    orphanedPlayers
  };
}

/**
 * STRENGTH-BASED REBALANCING
 * Ensures: Party 1 > Party 2 > Party 3 in terms of average CP
 * Viability first: All parties must have 1T + 1H minimum
 */
async function strengthBasedRebalance(guildId, client, collections) {
  const { parties, guildSettings } = collections;

  console.log(`[Strength Rebalance] Starting for guild ${guildId}`);

  const settings = await guildSettings.findOne({ guildId });
  if (settings?.autoAssignmentEnabled === false) {
    console.log(`[Strength Rebalance] Skipped - auto-assignment disabled`);
    return { rebalanced: false, reason: 'Auto-assignment disabled' };
  }

  const allParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();

  if (allParties.length < 2) {
    console.log(`[Strength Rebalance] Skipped - not enough parties`);
    return { rebalanced: false, reason: 'Not enough parties' };
  }

  const moves = [];

  // STEP 0: Clean up any duplicate members first
  console.log(`[Strength Rebalance] Step 0: Cleaning up duplicate members`);
  const cleanupResult = await cleanupDuplicateMembers(guildId, collections);

  if (cleanupResult.duplicatesRemoved > 0) {
    console.log(`[Strength Rebalance] Removed ${cleanupResult.duplicatesRemoved} duplicate member(s)`);
  }

  // Refresh party data after cleanup
  const cleanedParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();

  // STEP 1: Ensure all parties have 1T + 1H (viability)
  console.log(`[Strength Rebalance] Step 1: Ensuring viability (1T + 1H per party)`);
  await ensureViability(cleanedParties, guildId, client, collections, moves);

  // Refresh party data after viability fixes
  const updatedParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();

  // STEP 2: Optimize tanks by CP (highest CP tank → Party 1)
  console.log(`[Strength Rebalance] Step 2: Optimizing tanks by CP`);
  await optimizeRolesByCPRanking(updatedParties, 'tank', guildId, client, collections, moves);

  // STEP 3: Optimize healers by CP (highest CP healer → Party 1)
  console.log(`[Strength Rebalance] Step 3: Optimizing healers by CP`);
  await optimizeRolesByCPRanking(updatedParties, 'healer', guildId, client, collections, moves);

  // STEP 4: Redistribute DPS by CP (highest CP DPS → Party 1)
  console.log(`[Strength Rebalance] Step 4: Redistributing DPS by strength`);
  await redistributeDPSByStrength(updatedParties, guildId, client, collections, moves);

  // Update last rebalance time
  await guildSettings.updateOne(
    { guildId },
    { $set: { lastPeriodicRebalance: new Date() } },
    { upsert: true }
  );

  console.log(`[Strength Rebalance] Complete - ${moves.length} move(s) executed`);

  return { 
    rebalanced: true, 
    moves,
    duplicatesRemoved: cleanupResult.duplicatesRemoved 
  };
}

/**
 * STEP 1: Ensure all parties have 1T + 1H (viability first)
 */
async function ensureViability(allParties, guildId, client, collections, moves) {
  for (const party of allParties) {
    const comp = analyzePartyComposition(party);

    // Check if party needs tank
    if (comp.tanks === 0) {
      console.log(`[Viability] Party ${party.partyNumber} needs tank`);
      const tankSource = await findDuplicateRole(allParties, 'tank', party.partyNumber);

      if (tankSource) {
        const { partyNumber, member } = tankSource;
        await movePlayerBetweenParties(
          member.userId,
          guildId,
          partyNumber,
          party.partyNumber,
          client,
          collections
        );

        moves.push({
          userId: member.userId,
          from: partyNumber,
          to: party.partyNumber,
          role: 'tank',
          reason: 'Viability: Tank needed'
        });

        await sendPartyChangeDM(
          member.userId,
          partyNumber,
          party.partyNumber,
          'Rebalancing: Your party needed a tank',
          client,
          collections
        ).catch(err => console.error('DM failed:', err.message));
      }
    }

    // Check if party needs healer
    if (comp.healers === 0) {
      console.log(`[Viability] Party ${party.partyNumber} needs healer`);
      const healerSource = await findDuplicateRole(allParties, 'healer', party.partyNumber);

      if (healerSource) {
        const { partyNumber, member } = healerSource;
        await movePlayerBetweenParties(
          member.userId,
          guildId,
          partyNumber,
          party.partyNumber,
          client,
          collections
        );

        moves.push({
          userId: member.userId,
          from: partyNumber,
          to: party.partyNumber,
          role: 'healer',
          reason: 'Viability: Healer needed'
        });

        await sendPartyChangeDM(
          member.userId,
          partyNumber,
          party.partyNumber,
          'Rebalancing: Your party needed a healer',
          client,
          collections
        ).catch(err => console.error('DM failed:', err.message));
      }
    }
  }
}

/**
 * Find a party with duplicate tank/healer
 */
async function findDuplicateRole(allParties, role, excludePartyNumber) {
  for (const party of allParties) {
    if (party.partyNumber === excludePartyNumber) continue;

    const comp = analyzePartyComposition(party);

    if (role === 'tank' && comp.tanks >= 2) {
      const tanks = party.members.filter(m => m.role === 'tank');
      // Return the lower CP tank
      const lowestTank = tanks.reduce((lowest, tank) =>
        (tank.cp || 0) < (lowest.cp || 0) ? tank : lowest
      );
      return { partyNumber: party.partyNumber, member: lowestTank };
    }

    if (role === 'healer' && comp.healers >= 2) {
      const healers = party.members.filter(m => m.role === 'healer');
      // Return the lower CP healer
      const lowestHealer = healers.reduce((lowest, healer) =>
        (healer.cp || 0) < (lowest.cp || 0) ? healer : lowest
      );
      return { partyNumber: party.partyNumber, member: lowestHealer };
    }
  }

  return null;
}

/**
 * STEP 2/3: Optimize tanks/healers by CP ranking
 * Highest CP → Party 1, 2nd highest → Party 2, etc.
 * COMPLETELY REBUILDS parties from scratch to avoid any duplication bugs
 */
async function optimizeRolesByCPRanking(allParties, role, guildId, client, collections, moves) {
  const { parties, partyPlayers } = collections;

  // Refresh party data from database
  const refreshedParties = [];
  for (const party of allParties) {
    const fresh = await parties.findOne({ guildId, partyNumber: party.partyNumber });
    if (fresh) refreshedParties.push(fresh);
  }

  // Extract all members of this role across all parties
  const roleMembers = [];
  const seenUserIds = new Set(); // DEDUPLICATE

  for (const party of refreshedParties) {
    const members = (party.members || []).filter(m => m.role === role);
    for (const member of members) {
      // Skip if we've already seen this user (prevents duplicates)
      if (seenUserIds.has(member.userId)) {
        console.log(`[Optimize ${role}] WARNING: Skipping duplicate ${member.userId} found in Party ${party.partyNumber}`);
        continue;
      }

      seenUserIds.add(member.userId);
      roleMembers.push({ ...member, currentParty: party.partyNumber });
    }
  }

  if (roleMembers.length === 0) {
    console.log(`[Optimize ${role}] No ${role}s found`);
    return;
  }

  // Sort by CP descending (highest first)
  roleMembers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

  console.log(`[Optimize ${role}] Found ${roleMembers.length} unique ${role}(s)`);

  // STEP 1: Remove ALL members of this role from ALL parties (including duplicates)
  for (const party of refreshedParties) {
    await parties.updateOne(
      { _id: party._id },
      {
        $pull: { members: { role: role } },
        $set: { [`roleComposition.${role}`]: 0 }
      }
    );

    // Recalculate totalCP without this role
    const currentParty = await parties.findOne({ _id: party._id });
    const remainingMembers = (currentParty.members || []).filter(m => m.role !== role);
    const newTotalCP = remainingMembers.reduce((sum, m) => sum + (m.cp || 0), 0);

    await parties.updateOne(
      { _id: party._id },
      { $set: { totalCP: newTotalCP } }
    );
  }

  console.log(`[Optimize ${role}] Cleared all ${role}s from parties`);

  // STEP 2: Assign highest CP to Party 1, next to Party 2, etc.
  for (let i = 0; i < roleMembers.length; i++) {
    const targetParty = refreshedParties[i % refreshedParties.length];
    const member = roleMembers[i];

    console.log(`[Optimize ${role}] Assigning ${member.userId} (${member.cp} CP) to Party ${targetParty.partyNumber}`);

    // Add member to target party
    await parties.updateOne(
      { _id: targetParty._id },
      {
        $push: {
          members: {
            userId: member.userId,
            weapon1: member.weapon1,
            weapon2: member.weapon2,
            cp: member.cp || 0,
            role: member.role,
            addedAt: new Date()
          }
        },
        $inc: {
          totalCP: (member.cp || 0),
          [`roleComposition.${role}`]: 1
        }
      }
    );

    // Update player record
    await partyPlayers.updateOne(
      { userId: member.userId, guildId },
      { $set: { partyNumber: targetParty.partyNumber } }
    );

    // Track move if party changed
    if (member.currentParty !== targetParty.partyNumber) {
      moves.push({
        userId: member.userId,
        from: member.currentParty,
        to: targetParty.partyNumber,
        role: role,
        reason: `Strength optimization: ${role} rebalancing`
      });

      await sendPartyChangeDM(
        member.userId,
        member.currentParty,
        targetParty.partyNumber,
        `Strength-based rebalancing: ${role} optimization`,
        client,
        collections
      ).catch(err => console.error('DM failed:', err.message));
    }
  }

  console.log(`[Optimize ${role}] Optimization complete`);
}

/**
 * STEP 4: Redistribute DPS by strength
 * Highest CP DPS → Party 1, next highest → Party 2, etc.
 */
async function redistributeDPSByStrength(allParties, guildId, client, collections, moves) {
  const { parties } = collections;

  // CRITICAL: Refresh party data from database to get current state after Steps 1-3
  const refreshedParties = [];
  for (const party of allParties) {
    const fresh = await parties.findOne({ guildId, partyNumber: party.partyNumber });
    if (fresh) refreshedParties.push(fresh);
  }

  // Collect all DPS from refreshed data
  const allDPS = [];

  for (const party of refreshedParties) {
    const dpsMembers = (party.members || []).filter(m => m.role === 'dps');
    for (const dps of dpsMembers) {
      allDPS.push({ ...dps, currentParty: party.partyNumber });
    }
  }

  if (allDPS.length === 0) {
    console.log(`[DPS Redistribution] No DPS found`);
    return;
  }

  // Sort by CP descending
  allDPS.sort((a, b) => (b.cp || 0) - (a.cp || 0));

  console.log(`[DPS Redistribution] Found ${allDPS.length} DPS`);

  // First, clear all DPS from all parties
  console.log(`[DPS Redistribution] Clearing all DPS from parties...`);
  for (const party of refreshedParties) {
    await parties.updateOne(
      { _id: party._id },
      {
        $pull: { members: { role: 'dps' } },
        $set: { 'roleComposition.dps': 0 }
      }
    );

    // Recalculate totalCP without DPS
    const remainingMembers = (party.members || []).filter(m => m.role !== 'dps');
    const newTotalCP = remainingMembers.reduce((sum, m) => sum + (m.cp || 0), 0);

    await parties.updateOne(
      { _id: party._id },
      { $set: { totalCP: newTotalCP } }
    );
  }

  // Now redistribute DPS sequentially
  let dpsIndex = 0;

  for (const party of refreshedParties) {
    // Refresh composition after clearing
    const currentParty = await parties.findOne({ guildId, partyNumber: party.partyNumber });
    const comp = analyzePartyComposition(currentParty);
    const slotsAvailable = PARTY_SIZE - comp.tanks - comp.healers;

    console.log(`[DPS Redistribution] Party ${party.partyNumber} has ${slotsAvailable} DPS slots (${comp.tanks}T + ${comp.healers}H)`);

    if (slotsAvailable <= 0) {
      console.log(`[DPS Redistribution] Party ${party.partyNumber} has no DPS slots available`);
      continue;
    }

    // Assign the highest CP DPS to fill this party
    const targetDPS = allDPS.slice(dpsIndex, dpsIndex + slotsAvailable);

    console.log(`[DPS Redistribution] Assigning ${targetDPS.length} DPS to Party ${party.partyNumber}`);

    for (const dps of targetDPS) {
      // Add DPS directly (they were already removed)
      await parties.updateOne(
        { _id: currentParty._id },
        {
          $push: {
            members: {
              userId: dps.userId,
              weapon1: dps.weapon1,
              weapon2: dps.weapon2,
              cp: dps.cp || 0,
              role: 'dps',
              addedAt: new Date()
            }
          },
          $inc: {
            totalCP: (dps.cp || 0),
            'roleComposition.dps': 1
          }
        }
      );

      // Update player record
      await collections.partyPlayers.updateOne(
        { userId: dps.userId, guildId },
        { $set: { partyNumber: party.partyNumber } }
      );

      // Only log move and send DM if party actually changed
      if (dps.currentParty !== party.partyNumber) {
        console.log(`[DPS Redistribution] Moved DPS ${dps.userId} (${dps.cp} CP) from Party ${dps.currentParty} → Party ${party.partyNumber}`);

        moves.push({
          userId: dps.userId,
          from: dps.currentParty,
          to: party.partyNumber,
          role: 'dps',
          reason: 'DPS strength redistribution'
        });

        await sendPartyChangeDM(
          dps.userId,
          dps.currentParty,
          party.partyNumber,
          'Strength-based rebalancing: DPS optimization',
          client,
          collections
        ).catch(err => console.error('DM failed:', err.message));
      } else {
        console.log(`[DPS Redistribution] DPS ${dps.userId} (${dps.cp} CP) stayed in Party ${party.partyNumber}`);
      }
    }

    dpsIndex += slotsAvailable;
  }

  console.log(`[DPS Redistribution] Redistribution complete. Assigned ${dpsIndex} DPS across ${refreshedParties.length} parties`);
}

/**
 * Start the periodic rebalancer (runs every 72 hours)
 */
function startPeriodicRebalancer(client, collections) {
  console.log(`🔄 Starting periodic party rebalancer (72 hour interval)...`);

  // Run immediately on startup (after 1 minute delay)
  setTimeout(async () => {
    await runPeriodicRebalancerForAllGuilds(client, collections);
  }, 60 * 1000);

  // Then run every 72 hours
  setInterval(async () => {
    await runPeriodicRebalancerForAllGuilds(client, collections);
  }, PERIODIC_REBALANCE_INTERVAL_MS);

  console.log(`✅ Periodic party rebalancer started`);
}

/**
 * Run periodic rebalancing for all guilds
 */
async function runPeriodicRebalancerForAllGuilds(client, collections) {
  const { guildSettings } = collections;

  console.log(`[Periodic Rebalance] Running for all guilds...`);

  try {
    const guildsWithAuto = await guildSettings.find({
      autoAssignmentEnabled: { $ne: false }
    }).toArray();

    console.log(`[Periodic Rebalance] Found ${guildsWithAuto.length} guild(s) with auto-assignment enabled`);

    for (const guildConfig of guildsWithAuto) {
      try {
        const result = await strengthBasedRebalance(
          guildConfig.guildId,
          client,
          collections
        );

        if (result.rebalanced) {
          console.log(`[Periodic Rebalance] ✅ Rebalanced ${result.moves.length} player(s) in guild ${guildConfig.guildId}`);
        }
      } catch (err) {
        console.error(`[Periodic Rebalance] ❌ Failed for guild ${guildConfig.guildId}:`, err);
      }
    }

    console.log(`[Periodic Rebalance] Complete for all guilds`);
  } catch (err) {
    console.error('[Periodic Rebalance] Error:', err);
  }
}

/**
 * Manual trigger for strength-based rebalancing
 */
async function checkAndRebalanceParties(guildId, client, collections, force = false) {
  const { guildSettings } = collections;

  const settings = await guildSettings.findOne({ guildId });
  if (!force && settings?.autoAssignmentEnabled === false) {
    return { rebalanced: false, reason: 'Auto-assignment disabled' };
  }

  // Check last rebalance time (prevent too frequent rebalancing)
  if (!force && settings?.lastPeriodicRebalance) {
    const timeSinceLastRebalance = Date.now() - new Date(settings.lastPeriodicRebalance).getTime();
    if (timeSinceLastRebalance < MIN_REBALANCE_INTERVAL_MS) {
      return { rebalanced: false, reason: 'Too soon since last rebalance' };
    }
  }

  // Execute strength-based rebalancing
  return await strengthBasedRebalance(guildId, client, collections);
}

module.exports = {
  checkAndRebalanceParties,
  movePlayerBetweenParties,
  strengthBasedRebalance,
  startPeriodicRebalancer
};