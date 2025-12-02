const config = require('../../../config');

/**
 * Schedule a token regeneration for a user after they receive an item
 */
async function scheduleTokenRegeneration(userId, guildId, itemType, collections) {
  const { tokenRegenerations } = collections;

  const regeneratesAt = new Date(Date.now() + (config.TOKEN_REGENERATION_DAYS * 24 * 60 * 60 * 1000));

  await tokenRegenerations.insertOne({
    userId,
    guildId,
    itemType, // 'weapon', 'armor', or 'accessory'
    regeneratesAt,
    createdAt: new Date(),
    processed: false
  });

  console.log(`Scheduled token regeneration for user ${userId} in guild ${guildId} for ${itemType} at ${regeneratesAt}`);
}

/**
 * Process token regenerations that are ready
 */
async function processTokenRegenerations(collections, client) {
  const { tokenRegenerations, wishlists } = collections;

  const now = new Date();

  // Find all regenerations that are ready and not yet processed
  const readyRegenerations = await tokenRegenerations.find({
    regeneratesAt: { $lte: now },
    processed: false
  }).toArray();

  for (const regen of readyRegenerations) {
    try {
      // Grant the token back to the user
      const incrementField = `tokenGrants.${regen.itemType}`;

      await wishlists.updateOne(
        { userId: regen.userId, guildId: regen.guildId },
        { 
          $inc: { [incrementField]: 1 },
          $set: { [`timestamps.lastTokenGrant_${regen.itemType}`]: new Date() }
        },
        { upsert: true }
      );

      // Mark as processed
      await tokenRegenerations.updateOne(
        { _id: regen._id },
        { $set: { processed: true, processedAt: new Date() } }
      );

      console.log(`✅ Token regenerated for user ${regen.userId} in guild ${regen.guildId} (${regen.itemType})`);

      // Send DM to user
      try {
        const user = await client.users.fetch(regen.userId);
        const guild = await client.guilds.fetch(regen.guildId);

        const itemTypeDisplay = regen.itemType.charAt(0).toUpperCase() + regen.itemType.slice(1);

        await user.send({
          content: `🎁 **Token Regenerated!**\n\n` +
                   `Your **${itemTypeDisplay}** token has regenerated in **${guild.name}**!\n\n` +
                   `You can now add a new ${regen.itemType} to your wishlist using \`/mywishlist\`.`
        });
      } catch (err) {
        console.error(`Failed to send token regen DM to user ${regen.userId}:`, err);
      }
    } catch (err) {
      console.error(`Error processing token regeneration for ${regen.userId}:`, err);
    }
  }

  if (readyRegenerations.length > 0) {
    console.log(`Processed ${readyRegenerations.length} token regeneration(s)`);
  }
}

/**
 * Start the token regeneration checker (runs every hour)
 */
function startTokenRegenerationChecker(collections, client) {
  console.log('🔄 Starting token regeneration checker...');

  // Run immediately on startup
  processTokenRegenerations(collections, client);

  // Then run every hour
  setInterval(() => {
    processTokenRegenerations(collections, client);
  }, 60 * 60 * 1000); // 60 minutes
}

/**
 * Cleanup abandoned regeneration items (items added with regen tokens but never finalized)
 */
async function cleanupAbandonedRegenItems(collections) {
  const { wishlists, tokenRegenerations } = collections;

  const cutoffDate = new Date(Date.now() - ((config.TOKEN_REGENERATION_DAYS + 1) * 24 * 60 * 60 * 1000));

  const allWishlists = await wishlists.find({}).toArray();

  for (const wishlist of allWishlists) {
    let modified = false;

    for (const category of ['weapons', 'armor', 'accessories']) {
      const items = wishlist[category] || [];
      const filteredItems = items.filter(item => {
        if (typeof item === 'string') return true; // Legacy items
        if (!item.isRegeneratedToken) return true; // Normal items

        // Check if item was added too long ago and wishlist is not finalized
        if (item.addedAt && new Date(item.addedAt) < cutoffDate && !wishlist.finalized) {
          console.log(`Removing abandoned regen item: ${item.name} from ${wishlist.userId}`);
          return false; // Remove this item
        }

        return true;
      });

      if (filteredItems.length !== items.length) {
        wishlist[category] = filteredItems;
        modified = true;
      }
    }

    if (modified) {
      await wishlists.updateOne(
        { _id: wishlist._id },
        { $set: { weapons: wishlist.weapons, armor: wishlist.armor, accessories: wishlist.accessories } }
      );
    }
  }

  console.log('Cleaned up abandoned regeneration items');
}

/**
 * Cancel all pending token regenerations for a user (used during reset)
 */
async function cancelUserTokenRegenerations(userId, guildId, collections) {
  const { tokenRegenerations } = collections;

  await tokenRegenerations.deleteMany({
    userId,
    guildId,
    processed: false
  });

  console.log(`Cancelled pending token regenerations for user ${userId} in guild ${guildId}`);
}

/**
 * Validate and fix token counts to ensure they never exceed available tokens
 */
async function validateAndFixTokenCounts(wishlist) {
  const baseTokens = { weapon: 1, armor: 4, accessory: 1 };

  // Initialize if missing
  if (!wishlist.tokensUsed) wishlist.tokensUsed = {};
  if (!wishlist.tokenGrants) wishlist.tokenGrants = {};

  let modified = false;

  for (const type of ['weapon', 'armor', 'accessory']) {
    const used = wishlist.tokensUsed[type] || 0;
    const grants = wishlist.tokenGrants[type] || 0;
    const available = baseTokens[type] + grants;

    // If used exceeds available, fix it
    if (used > available) {
      wishlist.tokensUsed[type] = available;
      modified = true;
      console.warn(`Fixed token count for ${type}: used was ${used}, set to ${available}`);
    }
  }

  return modified;
}

/**
 * Get pending token regenerations for a user
 */
async function getUserPendingRegenerations(userId, guildId, collections) {
  const { tokenRegenerations } = collections;

  return await tokenRegenerations.find({
    userId,
    guildId,
    processed: false
  }).toArray();
}

module.exports = {
  scheduleTokenRegeneration,
  processTokenRegenerations,
  startTokenRegenerationChecker,
  cleanupAbandonedRegenItems,
  cancelUserTokenRegenerations,
  validateAndFixTokenCounts,
  getUserPendingRegenerations
};