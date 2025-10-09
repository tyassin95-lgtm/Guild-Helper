const { schedulePartyPanelUpdate } = require('./panelUpdater');
const { movePlayerBetweenParties } = require('./rebalancing');
const { sendPartyChangeDM } = require('./notifications');

const MIN_VIABLE_PARTY_SIZE = 3; // 1T + 1H + 1D minimum

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
 * Select DPS members closest to target CP
 */
function selectDPSForCPClustering(availableDPS, targetAvgCP, count) {
  if (!availableDPS || availableDPS.length === 0) return [];
  if (count <= 0) return [];

  // Sort DPS by how close they are to target CP
  const sorted = [...availableDPS].sort((a, b) => {
    const diffA = Math.abs((a.cp || 0) - targetAvgCP);
    const diffB = Math.abs((b.cp || 0) - targetAvgCP);
    return diffA - diffB;
  });

  // Return the closest 'count' DPS
  return sorted.slice(0, Math.min(count, sorted.length));
}

/**
 * Smart rebalancing when a new party is created
 * Conservative approach: only move duplicates, ensure minimum viable party
 */
async function smartRebalanceNewParty(fullPartyNumber, newPartyNumber, guildId, client, collections) {
  const { parties, guildSettings } = collections;

  console.log(`[Smart Rebalance] Triggered for Party ${fullPartyNumber} → Party ${newPartyNumber}`);

  // Check if auto-assignment is enabled
  const settings = await guildSettings.findOne({ guildId });
  if (settings?.autoAssignmentEnabled === false) {
    console.log(`[Smart Rebalance] Skipped - auto-assignment disabled`);
    return { rebalanced: false, reason: 'Auto-assignment disabled' };
  }

  // Get both parties
  const fullParty = await parties.findOne({ guildId, partyNumber: fullPartyNumber });
  const newParty = await parties.findOne({ guildId, partyNumber: newPartyNumber });

  if (!fullParty || !newParty) {
    console.log(`[Smart Rebalance] Skipped - parties not found`);
    return { rebalanced: false, reason: 'Parties not found' };
  }

  // Analyze compositions
  const fullComp = analyzePartyComposition(fullParty);
  const newComp = analyzePartyComposition(newParty);

  console.log(`[Smart Rebalance] Full Party ${fullPartyNumber}: ${fullComp.tanks}T, ${fullComp.healers}H, ${fullComp.dps}D`);
  console.log(`[Smart Rebalance] New Party ${newPartyNumber}: ${newComp.tanks}T, ${newComp.healers}H, ${newComp.dps}D`);

  // Determine what to move
  const membersToMove = [];

  // Check if full party has duplicate tank and new party needs one
  if (fullComp.tanks >= 2 && newComp.tanks === 0) {
    const tanks = fullParty.members.filter(m => m.role === 'tank');
    // Select lower CP tank
    const tankToMove = tanks.reduce((lowest, tank) => 
      (tank.cp || 0) < (lowest.cp || 0) ? tank : lowest
    );
    membersToMove.push(tankToMove);
    console.log(`[Smart Rebalance] Will move tank: ${tankToMove.userId} (${tankToMove.cp || 0} CP)`);
  }

  // Check if full party has duplicate healer and new party needs one
  if (fullComp.healers >= 2 && newComp.healers === 0) {
    const healers = fullParty.members.filter(m => m.role === 'healer');
    // Select lower CP healer
    const healerToMove = healers.reduce((lowest, healer) => 
      (healer.cp || 0) < (lowest.cp || 0) ? healer : lowest
    );
    membersToMove.push(healerToMove);
    console.log(`[Smart Rebalance] Will move healer: ${healerToMove.userId} (${healerToMove.cp || 0} CP)`);
  }

  // If no duplicates to move, don't rebalance
  if (membersToMove.length === 0) {
    console.log(`[Smart Rebalance] Skipped - full party has no duplicates to spare`);
    return { rebalanced: false, reason: 'No duplicates to move' };
  }

  // Calculate how many members new party will have after moving roles
  const newPartyMembersAfterRoles = newComp.totalMembers + membersToMove.length;

  // Add DPS to reach minimum viable party size (if needed)
  if (newPartyMembersAfterRoles < MIN_VIABLE_PARTY_SIZE) {
    const dpsNeeded = MIN_VIABLE_PARTY_SIZE - newPartyMembersAfterRoles;

    // Calculate target CP for new party
    const newPartyMembers = [...newParty.members, ...membersToMove];
    const targetAvgCP = calculateAverageCP(newPartyMembers);

    console.log(`[Smart Rebalance] New party target avg CP: ${targetAvgCP.toFixed(0)}`);

    // Get available DPS from full party
    const availableDPS = fullParty.members.filter(m => 
      m.role === 'dps' && !membersToMove.includes(m)
    );

    // Select DPS closest to target CP
    const dpsToMove = selectDPSForCPClustering(availableDPS, targetAvgCP, dpsNeeded);

    for (const dps of dpsToMove) {
      membersToMove.push(dps);
      console.log(`[Smart Rebalance] Will move DPS: ${dps.userId} (${dps.cp || 0} CP)`);
    }
  }

  // Ensure we don't leave full party with less than 3 members
  if (fullComp.totalMembers - membersToMove.length < 3) {
    console.log(`[Smart Rebalance] Skipped - would leave full party with < 3 members`);
    return { rebalanced: false, reason: 'Would break full party composition' };
  }

  console.log(`[Smart Rebalance] Executing ${membersToMove.length} move(s)...`);

  // Execute moves
  for (const member of membersToMove) {
    try {
      await movePlayerBetweenParties(
        member.userId,
        guildId,
        fullPartyNumber,
        newPartyNumber,
        client,
        collections
      );

      console.log(`[Smart Rebalance] Moved ${member.userId} (${member.role}) from Party ${fullPartyNumber} to Party ${newPartyNumber}`);

      // Send DM
      try {
        await sendPartyChangeDM(
          member.userId,
          fullPartyNumber,
          newPartyNumber,
          'Smart rebalancing - creating balanced party compositions',
          client,
          collections
        );
      } catch (dmErr) {
        console.error(`[Smart Rebalance] Failed to send DM to ${member.userId}:`, dmErr.message);
      }
    } catch (err) {
      console.error(`[Smart Rebalance] Failed to move ${member.userId}:`, err);
    }
  }

  // Update panel
  await schedulePartyPanelUpdate(guildId, client, collections);

  console.log(`[Smart Rebalance] Complete - moved ${membersToMove.length} member(s)`);

  return { rebalanced: true, moves: membersToMove.length };
}

module.exports = {
  smartRebalanceNewParty
};