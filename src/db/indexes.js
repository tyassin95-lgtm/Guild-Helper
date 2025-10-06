async function ensureIndexes({ wishlists, panels, handedOut, liveSummaries, tokenRegenerations }) {
  await wishlists.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await panels.createIndex({ guildId: 1, channelId: 1 });
  await handedOut.createIndex({ guildId: 1, item: 1, userId: 1, boss: 1 }, { unique: true });
  await liveSummaries.createIndex({ guildId: 1 }, { unique: true });

  // Index for token regenerations
  await tokenRegenerations.createIndex({ userId: 1, guildId: 1 });
  await tokenRegenerations.createIndex({ regeneratesAt: 1, notified: 1 });
  await tokenRegenerations.createIndex({ notified: 1 });
}

module.exports = { ensureIndexes };