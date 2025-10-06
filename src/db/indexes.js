async function ensureIndexes({ wishlists, panels, handedOut }) {
  await wishlists.createIndex({ userId: 1, guildId: 1 }, { unique: true });
  await panels.createIndex({ guildId: 1, channelId: 1 });
  await handedOut.createIndex({ guildId: 1, item: 1, userId: 1 }, { unique: true });
}

module.exports = { ensureIndexes };
