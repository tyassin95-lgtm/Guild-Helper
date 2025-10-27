const { sendPartyChangeDM } = require('./notifications');
const { PARTY_SIZE, MAX_TANKS_PER_PARTY, MAX_HEALERS_PER_PARTY } = require('./constants');
const { analyzePartyComposition } = require('./autoAssignment');
const { getClient } = require('../../db/mongo');
const { processReservePool } = require('./reserve');

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
 */
async function fixDataInconsistencies(guildId, collections) {
  const { parties, partyPlayers } = collections;

  console.log(`[Data Sync] Starting data consistency check for guild ${guildId}`);

  // Get all players who think they're assigned to a party
  const allPlayers = await partyPlayers.find({ 
    guildId, 
    partyNumber: { $exists: true, $ne: null },
    inReserve: { $ne: true } // Exclude reserve players
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
          { 
            $set: { partyNumber: party.partyNumber },
            $unset: { inReserve: '', reservedAt: '', reserveReason: '' }
          },
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
 * STRENGTH-BASED REBALANCING with Reserve Pool Processing
 */
async function strengthBasedRebalance(guildId, client, collections) {
  const { parties, guildSettings } = collections;

  console.log(`[Strength Rebalance] Starting for guild ${guildId}`);

  const settings = await guildSettings.findOne({ guildId });
  if (settings?.autoAssignmentEnabled === false) {
    console.log(`[Strength Rebalance] Skipped - auto-assignment disabled`);
    return { rebalanced: false, reason: 'Auto-assignment disabled' };
  }

  const maxParties = settings?.maxParties || 10;

  const allParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();
  const activeParties = allParties.filter(p => p.partyNumber <= maxParties);

  if (activeParties.length < 2) {
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
  const cleanedParties = await parties.find({ guildId, partyNumber: { $lte: maxParties } })
    .sort({ partyNumber: 1 })
    .toArray();

  // STEP 1: Ensure all parties have 1T + 1H (viability) - SKIPPED
  // This step is now redundant since the role optimization steps below automatically
  // ensure each party gets 1 tank and at least 1 healer through the redistribution
  console.log(`[Strength Rebalance] Step 1: Skipping viability check - will be handled by role optimization`);
  // await ensureViability(cleanedParties, guildId, client, collections, moves);

  // Refresh party data after viability fixes
  const updatedParties = await parties.find({ guildId, partyNumber: { $lte: maxParties } })
    .sort({ partyNumber: 1 })
    .toArray();

  // STEP 2: Optimize tanks by CP (STRENGTH CONCENTRATION)
  console.log(`[Strength Rebalance] Step 2: Optimizing tanks by CP (strength concentration)`);
  await optimizeRolesByStrengthConcentration(updatedParties, 'tank', guildId, client, collections, moves);

  // STEP 3: Optimize healers by CP (STRENGTH CONCENTRATION) - CHANGED FROM BALANCED ROUND-ROBIN
  console.log(`[Strength Rebalance] Step 3: Optimizing healers by CP (strength concentration)`);
  await optimizeHealersByStrengthConcentration(updatedParties, guildId, client, collections, moves);

  // STEP 4: Redistribute DPS by CP (STRENGTH CONCENTRATION)
  console.log(`[Strength Rebalance] Step 4: Redistributing DPS by strength concentration`);
  await redistributeDPSByStrengthConcentration(updatedParties, guildId, client, collections, moves);

  // STEP 5: Process reserve pool (NEW)
  console.log(`[Strength Rebalance] Step 5: Processing reserve pool`);
  const reserveResult = await processReservePool(guildId, client, collections);

  console.log(`[Strength Rebalance] Reserve processing: ${reserveResult.promoted}/${reserveResult.processed} promoted`);

  // Update last rebalance time
  await guildSettings.updateOne(
    { guildId },
    { $set: { lastPeriodicRebalance: new Date() } },
    { upsert: true }
  );

  console.log(`[Strength Rebalance] Complete - ${moves.length} move(s) executed, ${reserveResult.promoted} promoted from reserve`);

  return { 
    rebalanced: true, 
    moves,
    duplicatesRemoved: cleanupResult.duplicatesRemoved,
    reservePromoted: reserveResult.promoted
  };
}

/**
 * STEP 1: Ensure all parties have 1T + 1H (viability first)
 * NOTE: This function is currently disabled in strengthBasedRebalance
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
          guildId,
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
          guildId,
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
      const lowestTank = tanks.reduce((lowest, tank) =>
        (tank.cp || 0) < (lowest.cp || 0) ? tank : lowest
      );
      return { partyNumber: party.partyNumber, member: lowestTank };
    }

    if (role === 'healer' && comp.healers > MAX_HEALERS_PER_PARTY) {
      const healers = party.members.filter(m => m.role === 'healer');
      const lowestHealer = healers.reduce((lowest, healer) =>
        (healer.cp || 0) < (lowest.cp || 0) ? healer : lowest
      );
      return { partyNumber: party.partyNumber, member: lowestHealer };
    }
  }

  return null;
}

/**
 * STEP 2: Optimize tanks by STRENGTH CONCENTRATION using MongoDB transactions
 * 
 * Strategy: Fill parties sequentially with highest CP members
 */
async function optimizeRolesByStrengthConcentration(allParties, role, guildId, client, collections, moves) {
  const { parties, partyPlayers } = collections;
  const mongoClient = getClient();

  const maxCount = role === 'tank' ? MAX_TANKS_PER_PARTY : MAX_HEALERS_PER_PARTY;

  // Refresh party data from database
  const refreshedParties = [];
  for (const party of allParties) {
    const fresh = await parties.findOne({ guildId, partyNumber: party.partyNumber });
    if (fresh) refreshedParties.push(fresh);
  }

  // Extract all members of this role across all parties
  const roleMembers = [];
  const seenUserIds = new Set();

  for (const party of refreshedParties) {
    const members = (party.members || []).filter(m => m.role === role);
    for (const member of members) {
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

  console.log(`[Optimize ${role}] Found ${roleMembers.length} unique ${role}(s), applying strength concentration`);

  // Use MongoDB transaction to ensure atomicity
  const session = mongoClient.startSession();

  try {
    await session.withTransaction(async () => {
      // STEP 1: Remove ALL members of this role from ALL parties
      for (const party of refreshedParties) {
        await parties.updateOne(
          { _id: party._id },
          {
            $pull: { members: { role: role } },
            $set: { [`roleComposition.${role}`]: 0 }
          },
          { session }
        );

        // Recalculate totalCP without this role
        const currentParty = await parties.findOne({ _id: party._id }, { session });
        const remainingMembers = (currentParty.members || []).filter(m => m.role !== role);
        const newTotalCP = remainingMembers.reduce((sum, m) => sum + (m.cp || 0), 0);

        await parties.updateOne(
          { _id: party._id },
          { $set: { totalCP: newTotalCP } },
          { session }
        );
      }

      console.log(`[Optimize ${role}] Cleared all ${role}s from parties`);

      // STEP 2: STRENGTH CONCENTRATION - Fill parties SEQUENTIALLY
      // Assign highest CP members to Party 1 first, then Party 2, etc.
      let memberIndex = 0;

      for (const targetParty of refreshedParties) {
        let assignedToThisParty = 0;

        // Fill this party up to maxCount with highest available members
        while (memberIndex < roleMembers.length && assignedToThisParty < maxCount) {
          const member = roleMembers[memberIndex];

          console.log(`[Optimize ${role}] Assigning ${member.userId} (${member.cp} CP) to Party ${targetParty.partyNumber} (strength concentration)`);

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
            },
            { session }
          );

          // Update player record
          await partyPlayers.updateOne(
            { userId: member.userId, guildId },
            { $set: { partyNumber: targetParty.partyNumber } },
            { session }
          );

          // Track move if party changed
          if (member.currentParty !== targetParty.partyNumber) {
            moves.push({
              userId: member.userId,
              from: member.currentParty,
              to: targetParty.partyNumber,
              role: role,
              reason: `Strength concentration: ${role} optimization`
            });
          }

          memberIndex++;
          assignedToThisParty++;
        }

        console.log(`[Optimize ${role}] Party ${targetParty.partyNumber} assigned ${assignedToThisParty} ${role}(s)`);

        // If we've assigned all members, stop
        if (memberIndex >= roleMembers.length) {
          break;
        }
      }

      console.log(`[Optimize ${role}] Strength concentration complete - assigned ${memberIndex}/${roleMembers.length} ${role}(s)`);
    });

    // Send DMs after successful transaction
    const roleMoves = moves.filter(m => m.role === role && m.reason.includes('Strength concentration'));
    for (const move of roleMoves) {
      await sendPartyChangeDM(
        move.userId,
        move.from,
        move.to,
        `Strength-based rebalancing: ${role} optimization`,
        guildId,
        client,
        collections
      ).catch(err => console.error('DM failed:', err.message));
    }

  } catch (err) {
    console.error(`[Optimize ${role}] Transaction failed:`, err);
    throw err;
  } finally {
    await session.endSession();
  }
}

/**
 * STEP 3: Optimize healers by STRENGTH CONCENTRATION using MongoDB transactions
 * 
 * Strategy: Fill parties sequentially with highest CP healers (same as tanks)
 * This uses pure strength concentration instead of balanced round-robin
 */
async function optimizeHealersByStrengthConcentration(allParties, guildId, client, collections, moves) {
  const { parties, partyPlayers } = collections;
  const mongoClient = getClient();

  const maxCount = MAX_HEALERS_PER_PARTY;

  // Refresh party data from database
  const refreshedParties = [];
  for (const party of allParties) {
    const fresh = await parties.findOne({ guildId, partyNumber: party.partyNumber });
    if (fresh) refreshedParties.push(fresh);
  }

  // Extract all healers across all parties
  const healers = [];
  const seenUserIds = new Set();

  for (const party of refreshedParties) {
    const members = (party.members || []).filter(m => m.role === 'healer');
    for (const member of members) {
      if (seenUserIds.has(member.userId)) {
        console.log(`[Optimize Healer] WARNING: Skipping duplicate ${member.userId} found in Party ${party.partyNumber}`);
        continue;
      }

      seenUserIds.add(member.userId);
      healers.push({ ...member, currentParty: party.partyNumber });
    }
  }

  if (healers.length === 0) {
    console.log(`[Optimize Healer] No healers found`);
    return;
  }

  // Sort by CP descending (highest first)
  healers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

  console.log(`[Optimize Healer] Found ${healers.length} unique healer(s), applying strength concentration`);

  // Use MongoDB transaction to ensure atomicity
  const session = mongoClient.startSession();

  try {
    await session.withTransaction(async () => {
      // STEP 1: Remove ALL healers from ALL parties
      for (const party of refreshedParties) {
        await parties.updateOne(
          { _id: party._id },
          {
            $pull: { members: { role: 'healer' } },
            $set: { 'roleComposition.healer': 0 }
          },
          { session }
        );

        // Recalculate totalCP without healers
        const currentParty = await parties.findOne({ _id: party._id }, { session });
        const remainingMembers = (currentParty.members || []).filter(m => m.role !== 'healer');
        const newTotalCP = remainingMembers.reduce((sum, m) => sum + (m.cp || 0), 0);

        await parties.updateOne(
          { _id: party._id },
          { $set: { totalCP: newTotalCP } },
          { session }
        );
      }

      console.log(`[Optimize Healer] Cleared all healers from parties`);

      // STEP 2: STRENGTH CONCENTRATION - Fill parties sequentially
      // Assign highest CP healers to Party 1 first (up to maxCount), then Party 2, etc.
      let healerIndex = 0;

      for (const targetParty of refreshedParties) {
        let assignedToThisParty = 0;

        // Fill this party up to maxCount with highest available healers
        while (healerIndex < healers.length && assignedToThisParty < maxCount) {
          const healer = healers[healerIndex];

          console.log(`[Optimize Healer] Assigning ${healer.userId} (${healer.cp} CP) to Party ${targetParty.partyNumber} (strength concentration)`);

          // Add healer to target party
          await parties.updateOne(
            { _id: targetParty._id },
            {
              $push: {
                members: {
                  userId: healer.userId,
                  weapon1: healer.weapon1,
                  weapon2: healer.weapon2,
                  cp: healer.cp || 0,
                  role: 'healer',
                  addedAt: new Date()
                }
              },
              $inc: {
                totalCP: (healer.cp || 0),
                'roleComposition.healer': 1
              }
            },
            { session }
          );

          // Update player record
          await partyPlayers.updateOne(
            { userId: healer.userId, guildId },
            { $set: { partyNumber: targetParty.partyNumber } },
            { session }
          );

          // Track move if party changed
          if (healer.currentParty !== targetParty.partyNumber) {
            moves.push({
              userId: healer.userId,
              from: healer.currentParty,
              to: targetParty.partyNumber,
              role: 'healer',
              reason: 'Strength concentration: healer optimization'
            });
          }

          healerIndex++;
          assignedToThisParty++;
        }

        console.log(`[Optimize Healer] Party ${targetParty.partyNumber} assigned ${assignedToThisParty} healer(s)`);

        // If we've assigned all healers, stop
        if (healerIndex >= healers.length) {
          break;
        }
      }

      console.log(`[Optimize Healer] Strength concentration complete - assigned ${healerIndex}/${healers.length} healer(s)`);
    });

    // Send DMs after successful transaction
    const healerMoves = moves.filter(m => m.role === 'healer' && m.reason.includes('Strength concentration'));
    for (const move of healerMoves) {
      await sendPartyChangeDM(
        move.userId,
        move.from,
        move.to,
        'Strength-based rebalancing: Healer optimization',
        guildId,
        client,
        collections
      ).catch(err => console.error('DM failed:', err.message));
    }

  } catch (err) {
    console.error(`[Optimize Healer] Transaction failed:`, err);
    throw err;
  } finally {
    await session.endSession();
  }
}

/**
 * STEP 4: Redistribute DPS by STRENGTH CONCENTRATION
 * 
 * Strategy: Fill parties sequentially with highest CP DPS
 * - Calculate available slots per party (6 - tanks - healers)
 * - Assign highest CP DPS to Party 1 first, then Party 2, etc.
 * - Result: P1 has strongest DPS, P2 has next strongest, etc.
 */
async function redistributeDPSByStrengthConcentration(allParties, guildId, client, collections, moves) {
  const { parties } = collections;

  // Refresh party data from database
  const refreshedParties = [];
  for (const party of allParties) {
    const fresh = await parties.findOne({ guildId, partyNumber: party.partyNumber });
    if (fresh) refreshedParties.push(fresh);
  }

  // Collect all DPS
  const allDPS = [];
  const seenUserIds = new Set();

  for (const party of refreshedParties) {
    const dpsMembers = (party.members || []).filter(m => m.role === 'dps');
    for (const dps of dpsMembers) {
      if (seenUserIds.has(dps.userId)) {
        console.log(`[DPS Redistribution] WARNING: Skipping duplicate ${dps.userId}`);
        continue;
      }
      seenUserIds.add(dps.userId);
      allDPS.push({ ...dps, currentParty: party.partyNumber });
    }
  }

  if (allDPS.length === 0) {
    console.log(`[DPS Redistribution] No DPS found`);
    return;
  }

  // Sort by CP descending (highest first)
  allDPS.sort((a, b) => (b.cp || 0) - (a.cp || 0));

  console.log(`[DPS Redistribution] Found ${allDPS.length} DPS, applying strength concentration`);

  // Clear all DPS from all parties
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
    const currentParty = await parties.findOne({ _id: party._id });
    const remainingMembers = (currentParty.members || []).filter(m => m.role !== 'dps');
    const newTotalCP = remainingMembers.reduce((sum, m) => sum + (m.cp || 0), 0);

    await parties.updateOne(
      { _id: party._id },
      { $set: { totalCP: newTotalCP } }
    );
  }

  // STRENGTH CONCENTRATION: Fill parties sequentially with highest CP DPS
  let dpsIndex = 0;

  for (const party of refreshedParties) {
    const currentParty = await parties.findOne({ guildId, partyNumber: party.partyNumber });
    const comp = analyzePartyComposition(currentParty);
    const slotsAvailable = PARTY_SIZE - comp.tanks - comp.healers;

    console.log(`[DPS Redistribution] Party ${party.partyNumber} has ${slotsAvailable} DPS slots available`);

    if (slotsAvailable <= 0) {
      console.log(`[DPS Redistribution] Party ${party.partyNumber} has no room for DPS`);
      continue;
    }

    // Fill this party with the next highest CP DPS
    const targetDPS = allDPS.slice(dpsIndex, dpsIndex + slotsAvailable);

    for (const dps of targetDPS) {
      console.log(`[DPS Redistribution] Assigning ${dps.userId} (${dps.cp} CP) to Party ${party.partyNumber}`);

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

      await collections.partyPlayers.updateOne(
        { userId: dps.userId, guildId },
        { $set: { partyNumber: party.partyNumber } }
      );

      if (dps.currentParty !== party.partyNumber) {
        moves.push({
          userId: dps.userId,
          from: dps.currentParty,
          to: party.partyNumber,
          role: 'dps',
          reason: 'DPS strength concentration'
        });

        await sendPartyChangeDM(
          dps.userId,
          dps.currentParty,
          party.partyNumber,
          'Strength-based rebalancing: DPS optimization',
          guildId,
          client,
          collections
        ).catch(err => console.error('DM failed:', err.message));
      }
    }

    dpsIndex += targetDPS.length;

    // If we've assigned all DPS, stop
    if (dpsIndex >= allDPS.length) {
      console.log(`[DPS Redistribution] All DPS assigned`);
      break;
    }
  }

  console.log(`[DPS Redistribution] Complete - assigned ${dpsIndex}/${allDPS.length} DPS`);
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
          console.log(`[Periodic Rebalance] ✅ Guild ${guildConfig.guildId}: ${result.moves.length} moved, ${result.reservePromoted || 0} promoted from reserve`);
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

  // Check last rebalance time
  if (!force && settings?.lastPeriodicRebalance) {
    const timeSinceLastRebalance = Date.now() - new Date(settings.lastPeriodicRebalance).getTime();
    if (timeSinceLastRebalance < MIN_REBALANCE_INTERVAL_MS) {
      return { rebalanced: false, reason: 'Too soon since last rebalance' };
    }
  }

  return await strengthBasedRebalance(guildId, client, collections);
}

module.exports = {
  checkAndRebalanceParties,
  movePlayerBetweenParties,
  strengthBasedRebalance,
  startPeriodicRebalancer
};