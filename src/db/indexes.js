async function ensureIndexes({ wishlists, panels, handedOut, liveSummaries }) {
  await wishlists.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await panels.createIndex({ guildId: 1, channelId: 1 });
  // FIXED: Include boss field to support same item from different bosses
  await handedOut.createIndex({ guildId: 1, item: 1, userId: 1, boss: 1 }, { unique: true });
  await liveSummaries.createIndex({ guildId: 1 }, { unique: true });
}

module.exports = { ensureIndexes };