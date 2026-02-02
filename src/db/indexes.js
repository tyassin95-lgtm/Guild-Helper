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
  wishlistSubmissions,
  wishlistPanels,
  wishlistSettings,
  wishlistGivenItems,
  guildPolls,
  automodSettings,
  automodLogs,
  automodWarnings,
  messageTranslations,
  eventParties,
  staticEvents,
  userSessions
}) {
  await guildSettings.createIndex({ guildId: 1 }, { unique: true });

  await partyPlayers.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await partyPlayers.createIndex({ guildId: 1 });
  await partyPlayers.createIndex({ guildId: 1, partyNumber: 1 });
  await partyPlayers.createIndex({ guildId: 1, role: 1 });
  await partyPlayers.createIndex({ guildId: 1, gearScreenshotUrl: 1 });
  await partyPlayers.createIndex({ guildId: 1, gearStorageMessageId: 1 });
  await partyPlayers.createIndex({ guildId: 1, gearScreenshotUpdatedAt: 1 });

  await parties.createIndex({ guildId: 1, partyNumber: 1 }, { unique: true });
  await parties.createIndex({ guildId: 1 });
  await parties.createIndex({ guildId: 1, totalCP: 1 });

  await partyPanels.createIndex({ guildId: 1 }, { unique: true });

  await guildRosters.createIndex({ guildId: 1 }, { unique: true });
  await guildRosters.createIndex({ channelId: 1 });

  await raidEvents.createIndex({ guildId: 1 });
  await raidEvents.createIndex({ guildId: 1, active: 1 });
  await raidEvents.createIndex({ messageId: 1 });
  await raidEvents.createIndex({ 'timeSlots.timestamp': 1 });
  await raidEvents.createIndex({ guildId: 1, channelId: 1 });

  await dmContexts.createIndex({ userId: 1, type: 1 }, { unique: true });
  await dmContexts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await pvpEvents.createIndex({ guildId: 1 });
  await pvpEvents.createIndex({ guildId: 1, closed: 1 });
  await pvpEvents.createIndex({ guildId: 1, channelId: 1 });
  await pvpEvents.createIndex({ eventTime: 1 });

  await pvpBonuses.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await pvpBonuses.createIndex({ guildId: 1 });
  await pvpBonuses.createIndex({ guildId: 1, bonusCount: -1 });
  await pvpBonuses.createIndex({ guildId: 1, eventsAttended: -1 });

  await pvpActivityRanking.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await pvpActivityRanking.createIndex({ guildId: 1 });
  await pvpActivityRanking.createIndex({ guildId: 1, totalEvents: -1 });

  await pvpCalendars.createIndex({ guildId: 1 }, { unique: true });
  await pvpCalendars.createIndex({ channelId: 1 });
  await pvpCalendars.createIndex({ messageId: 1 });

  await itemRolls.createIndex({ guildId: 1 });
  await itemRolls.createIndex({ guildId: 1, closed: 1 });
  await itemRolls.createIndex({ guildId: 1, channelId: 1 });
  await itemRolls.createIndex({ messageId: 1 });
  await itemRolls.createIndex({ endsAt: 1 });
  await itemRolls.createIndex({ 'rolls.userId': 1 });

  await applicationPanels.createIndex({ guildId: 1 });
  await applicationPanels.createIndex({ guildId: 1, channelId: 1 });
  await applicationPanels.createIndex({ guildId: 1, messageId: 1 });
  await applicationPanels.createIndex({ active: 1 });

  await applicationTickets.createIndex({ guildId: 1 });
  await applicationTickets.createIndex({ guildId: 1, userId: 1 });
  await applicationTickets.createIndex({ guildId: 1, userId: 1, panelId: 1, status: 1 });
  await applicationTickets.createIndex({ guildId: 1, panelId: 1 });
  await applicationTickets.createIndex({ guildId: 1, status: 1 });
  await applicationTickets.createIndex({ ticketChannelId: 1 });
  await applicationTickets.createIndex({ assignedStaffId: 1 });
  await applicationTickets.createIndex({ createdAt: -1 });
  await applicationTickets.createIndex({ lastActivity: -1 });

  await applicationResponses.createIndex({ ticketId: 1 });
  await applicationResponses.createIndex({ guildId: 1, userId: 1 });
  await applicationResponses.createIndex({ guildId: 1, panelId: 1 });
  await applicationResponses.createIndex({ guildId: 1, status: 1 });
  await applicationResponses.createIndex({ submittedAt: -1 });

  await applicationNotes.createIndex({ ticketId: 1 });
  await applicationNotes.createIndex({ guildId: 1 });
  await applicationNotes.createIndex({ staffId: 1 });
  await applicationNotes.createIndex({ createdAt: -1 });

  await applicationBlacklist.createIndex({ guildId: 1, userId: 1 }, { unique: true });
  await applicationBlacklist.createIndex({ guildId: 1 });
  await applicationBlacklist.createIndex({ addedAt: 1 });

  await applicationCooldowns.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await applicationCooldowns.createIndex({ userId: 1, guildId: 1, panelId: 1 });

  await gamblingBalances.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await gamblingBalances.createIndex({ guildId: 1 });
  await gamblingBalances.createIndex({ guildId: 1, balance: -1 });

  await gamblingFunds.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await gamblingFunds.createIndex({ guildId: 1 });
  await gamblingFunds.createIndex({ lastClaimed: 1 });
  await gamblingFunds.createIndex({ guildId: 1, totalUses: -1 });

  await gamblingGames.createIndex({ guildId: 1 });
  await gamblingGames.createIndex({ userId: 1, guildId: 1 });
  await gamblingGames.createIndex({ timestamp: -1 });
  await gamblingGames.createIndex({ gameType: 1 });

  await blackjackGames.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await blackjackGames.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await gamblingRaids.createIndex({ guildId: 1 });
  await gamblingRaids.createIndex({ guildId: 1, status: 1 });
  await gamblingRaids.createIndex({ messageId: 1 });
  await gamblingRaids.createIndex({ finishedAt: 1 }, { expireAfterSeconds: 86400 });

  await triviaStats.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await triviaStats.createIndex({ guildId: 1 });
  await triviaStats.createIndex({ guildId: 1, totalCorrect: -1 });

  await triviaSessions.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await triviaSessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await robCooldowns.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await robCooldowns.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await robStats.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await robStats.createIndex({ guildId: 1 });
  await robStats.createIndex({ guildId: 1, successfulRobs: -1 });

  await killCooldowns.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await killCooldowns.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await killStats.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await killStats.createIndex({ guildId: 1 });
  await killStats.createIndex({ guildId: 1, successfulKills: -1 });
  await killStats.createIndex({ guildId: 1, totalCoinsStolen: -1 });

  await killBiases.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await killBiases.createIndex({ guildId: 1 });
  await killBiases.createIndex({ setBy: 1 });
  await killBiases.createIndex({ lastUpdated: -1 });

  await transferHistory.createIndex({ guildId: 1, timestamp: -1 });
  await transferHistory.createIndex({ fromUserId: 1, guildId: 1 });
  await transferHistory.createIndex({ toUserId: 1, guildId: 1 });

  await wishlistSubmissions.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await wishlistSubmissions.createIndex({ guildId: 1 });
  await wishlistSubmissions.createIndex({ submittedAt: -1 });

  await wishlistPanels.createIndex({ guildId: 1 }, { unique: true });
  await wishlistPanels.createIndex({ channelId: 1 });

  await wishlistSettings.createIndex({ guildId: 1 }, { unique: true });

  await wishlistGivenItems.createIndex({ guildId: 1, userId: 1, itemId: 1 }, { unique: true });
  await wishlistGivenItems.createIndex({ guildId: 1 });
  await wishlistGivenItems.createIndex({ userId: 1 });
  await wishlistGivenItems.createIndex({ itemId: 1 });
  await wishlistGivenItems.createIndex({ givenAt: -1 });

  await guildPolls.createIndex({ guildId: 1 });
  await guildPolls.createIndex({ guildId: 1, active: 1 });
  await guildPolls.createIndex({ guildId: 1, closed: 1 });
  await guildPolls.createIndex({ messageId: 1 });
  await guildPolls.createIndex({ endsAt: 1 });
  await guildPolls.createIndex({ createdAt: -1 });
  await guildPolls.createIndex({ 'options.voters.userId': 1 });

  await automodSettings.createIndex({ guildId: 1 }, { unique: true });

  await automodLogs.createIndex({ guildId: 1 });
  await automodLogs.createIndex({ userId: 1, guildId: 1 });
  await automodLogs.createIndex({ timestamp: -1 });
  await automodLogs.createIndex({ guildId: 1, userId: 1, timestamp: -1 });

  await automodWarnings.createIndex({ userId: 1, guildId: 1 });
  await automodWarnings.createIndex({ guildId: 1 });
  await automodWarnings.createIndex({ timestamp: -1 });
  await automodWarnings.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await messageTranslations.createIndex({ guildId: 1, messageId: 1 }, { unique: true });
  await messageTranslations.createIndex({ guildId: 1 });
  await messageTranslations.createIndex({ channelId: 1 });
  await messageTranslations.createIndex({ translatedAt: -1 });

  // Event Parties indexes (NEW)
  await eventParties.createIndex({ eventId: 1 }, { unique: true });
  await eventParties.createIndex({ guildId: 1 });
  await eventParties.createIndex({ status: 1 });
  await eventParties.createIndex({ approved: 1 });
  await eventParties.createIndex({ createdAt: -1 });

  // Static Events indexes
  await staticEvents.createIndex({ guildId: 1 });
  await staticEvents.createIndex({ guildId: 1, dayOfWeek: 1 });
  await staticEvents.createIndex({ createdAt: -1 });

  // User Sessions indexes (OAuth2)
  await userSessions.createIndex({ discordId: 1 }, { unique: true });
  await userSessions.createIndex({ discordId: 1, guildId: 1 });
  await userSessions.createIndex({ lastLogin: -1 });

  console.log('All indexes created successfully');
}

module.exports = { ensureIndexes };