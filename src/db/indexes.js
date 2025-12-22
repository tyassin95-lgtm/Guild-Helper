async function ensureIndexes({
  wishlists,
  panels,
  handedOut,
  liveSummaries,
  tokenRegenerations,
  userCooldowns,
  guildSettings,
  partyPlayers,
  parties,
  partyPanels,
  guildRosters,
  raidSessions,
  raidEvents,
  dmContexts,
  pvpEvents,
  pvpBonuses,
  pvpActivityRanking,
  itemRolls,
  applicationPanels,
  applicationTickets,
  applicationResponses,
  applicationNotes,
  applicationBlacklist,
  applicationCooldowns,
  gamblingBalances,
  gamblingDailies,
  gamblingGames,
  blackjackGames,
  triviaStats,
  triviaSessions,
  robCooldowns,
  robStats,
  transferHistory,
  broadcastSessions,
  broadcastUsers
}) {
  // Wishlists index
  await wishlists.createIndex({ userId: 1, guildId: 1 }, { unique: true });

  // Panels index
  await panels.createIndex({ guildId: 1, channelId: 1 });

  // HandedOut indexes - drop and recreate to add unique constraint
  try {
    // Try to drop the old index if it exists
    await handedOut.dropIndex('guildId_1_userId_1_item_1_boss_1');
  } catch (err) {
    // Index doesn't exist yet, that's fine
    if (err.code !== 27) { // 27 = IndexNotFound
      console.log('Note: Could not drop handedOut index (may not exist):', err.message);
    }
  }

  // Create new index with unique constraint
  await handedOut.createIndex({ guildId: 1, userId: 1, item: 1, boss: 1 }, { unique: true });
  await handedOut.createIndex({ guildId: 1 });

  // Live summaries index
  await liveSummaries.createIndex({ guildId: 1 }, { unique: true });

  // Token regenerations indexes
  await tokenRegenerations.createIndex({ userId: 1, guildId: 1 });
  await tokenRegenerations.createIndex({ regeneratesAt: 1, notified: 1 });
  await tokenRegenerations.createIndex({ notified: 1 });

  // User cooldowns indexes (with TTL)
  await userCooldowns.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await userCooldowns.createIndex({ userId: 1, interactionType: 1 });

  // Guild settings index
  await guildSettings.createIndex({ guildId: 1 }, { unique: true });

  // Party system indexes
  await partyPlayers.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await partyPlayers.createIndex({ guildId: 1 });
  await partyPlayers.createIndex({ guildId: 1, partyNumber: 1 });
  await partyPlayers.createIndex({ guildId: 1, role: 1 });

  await parties.createIndex({ guildId: 1, partyNumber: 1 }, { unique: true });
  await parties.createIndex({ guildId: 1 });
  await parties.createIndex({ guildId: 1, totalCP: 1 });

  await partyPanels.createIndex({ guildId: 1 }, { unique: true });

  // Guild rosters indexes
  await guildRosters.createIndex({ guildId: 1 }, { unique: true });
  await guildRosters.createIndex({ channelId: 1 });

  // Raid sessions indexes
  await raidSessions.createIndex({ guildId: 1, active: 1 });
  await raidSessions.createIndex({ guildId: 1 });
  await raidSessions.createIndex({ frozenAt: 1 });
  await raidSessions.createIndex({ active: 1 });

  // Raid events indexes
  await raidEvents.createIndex({ guildId: 1 });
  await raidEvents.createIndex({ guildId: 1, active: 1 });
  await raidEvents.createIndex({ messageId: 1 });
  await raidEvents.createIndex({ 'timeSlots.timestamp': 1 });
  await raidEvents.createIndex({ guildId: 1, channelId: 1 });

  // DM contexts indexes
  await dmContexts.createIndex({ userId: 1, type: 1 }, { unique: true });
  await dmContexts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-cleanup

  // PvP Events indexes
  await pvpEvents.createIndex({ guildId: 1 });
  await pvpEvents.createIndex({ guildId: 1, closed: 1 });
  await pvpEvents.createIndex({ guildId: 1, channelId: 1 });
  await pvpEvents.createIndex({ eventTime: 1 });

  // PvP Bonuses indexes (weekly bonuses - can be reset)
  await pvpBonuses.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await pvpBonuses.createIndex({ guildId: 1 });
  await pvpBonuses.createIndex({ guildId: 1, bonusCount: -1 }); // Sort by bonus count descending

  // PvP Activity Ranking indexes (all-time - never reset)
  await pvpActivityRanking.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await pvpActivityRanking.createIndex({ guildId: 1 });
  await pvpActivityRanking.createIndex({ guildId: 1, totalEvents: -1 }); // Sort by total events descending

  // Item Roll indexes
  await itemRolls.createIndex({ guildId: 1 });
  await itemRolls.createIndex({ guildId: 1, closed: 1 });
  await itemRolls.createIndex({ guildId: 1, channelId: 1 });
  await itemRolls.createIndex({ messageId: 1 });
  await itemRolls.createIndex({ endsAt: 1 });
  await itemRolls.createIndex({ 'rolls.userId': 1 });

  // Application System Indexes
  // Application panels
  await applicationPanels.createIndex({ guildId: 1 });
  await applicationPanels.createIndex({ guildId: 1, channelId: 1 });
  await applicationPanels.createIndex({ guildId: 1, messageId: 1 });
  await applicationPanels.createIndex({ active: 1 });

  // Application tickets
  await applicationTickets.createIndex({ guildId: 1 });
  await applicationTickets.createIndex({ guildId: 1, userId: 1 });
  await applicationTickets.createIndex({ guildId: 1, userId: 1, panelId: 1, status: 1 });
  await applicationTickets.createIndex({ guildId: 1, panelId: 1 });
  await applicationTickets.createIndex({ guildId: 1, status: 1 });
  await applicationTickets.createIndex({ ticketChannelId: 1 });
  await applicationTickets.createIndex({ assignedStaffId: 1 });
  await applicationTickets.createIndex({ createdAt: -1 }); // For sorting by newest
  await applicationTickets.createIndex({ lastActivity: -1 }); // For cleanup queries

  // Application responses
  await applicationResponses.createIndex({ ticketId: 1 });
  await applicationResponses.createIndex({ guildId: 1, userId: 1 });
  await applicationResponses.createIndex({ guildId: 1, panelId: 1 });
  await applicationResponses.createIndex({ guildId: 1, status: 1 });
  await applicationResponses.createIndex({ submittedAt: -1 });

  // Application notes
  await applicationNotes.createIndex({ ticketId: 1 });
  await applicationNotes.createIndex({ guildId: 1 });
  await applicationNotes.createIndex({ staffId: 1 });
  await applicationNotes.createIndex({ createdAt: -1 });

  // Application blacklist
  await applicationBlacklist.createIndex({ guildId: 1, userId: 1 }, { unique: true });
  await applicationBlacklist.createIndex({ guildId: 1 });
  await applicationBlacklist.createIndex({ addedAt: 1 });

  // Application cooldowns (with TTL)
  await applicationCooldowns.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await applicationCooldowns.createIndex({ userId: 1, guildId: 1, panelId: 1 });

  // Gambling System Indexes
  // Gambling balances
  await gamblingBalances.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await gamblingBalances.createIndex({ guildId: 1 });
  await gamblingBalances.createIndex({ guildId: 1, balance: -1 }); // Sort by balance descending

  // Gambling dailies
  await gamblingDailies.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await gamblingDailies.createIndex({ guildId: 1 });
  await gamblingDailies.createIndex({ lastClaimed: 1 });

  // Gambling games (history)
  await gamblingGames.createIndex({ guildId: 1 });
  await gamblingGames.createIndex({ userId: 1, guildId: 1 });
  await gamblingGames.createIndex({ timestamp: -1 }); // Sort by timestamp descending
  await gamblingGames.createIndex({ gameType: 1 });

  // Blackjack active games (with TTL)
  await blackjackGames.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await blackjackGames.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

  // Trivia System Indexes
  await triviaStats.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await triviaStats.createIndex({ guildId: 1 });
  await triviaStats.createIndex({ guildId: 1, totalCorrect: -1 }); // Leaderboard

  await triviaSessions.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await triviaSessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

  // Rob System Indexes
  await robCooldowns.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await robCooldowns.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

  await robStats.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await robStats.createIndex({ guildId: 1 });
  await robStats.createIndex({ guildId: 1, successfulRobs: -1 }); // Leaderboard

  // Transfer History Indexes
  await transferHistory.createIndex({ guildId: 1, timestamp: -1 });
  await transferHistory.createIndex({ fromUserId: 1, guildId: 1 });
  await transferHistory.createIndex({ toUserId: 1, guildId: 1 });

  // Broadcast System Indexes
  await broadcastSessions.createIndex({ guildId: 1 }, { unique: true });
  await broadcastSessions.createIndex({ active: 1 });
  await broadcastSessions.createIndex({ sourceChannelId: 1 });

  await broadcastUsers.createIndex({ guildId: 1, userId: 1 }, { unique: true });
  await broadcastUsers.createIndex({ guildId: 1 });
  await broadcastUsers.createIndex({ guildId: 1, enabled: 1 });

  console.log('All indexes created successfully');
}

module.exports = { ensureIndexes };