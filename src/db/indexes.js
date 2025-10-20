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
  raidSessions,
  dmContexts,
  pvpEvents,
  pvpBonuses
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

  // Raid sessions indexes
  await raidSessions.createIndex({ guildId: 1, active: 1 });
  await raidSessions.createIndex({ guildId: 1 });
  await raidSessions.createIndex({ frozenAt: 1 });

  // DM contexts indexes
  await dmContexts.createIndex({ userId: 1 }, { unique: true });
  await dmContexts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-cleanup

  // PvP Events indexes
  await pvpEvents.createIndex({ guildId: 1 });
  await pvpEvents.createIndex({ guildId: 1, closed: 1 });
  await pvpEvents.createIndex({ guildId: 1, channelId: 1 });
  await pvpEvents.createIndex({ eventTime: 1 });

  // PvP Bonuses indexes
  await pvpBonuses.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await pvpBonuses.createIndex({ guildId: 1 });
  await pvpBonuses.createIndex({ guildId: 1, bonusCount: -1 }); // Sort by bonus count descending

  console.log('All indexes created successfully');
}

module.exports = { ensureIndexes };