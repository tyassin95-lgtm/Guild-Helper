const { updateGuildRoster } = require('./commands/guildroster');

let autoUpdateInterval = null;

/**
 * Start the auto-update task for guild rosters
 * Updates all rosters every hour
 */
function startRosterAutoUpdate(client, collections) {
  if (autoUpdateInterval) {
    console.warn('Roster auto-update is already running');
    return;
  }

  console.log('🔄 Starting guild roster auto-update (every 1 hour)...');

  // Run immediately on start
  updateAllRosters(client, collections);

  // Then run every hour
  autoUpdateInterval = setInterval(() => {
    updateAllRosters(client, collections);
  }, 60 * 60 * 1000); // 60 minutes in milliseconds

  console.log('✅ Guild roster auto-update started');
}

/**
 * Stop the auto-update task
 * Used during graceful shutdown
 */
function stopRosterAutoUpdate() {
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
    console.log('🛑 Guild roster auto-update stopped');
  }
}

/**
 * Update all guild rosters across all guilds
 * Used by the background auto-update task
 */
async function updateAllRosters(client, collections) {
  const { guildRosters } = collections;

  try {
    const rosters = await guildRosters.find({}).toArray();

    console.log(`Updating ${rosters.length} guild roster(s)...`);

    for (const roster of rosters) {
      try {
        const guild = await client.guilds.fetch(roster.guildId).catch(() => null);

        if (!guild) {
          console.warn(`Guild ${roster.guildId} not found, skipping roster update`);
          continue;
        }

        if (!roster.channelId) {
          console.warn(`Roster for guild ${roster.guildId} has no channelId, skipping`);
          continue;
        }

        await updateGuildRoster(guild, roster.channelId, collections);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`Failed to update roster for guild ${roster.guildId}:`, err);
      }
    }

    console.log('✅ All guild rosters updated');
  } catch (err) {
    console.error('Failed to update all rosters:', err);
  }
}

module.exports = { startRosterAutoUpdate, stopRosterAutoUpdate, updateAllRosters };