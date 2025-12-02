const { EmbedBuilder } = require('discord.js');
const { TOKEN_REGENERATION_DAYS } = require('../config');

/**
 * Schedule a token regeneration for a user
 */
async function scheduleTokenRegeneration(client, data, collections) {
  const { tokenRegenerations } = collections;

  const regeneratesAt = new Date();
  regeneratesAt.setDate(regeneratesAt.getDate() + TOKEN_REGENERATION_DAYS);

  await tokenRegenerations.insertOne({
    userId: data.userId,
    guildId: data.guildId,
    tokenType: data.tokenType,
    itemName: data.itemName,
    bossName: data.bossName,
    regeneratesAt,
    notified: false,
    createdAt: new Date()
  });

  console.log(`Scheduled ${data.tokenType} token regen for user ${data.userId} at ${regeneratesAt}`);
}

/**
 * Cancel all pending token regenerations for a user (used when resetting)
 */
async function cancelUserTokenRegenerations(userId, guildId, collections) {
  const { tokenRegenerations } = collections;

  const result = await tokenRegenerations.deleteMany({
    userId,
    guildId,
    notified: false
  });

  console.log(`Cancelled ${result.deletedCount} pending token regeneration(s) for user ${userId}`);
  return result.deletedCount;
}

/**
 * Cleanup abandoned regenerated token items
 * This removes items marked with isRegeneratedToken that are older than TOKEN_REGENERATION_DAYS
 * and refunds the token grant
 */
async function cleanupAbandonedRegenItems(collections) {
  const { wishlists } = collections;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - TOKEN_REGENERATION_DAYS - 1); // Give 1 extra day grace period

  const allWishlists = await wishlists.find({ finalized: true }).toArray();
  let cleanupCount = 0;

  for (const wl of allWishlists) {
    const itemTypes = ['weapons', 'armor', 'accessories'];
    const tokenTypeMap = { weapons: 'weapon', armor: 'armor', accessories: 'accessory' };

    let needsUpdate = false;
    const updates = {};

    for (const itemType of itemTypes) {
      const items = wl[itemType] || [];
      const abandonedItems = items.filter(item => 
        typeof item === 'object' && 
        item.isRegeneratedToken && 
        item.addedAt && 
        new Date(item.addedAt) < cutoffDate
      );

      if (abandonedItems.length > 0) {
        needsUpdate = true;
        const tokenKey = tokenTypeMap[itemType];

        // Remove abandoned items
        updates[`$pull`] = updates[`$pull`] || {};
        updates[`$pull`][itemType] = { 
          isRegeneratedToken: true,
          addedAt: { $lt: cutoffDate }
        };

        // Refund tokens
        updates[`$inc`] = updates[`$inc`] || {};
        updates[`$inc`][`tokensUsed.${tokenKey}`] = -abandonedItems.length;
        updates[`$inc`][`tokenGrants.${tokenKey}`] = -abandonedItems.length;

        cleanupCount += abandonedItems.length;
      }
    }

    if (needsUpdate) {
      await wishlists.updateOne(
        { userId: wl.userId, guildId: wl.guildId },
        updates
      );
      console.log(`Cleaned up abandoned regen items for user ${wl.userId}`);
    }
  }

  if (cleanupCount > 0) {
    console.log(`Total abandoned regen items cleaned up: ${cleanupCount}`);
  }

  return cleanupCount;
}

/**
 * Check for tokens ready to regenerate and process them
 * This should be called periodically (e.g., every hour)
 */
async function processTokenRegenerations(client, collections) {
  const { tokenRegenerations, wishlists } = collections;

  const now = new Date();
  const readyToRegen = await tokenRegenerations.find({
    regeneratesAt: { $lte: now },
    notified: false
  }).toArray();

  for (const regen of readyToRegen) {
    try {
      // Check if the wishlist still exists and is finalized
      const wishlist = await wishlists.findOne({ 
        userId: regen.userId, 
        guildId: regen.guildId 
      });

      if (!wishlist) {
        console.log(`Skipping token regen for ${regen.userId} - wishlist not found`);
        await tokenRegenerations.updateOne(
          { _id: regen._id },
          { $set: { notified: true, notifiedAt: new Date(), skipped: true } }
        );
        continue;
      }

      // Grant the token back
      await wishlists.updateOne(
        { userId: regen.userId, guildId: regen.guildId },
        { 
          $inc: { [`tokenGrants.${regen.tokenType}`]: 1 }
        },
        { upsert: true }
      );

      // Send DM to user
      try {
        const user = await client.users.fetch(regen.userId);
        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle('🔄 Token Regenerated!')
          .setDescription(
            `Your **${regen.tokenType}** token has regenerated!\n\n` +
            `This token was used when you received **${regen.itemName}** from **${regen.bossName || 'a boss'}** ${TOKEN_REGENERATION_DAYS} days ago.\n\n` +
            `You can now add a new ${regen.tokenType} to your wishlist using \`/mywishlist\`.`
          )
          .addFields(
            { name: 'Token Type', value: regen.tokenType.charAt(0).toUpperCase() + regen.tokenType.slice(1), inline: true },
            { name: 'Status', value: 'Ready to use!', inline: true }
          )
          .setFooter({ text: 'Use /mywishlist to update your wishlist' })
          .setTimestamp();

        await user.send({ embeds: [embed] });
        console.log(`Sent token regen DM to user ${regen.userId}`);
      } catch (dmErr) {
        console.error(`Failed to DM user ${regen.userId}:`, dmErr.message);
      }

      // Mark as notified
      await tokenRegenerations.updateOne(
        { _id: regen._id },
        { $set: { notified: true, notifiedAt: new Date() } }
      );

    } catch (err) {
      console.error('Error processing token regeneration:', err);
      // Mark as failed but notified to prevent retry loops
      await tokenRegenerations.updateOne(
        { _id: regen._id },
        { $set: { notified: true, notifiedAt: new Date(), error: err.message } }
      ).catch(e => console.error('Failed to mark regen as failed:', e));
    }
  }

  if (readyToRegen.length > 0) {
    console.log(`Processed ${readyToRegen.length} token regeneration(s)`);
  }

  // Also cleanup abandoned items
  await cleanupAbandonedRegenItems(collections);
}

/**
 * Start the token regeneration checker
 * Runs every hour
 */
function startTokenRegenerationChecker(client, collections) {
  // Run immediately on startup
  processTokenRegenerations(client, collections);

  // Then run every hour
  setInterval(() => {
    processTokenRegenerations(client, collections);
  }, 60 * 60 * 1000); // 1 hour in milliseconds

  console.log('Token regeneration checker started (runs every hour)');
}

/**
 * Get pending regenerations for a user (useful for display)
 */
async function getUserPendingRegenerations(userId, guildId, collections) {
  const { tokenRegenerations } = collections;

  return await tokenRegenerations.find({
    userId,
    guildId,
    notified: false
  }).toArray();
}

/**
 * Validate token counts and fix inconsistencies
 */
async function validateAndFixTokenCounts(userId, guildId, collections) {
  const { wishlists } = collections;

  const wl = await wishlists.findOne({ userId, guildId });
  if (!wl) return;

  const fixes = {};
  let needsFix = false;

  // Check each token type
  const tokenTypes = [
    { key: 'weapon', base: 1 },
    { key: 'armor', base: 4 },
    { key: 'accessory', base: 1 }
  ];

  for (const { key, base } of tokenTypes) {
    const used = wl.tokensUsed?.[key] || 0;
    const grants = wl.tokenGrants?.[key] || 0;
    const total = base + grants;

    // If used exceeds total, fix it
    if (used > total) {
      fixes[`tokensUsed.${key}`] = total;
      needsFix = true;
      console.warn(`Fixed token count for user ${userId}: ${key} used (${used}) exceeded total (${total})`);
    }

    // Ensure grants is never negative
    if (grants < 0) {
      fixes[`tokenGrants.${key}`] = 0;
      needsFix = true;
      console.warn(`Fixed negative token grant for user ${userId}: ${key} was ${grants}`);
    }
  }

  if (needsFix) {
    await wishlists.updateOne(
      { userId, guildId },
      { $set: fixes }
    );
  }
}

module.exports = {
  scheduleTokenRegeneration,
  cancelUserTokenRegenerations,
  processTokenRegenerations,
  startTokenRegenerationChecker,
  getUserPendingRegenerations,
  cleanupAbandonedRegenItems,
  validateAndFixTokenCounts
};