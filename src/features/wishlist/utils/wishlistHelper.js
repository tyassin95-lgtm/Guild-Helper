/**
 * Shared utilities for wishlist operations
 */

async function getUserWishlist(wishlists, userId, guildId) {
  let wishlist = await wishlists.findOne({ userId, guildId });
  if (!wishlist) {
    wishlist = {
      userId,
      guildId,
      weapons: [],
      armor: [],
      accessories: [],
      tokensUsed: { weapon: 0, armor: 0, accessory: 0 },
      tokenGrants: { weapon: 0, armor: 0, accessory: 0 },
      timestamps: {},
      itemsReceived: [],
      finalized: false
    };
    await wishlists.insertOne(wishlist);
  }
  return wishlist;
}

module.exports = { getUserWishlist };