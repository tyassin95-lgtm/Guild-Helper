async function ensureIndexes({
  guildSettings,
  partyPlayers,
  parties,
  partyPanels,
  guildRosters,
  raidEvents,
  dmContexts,
  pvpEvents,
  pvpBonuses,
  pvpActivityRanking,
  pvpCalendars,
  itemRolls,
  applicationPanels,
  applicationTickets,
  applicationResponses,
  applicationNotes,
  applicationBlacklist,
  applicationCooldowns,
  gamblingBalances,
  gamblingFunds,
  gamblingGames,
  blackjackGames,
  gamblingRaids,
  triviaStats,
  triviaSessions,
  robCooldowns,
  robStats,
  killCooldowns,
  killStats,
  killBiases,
  transferHistory,
  broadcastSessions,
  broadcastUsers,
  wishlistSubmissions,
  wishlistPanels,
  wishlistSettings,
  wishlistGivenItems,
  guildPolls,
  automodSettings,
  automodLogs,
  automodWarnings // NEW: Warning tracking
}) {
  // Guild settings index
  await guildSettings.createIndex({ guildId: 1 }, { unique: true });

  // Party system indexes
  await partyPlayers.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await partyPlayers.createIndex({ guildId: 1 });
  await partyPlayers.createIndex({ guildId: 1, partyNumber: 1 });
  await partyPlayers.createIndex({ guildId: 1, role: 1 });
  await partyPlayers.createIndex({ guildId: 1, gearScreenshotUrl: 1 }); // For filtering by gear upload status
  await partyPlayers.createIndex({ guildId: 1, gearStorageMessageId: 1 }); // For storage cleanup
  await partyPlayers.createIndex({ guildId: 1, gearScreenshotUpdatedAt: 1 }); // For finding old screenshots

  await parties.createIndex({ guildId: 1, partyNumber: 1 }, { unique: true });
  await parties.createIndex({ guildId: 1 });
  await parties.createIndex({ guildId: 1, totalCP: 1 });

  await partyPanels.createIndex({ guildId: 1 }, { unique: true });

  // Guild rosters indexes
  await guildRosters.createIndex({ guildId: 1 }, { unique: true });
  await guildRosters.createIndex({ channelId: 1 });

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
  await pvpBonuses.createIndex({ guildId: 1, eventsAttended: -1 }); // NEW: Sort by attendance descending

  // PvP Activity Ranking indexes (all-time - never reset)
  await pvpActivityRanking.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await pvpActivityRanking.createIndex({ guildId: 1 });
  await pvpActivityRanking.createIndex({ guildId: 1, totalEvents: -1 }); // Sort by total events descending

  // PvP Calendars indexes
  await pvpCalendars.createIndex({ guildId: 1 }, { unique: true });
  await pvpCalendars.createIndex({ channelId: 1 });
  await pvpCalendars.createIndex({ messageId: 1 });

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

  // Gambling funds (formerly dailies)
  await gamblingFunds.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await gamblingFunds.createIndex({ guildId: 1 });
  await gamblingFunds.createIndex({ lastClaimed: 1 });
  await gamblingFunds.createIndex({ guildId: 1, totalUses: -1 }); // Sort by total uses descending

  // Gambling games (history)
  await gamblingGames.createIndex({ guildId: 1 });
  await gamblingGames.createIndex({ userId: 1, guildId: 1 });
  await gamblingGames.createIndex({ timestamp: -1 }); // Sort by timestamp descending
  await gamblingGames.createIndex({ gameType: 1 });

  // Blackjack active games (with TTL)
  await blackjackGames.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await blackjackGames.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

  // Gambling raid system indexes (FIXED - removed problematic TTL)
  await gamblingRaids.createIndex({ guildId: 1 });
  await gamblingRaids.createIndex({ guildId: 1, status: 1 });
  await gamblingRaids.createIndex({ messageId: 1 });
  // REMOVED: TTL index that was causing immediate deletion
  // await gamblingRaids.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  // Optional: Add TTL with buffer for cleanup of old finished raids
  await gamblingRaids.createIndex({ finishedAt: 1 }, { expireAfterSeconds: 86400 }); // Delete 24h after finishing

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

  // Kill System Indexes
  await killCooldowns.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await killCooldowns.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

  await killStats.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await killStats.createIndex({ guildId: 1 });
  await killStats.createIndex({ guildId: 1, successfulKills: -1 }); // Most kills leaderboard
  await killStats.createIndex({ guildId: 1, totalCoinsStolen: -1 }); // Most stolen leaderboard

  // Kill Bias Indexes
  await killBiases.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await killBiases.createIndex({ guildId: 1 });
  await killBiases.createIndex({ setBy: 1 });
  await killBiases.createIndex({ lastUpdated: -1 });

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

  // Wishlist System Indexes
  await wishlistSubmissions.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await wishlistSubmissions.createIndex({ guildId: 1 });
  await wishlistSubmissions.createIndex({ submittedAt: -1 }); // Sort by submission date

  await wishlistPanels.createIndex({ guildId: 1 }, { unique: true });
  await wishlistPanels.createIndex({ channelId: 1 });

  await wishlistSettings.createIndex({ guildId: 1 }, { unique: true });

  await wishlistGivenItems.createIndex({ guildId: 1, userId: 1, itemId: 1 }, { unique: true });
  await wishlistGivenItems.createIndex({ guildId: 1 });
  await wishlistGivenItems.createIndex({ userId: 1 });
  await wishlistGivenItems.createIndex({ itemId: 1 });
  await wishlistGivenItems.createIndex({ givenAt: -1 }); // Sort by given date

  // Poll System Indexes
  await guildPolls.createIndex({ guildId: 1 });
  await guildPolls.createIndex({ guildId: 1, active: 1 });
  await guildPolls.createIndex({ guildId: 1, closed: 1 });
  await guildPolls.createIndex({ messageId: 1 });
  await guildPolls.createIndex({ endsAt: 1 }); // For auto-close queries
  await guildPolls.createIndex({ createdAt: -1 }); // Sort by creation date
  await guildPolls.createIndex({ 'options.voters.userId': 1 }); // For voter lookups

  // AutoMod System Indexes
  await automodSettings.createIndex({ guildId: 1 }, { unique: true });

  await automodLogs.createIndex({ guildId: 1 });
  await automodLogs.createIndex({ userId: 1, guildId: 1 });
  await automodLogs.createIndex({ timestamp: -1 }); // Sort by timestamp descending
  await automodLogs.createIndex({ guildId: 1, userId: 1, timestamp: -1 });

  // AutoMod warning indexes (with TTL for auto-cleanup)
  await automodWarnings.createIndex({ userId: 1, guildId: 1 });
  await automodWarnings.createIndex({ guildId: 1 });
  await automodWarnings.createIndex({ timestamp: -1 });
  await automodWarnings.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete old warnings

  console.log('All indexes created successfully');
}

module.exports = { ensureIndexes };