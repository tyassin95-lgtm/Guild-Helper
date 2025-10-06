const { EmbedBuilder } = require('discord.js');

/**
 * Schedule a token regeneration for a user
 */
async function scheduleTokenRegeneration(client, data, collections) {
  const { tokenRegenerations } = collections;

  await tokenRegenerations.insertOne({
    userId: data.userId,
    guildId: data.guildId,
    tokenType: data.tokenType,
    itemName: data.itemName,
    bossName: data.bossName,
    regeneratesAt: data.regeneratesAt,
    notified: false,
    createdAt: new Date()
  });

  console.log(`Scheduled ${data.tokenType} token regen for user ${data.userId} at ${data.regeneratesAt}`);
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
      // Grant the token back (but keep wishlist finalized)
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
            `This token was used when you received **${regen.itemName}** from **${regen.bossName || 'a boss'}** 7 days ago.\n\n` +
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
        console.error(`Failed to DM user ${regen.userId}:`, dmErr);
      }

      // Mark as notified
      await tokenRegenerations.updateOne(
        { _id: regen._id },
        { $set: { notified: true, notifiedAt: new Date() } }
      );

    } catch (err) {
      console.error('Error processing token regeneration:', err);
    }
  }

  if (readyToRegen.length > 0) {
    console.log(`Processed ${readyToRegen.length} token regeneration(s)`);
  }
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

module.exports = {
  scheduleTokenRegeneration,
  cancelUserTokenRegenerations,
  processTokenRegenerations,
  startTokenRegenerationChecker,
  getUserPendingRegenerations
};