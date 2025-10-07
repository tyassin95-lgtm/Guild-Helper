async function ensureIndexes({ wishlists, panels, handedOut, liveSummaries, tokenRegenerations, userCooldowns }) {
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

  console.log('All indexes created successfully');
}

module.exports = { ensureIndexes };