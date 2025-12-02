/**
 * Check if wishlist modifications are frozen for a guild
 */
async function isWishlistFrozen(guildId, collections) {
  const { guildSettings } = collections;
  const settings = await guildSettings.findOne({ guildId });
  return settings?.finalizeFrozen || false;
}

module.exports = { isWishlistFrozen };