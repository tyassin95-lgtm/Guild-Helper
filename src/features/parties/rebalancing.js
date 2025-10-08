const { sendPartyChangeDM } = require('./notifications');
const { PARTY_SIZE } = require('./constants');

const DEFAULT_REBALANCE_THRESHOLD = 0.20; // 20% CP difference
const MIN_REBALANCE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if parties need rebalancing and execute if needed
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
    await sendPartyChangeDM(userId, fromParty, toParty, 'CP Rebalancing', client, collections);
  } catch (err) {
    console.error(`Failed to send party change DM to ${userId}:`, err.message);
  }
}

module.exports = {
  checkAndRebalanceParties,
  executeRebalancing,
  movePlayerBetweenParties
};