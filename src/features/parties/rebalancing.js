const { sendPartyChangeDM } = require('./notifications');
const { PARTY_SIZE } = require('./constants');

const DEFAULT_REBALANCE_THRESHOLD = 0.20; // 20% CP difference
const MIN_REBALANCE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PERIODIC_REBALANCE_INTERVAL_MS = 72 * 60 * 60 * 1000; // 72 hours

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
 * Calculate average CP of party members
 */
function calculateAverageCP(members) {
  if (!members || members.length === 0) return 0;
  const totalCP = members.reduce((sum, m) => sum + (m.cp || 0), 0);
  return totalCP / members.length;
}

/**
 * Periodic rebalancing - runs every 72 hours
 * Fixes duplicate roles and missing roles across ALL parties
 */
async function periodicRebalanceAllParties(guildId, client, collections) {
  const { parties, guildSettings } = collections;

  console.log(`[Periodic Rebalance] Starting for guild ${guildId}`);

  // Check if auto-assignment is enabled
  const settings = await guildSettings.findOne({ guildId });
  if (settings?.autoAssignmentEnabled === false) {
    console.log(`[Periodic Rebalance] Skipped - auto-assignment disabled for guild ${guildId}`);
    return { rebalanced: false, reason: 'Auto-assignment disabled' };
  }

  // Get all parties
  const allParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();

  if (allParties.length < 2) {
    console.log(`[Periodic Rebalance] Skipped - not enough parties (${allParties.length})`);
    return { rebalanced: false, reason: 'Not enough parties to rebalance' };
  }

  // Find parties with duplicates and parties with gaps
  const duplicates = [];
  const gaps = [];

  for (const party of allParties) {
    const comp = analyzePartyComposition(party);

    // Skip empty parties
    if (comp.totalMembers === 0) continue;

    // Check for duplicates (2+ tanks or 2+ healers)
    if (comp.tanks >= 2) {
      const tankMembers = party.members.filter(m => m.role === 'tank');
      duplicates.push({ 
        party, 
        role: 'tank', 
        members: tankMembers
      });
      console.log(`[Periodic Rebalance] Party ${party.partyNumber} has ${comp.tanks} tanks (duplicate)`);
    }
    if (comp.healers >= 2) {
      const healerMembers = party.members.filter(m => m.role === 'healer');
      duplicates.push({ 
        party, 
        role: 'healer', 
        members: healerMembers
      });
      console.log(`[Periodic Rebalance] Party ${party.partyNumber} has ${comp.healers} healers (duplicate)`);
    }

    // Check for gaps (0 tanks or 0 healers)
    if (comp.tanks === 0) {
      gaps.push({ party, needs: 'tank' });
      console.log(`[Periodic Rebalance] Party ${party.partyNumber} needs a tank`);
    }
    if (comp.healers === 0) {
      gaps.push({ party, needs: 'healer' });
      console.log(`[Periodic Rebalance] Party ${party.partyNumber} needs a healer`);
    }
  }

  if (duplicates.length === 0 || gaps.length === 0) {
    console.log(`[Periodic Rebalance] No rebalancing needed - duplicates: ${duplicates.length}, gaps: ${gaps.length}`);
    return { rebalanced: false, reason: 'No rebalancing needed' };
  }

  // Match duplicates with gaps
  const moves = [];

  for (const gap of gaps) {
    // Find a matching duplicate (same role that the gap needs)
    const matchingDuplicateIndex = duplicates.findIndex(d => d.role === gap.needs);

    if (matchingDuplicateIndex === -1) {
      console.log(`[Periodic Rebalance] No matching duplicate found for Party ${gap.party.partyNumber} (needs ${gap.needs})`);
      continue;
    }

    const matchingDuplicate = duplicates[matchingDuplicateIndex];

    // Calculate which duplicate member to move (CP clustering)
    const gapAvgCP = calculateAverageCP(gap.party.members);

    console.log(`[Periodic Rebalance] Party ${gap.party.partyNumber} avg CP: ${gapAvgCP.toFixed(0)}`);

    // Find duplicate member closest to gap's average CP
    let memberToMove = matchingDuplicate.members[0];
    let smallestDiff = Math.abs((memberToMove.cp || 0) - gapAvgCP);

    for (const member of matchingDuplicate.members) {
      const diff = Math.abs((member.cp || 0) - gapAvgCP);
      console.log(`[Periodic Rebalance] Candidate: ${member.userId} (${member.cp || 0} CP, diff: ${diff.toFixed(0)})`);

      if (diff < smallestDiff) {
        smallestDiff = diff;
        memberToMove = member;
      }
    }

    console.log(`[Periodic Rebalance] Selected to move: ${memberToMove.userId} (${memberToMove.cp || 0} CP)`);

    moves.push({
      userId: memberToMove.userId,
      fromParty: matchingDuplicate.party.partyNumber,
      toParty: gap.party.partyNumber,
      role: gap.needs,
      cp: memberToMove.cp || 0,
      reason: 'Periodic rebalancing - critical role needed'
    });

    // Remove this duplicate from consideration (so we don't move multiple from same party)
    duplicates.splice(matchingDuplicateIndex, 1);
  }

  if (moves.length === 0) {
    console.log(`[Periodic Rebalance] No valid moves found`);
    return { rebalanced: false, reason: 'No valid moves found' };
  }

  console.log(`[Periodic Rebalance] Executing ${moves.length} move(s)...`);

  // Execute moves
  for (const move of moves) {
    try {
      await movePlayerBetweenParties(
        move.userId,
        guildId,
        move.fromParty,
        move.toParty,
        client,
        collections
      );

      console.log(`[Periodic Rebalance] Moved ${move.userId} from Party ${move.fromParty} to Party ${move.toParty}`);

      // Send DM
      try {
        await sendPartyChangeDM(
          move.userId,
          move.fromParty,
          move.toParty,
          move.reason,
          client,
          collections
        );
      } catch (dmErr) {
        console.error(`[Periodic Rebalance] Failed to send DM to ${move.userId}:`, dmErr.message);
      }
    } catch (err) {
      console.error(`[Periodic Rebalance] Failed to move ${move.userId}:`, err);
    }
  }

  // Update panel
  const { schedulePartyPanelUpdate } = require('./panelUpdater');
  await schedulePartyPanelUpdate(guildId, client, collections);

  // Update last rebalance time
  await guildSettings.updateOne(
    { guildId },
    { $set: { lastPeriodicRebalance: new Date() } },
    { upsert: true }
  );

  console.log(`[Periodic Rebalance] Complete for guild ${guildId} - ${moves.length} move(s) executed`);

  return { rebalanced: true, moves };
}

/**
 * Start the periodic rebalancer (runs every 72 hours)
 */
function startPeriodicRebalancer(client, collections) {
  console.log(`🔄 Starting periodic party rebalancer (72 hour interval)...`);

  // Run immediately on startup (for guilds that might need it)
  setTimeout(async () => {
    await runPeriodicRebalancerForAllGuilds(client, collections);
  }, 60 * 1000); // Wait 1 minute after startup

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
    // Get all guilds with auto-assignment enabled
    const guildsWithAuto = await guildSettings.find({ 
      autoAssignmentEnabled: { $ne: false }
    }).toArray();

    console.log(`[Periodic Rebalance] Found ${guildsWithAuto.length} guild(s) with auto-assignment enabled`);

    for (const guildConfig of guildsWithAuto) {
      try {
        const result = await periodicRebalanceAllParties(
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
 * Check if parties need rebalancing and execute if needed (manual trigger)
 */
async function checkAndRebalanceParties(guildId, client, collections, force = false) {
  const { parties, guildSettings } = collections;

  // Check guild settings
  const settings = await guildSettings.findOne({ guildId });
  if (!force && settings?.autoAssignmentEnabled === false) {
    return { rebalanced: false, reason: 'Auto-assignment disabled' };
  }

  const threshold = settings?.rebalanceThreshold || DEFAULT_REBALANCE_THRESHOLD;

  // Check last rebalance time (prevent too frequent rebalancing)
  if (!force && settings?.lastAutoRebalance) {
    const timeSinceLastRebalance = Date.now() - new Date(settings.lastAutoRebalance).getTime();
    if (timeSinceLastRebalance < MIN_REBALANCE_INTERVAL_MS) {
      return { rebalanced: false, reason: 'Too soon since last rebalance' };
    }
  }

  // Get all parties with at least 2 members (need at least 2 parties to rebalance)
  const allParties = await parties.find({ guildId }).toArray();
  const eligibleParties = allParties.filter(p => (p.members?.length || 0) >= 2);

  if (eligibleParties.length < 2) {
    return { rebalanced: false, reason: 'Not enough parties to rebalance' };
  }

  // Calculate average CP
  const totalMembers = eligibleParties.reduce((sum, p) => sum + (p.members?.length || 0), 0);
  const totalCP = eligibleParties.reduce((sum, p) => sum + (p.totalCP || 0), 0);
  const avgCPPerMember = totalMembers > 0 ? totalCP / totalMembers : 0;

  // Find parties that deviate significantly from average
  const partiesNeedingRebalance = [];

  for (const party of eligibleParties) {
    const memberCount = party.members?.length || 0;
    if (memberCount === 0) continue;

    const avgCPThisParty = (party.totalCP || 0) / memberCount;
    const deviation = Math.abs(avgCPThisParty - avgCPPerMember) / avgCPPerMember;

    if (deviation > threshold) {
      partiesNeedingRebalance.push({
        party,
        avgCP: avgCPThisParty,
        deviation
      });
    }
  }

  if (partiesNeedingRebalance.length === 0) {
    return { rebalanced: false, reason: 'Parties are balanced' };
  }

  // Execute rebalancing
  const moves = await executeRebalancing(guildId, eligibleParties, avgCPPerMember, threshold, client, collections);

  // Update last rebalance time
  await guildSettings.updateOne(
    { guildId },
    { $set: { lastAutoRebalance: new Date() } },
    { upsert: true }
  );

  return { rebalanced: true, moves };
}

/**
 * Execute rebalancing by moving DPS players between parties
 */
async function executeRebalancing(guildId, allParties, targetAvgCP, threshold, client, collections) {
  const { parties, partyPlayers } = collections;
  const moves = [];

  // Sort parties: highest CP first, lowest CP last
  const sortedParties = [...allParties].sort((a, b) => {
    const avgA = (a.totalCP || 0) / (a.members?.length || 1);
    const avgB = (b.totalCP || 0) / (b.members?.length || 1);
    return avgB - avgA;
  });

  const highCPParties = sortedParties.slice(0, Math.ceil(sortedParties.length / 2));
  const lowCPParties = sortedParties.slice(Math.ceil(sortedParties.length / 2));

  // Try to move DPS players from high CP parties to low CP parties
  for (const highParty of highCPParties) {
    const avgCPHigh = (highParty.totalCP || 0) / (highParty.members?.length || 1);

    // Only rebalance if significantly above target
    const deviationHigh = Math.abs(avgCPHigh - targetAvgCP) / targetAvgCP;
    if (deviationHigh <= threshold) continue;

    // Find DPS members (we preserve tanks and healers)
    const dpsMembers = (highParty.members || [])
      .filter(m => m.role === 'dps')
      .sort((a, b) => (b.cp || 0) - (a.cp || 0)); // Highest CP DPS first

    if (dpsMembers.length === 0) continue;

    // Try to move one DPS to a low CP party
    for (const lowParty of lowCPParties) {
      if ((lowParty.members?.length || 0) >= PARTY_SIZE) continue;

      const avgCPLow = (lowParty.totalCP || 0) / (lowParty.members?.length || 1);

      // Only move if it improves balance
      const deviationLow = Math.abs(avgCPLow - targetAvgCP) / targetAvgCP;
      if (deviationLow <= threshold) continue;

      // Find best DPS to move
      const memberToMove = dpsMembers[0];
      if (!memberToMove) break;

      // Execute move
      try {
        await movePlayerBetweenParties(
          memberToMove.userId,
          guildId,
          highParty.partyNumber,
          lowParty.partyNumber,
          client,
          collections
        );

        moves.push({
          userId: memberToMove.userId,
          from: highParty.partyNumber,
          to: lowParty.partyNumber,
          reason: 'CP Rebalancing'
        });

        // Remove from array so we don't try to move them again
        dpsMembers.shift();

        // Only move one player per iteration to avoid over-rebalancing
        break;
      } catch (err) {
        console.error('Failed to move player during rebalancing:', err);
      }
    }
  }

  return moves;
}

/**
 * Move a player between parties
 */
async function movePlayerBetweenParties(userId, guildId, fromParty, toParty, client, collections) {
  const { parties, partyPlayers } = collections;

  // Get source party
  const sourceParty = await parties.findOne({ guildId, partyNumber: fromParty });
  if (!sourceParty) throw new Error('Source party not found');

  // Get member info
  const member = sourceParty.members?.find(m => m.userId === userId);
  if (!member) throw new Error('Member not found in source party');

  // Get destination party
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

  // Send DM notification
  try {
    await sendPartyChangeDM(userId, fromParty, toParty, 'Party Rebalancing', client, collections);
  } catch (err) {
    console.error(`Failed to send party change DM to ${userId}:`, err.message);
  }
}

module.exports = {
  checkAndRebalanceParties,
  executeRebalancing,
  movePlayerBetweenParties,
  periodicRebalanceAllParties,
  startPeriodicRebalancer
};