const { createItemRollEmbed } = require('../itemRollEmbed');

// Store interval reference for cleanup
let updateInterval = null;

/**
 * Start auto-updating item roll embeds every 5 minutes
 * @param {Client} client - Discord client
 * @param {Object} collections - Database collections
 */
function startItemRollAutoUpdate(client, collections) {
  const { itemRolls } = collections;
  const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Clear any existing interval
  if (updateInterval) {
    clearInterval(updateInterval);
  }

  console.log('Starting item roll auto-update service (5 minute interval)...');

  // Run immediately on start
  updateAllActiveItemRolls(client, collections);

  // Then run every 5 minutes
  updateInterval = setInterval(() => {
    updateAllActiveItemRolls(client, collections);
  }, UPDATE_INTERVAL);
}

/**
 * Stop the auto-update service
 */
function stopItemRollAutoUpdate() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('Item roll auto-update service stopped.');
  }
}

/**
 * Update all active item roll embeds
 * @param {Client} client - Discord client
 * @param {Object} collections - Database collections
 */
async function updateAllActiveItemRolls(client, collections) {
  const { itemRolls } = collections;

  try {
    // Find all active item rolls (not closed and hasn't ended yet)
    const activeRolls = await itemRolls
      .find({
        closed: false,
        endsAt: { $gt: new Date() }
      })
      .toArray();

    if (activeRolls.length === 0) {
      console.log('[Item Roll Update] No active item rolls to update.');
      return;
    }

    console.log(`[Item Roll Update] Updating ${activeRolls.length} active item roll(s)...`);

    let successCount = 0;
    let errorCount = 0;

    for (const roll of activeRolls) {
      try {
        await updateSingleItemRoll(client, roll, collections);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`[Item Roll Update] Failed to update roll ${roll._id}:`, error.message);
      }
    }

    console.log(`[Item Roll Update] Complete: ${successCount} updated, ${errorCount} errors`);
  } catch (error) {
    console.error('[Item Roll Update] Failed to fetch active item rolls:', error);
  }
}

/**
 * Update a single item roll embed
 * @param {Client} client - Discord client
 * @param {Object} itemRoll - Item roll document
 * @param {Object} collections - Database collections
 */
async function updateSingleItemRoll(client, itemRoll, collections) {
  try {
    // Fetch the channel
    const channel = await client.channels.fetch(itemRoll.channelId).catch(() => null);
    if (!channel) {
      console.warn(`[Item Roll Update] Channel ${itemRoll.channelId} not found for roll ${itemRoll._id}`);
      return;
    }

    // Fetch the message
    const message = await channel.messages.fetch(itemRoll.messageId).catch(() => null);
    if (!message) {
      console.warn(`[Item Roll Update] Message ${itemRoll.messageId} not found for roll ${itemRoll._id}`);
      return;
    }

    // Get fresh data from database
    const { itemRolls } = collections;
    const freshRoll = await itemRolls.findOne({ _id: itemRoll._id });

    if (!freshRoll) {
      console.warn(`[Item Roll Update] Roll ${itemRoll._id} no longer exists in database`);
      return;
    }

    // Check if roll has ended while we were updating
    if (new Date() > freshRoll.endsAt && !freshRoll.closed) {
      console.log(`[Item Roll Update] Roll ${itemRoll._id} has expired, will be closed by scheduler`);
      return;
    }

    // Generate updated embed
    const { embed, components } = await createItemRollEmbed(freshRoll, client, collections);

    // Update the message
    await message.edit({
      embeds: [embed],
      components
    });

    console.log(`[Item Roll Update] Successfully updated roll ${itemRoll._id}`);
  } catch (error) {
    // Don't throw, just log - we don't want one failure to stop all updates
    console.error(`[Item Roll Update] Error updating roll ${itemRoll._id}:`, error.message);
  }
}

/**
 * Manually trigger an update for all active item rolls
 * Useful for testing or manual refresh
 * @param {Client} client - Discord client
 * @param {Object} collections - Database collections
 */
async function manualUpdateAllItemRolls(client, collections) {
  console.log('[Item Roll Update] Manual update triggered...');
  await updateAllActiveItemRolls(client, collections);
}

module.exports = {
  startItemRollAutoUpdate,
  stopItemRollAutoUpdate,
  updateAllActiveItemRolls,
  manualUpdateAllItemRolls
};