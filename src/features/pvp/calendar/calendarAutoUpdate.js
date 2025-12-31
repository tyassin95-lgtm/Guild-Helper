const { updateAllCalendars } = require('./calendarUpdate');

let autoUpdateInterval = null;

/**
 * Start the auto-update task for PvP calendars
 * Updates all calendars every 15 minutes
 */
function startCalendarAutoUpdate(client, collections) {
  if (autoUpdateInterval) {
    console.warn('Calendar auto-update is already running');
    return;
  }

  console.log('🔄 Starting PvP calendar auto-update (every 15 minutes)...');

  // Run immediately on start
  updateAllCalendars(client, collections);

  // Then run every 15 minutes
  autoUpdateInterval = setInterval(() => {
    updateAllCalendars(client, collections);
  }, 15 * 60 * 1000); // 15 minutes in milliseconds

  console.log('✅ PvP calendar auto-update started');
}

/**
 * Stop the auto-update task
 * Used during graceful shutdown
 */
function stopCalendarAutoUpdate() {
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
    console.log('🛑 PvP calendar auto-update stopped');
  }
}

module.exports = { startCalendarAutoUpdate, stopCalendarAutoUpdate };