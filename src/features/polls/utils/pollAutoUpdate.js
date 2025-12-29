const { buildPollEmbed } = require('./pollEmbed');

let pollAutoUpdateInterval = null;

/**
 * Start the auto-update system for polls
 * Checks every minute for polls that should be closed
 */
function startPollAutoUpdate(client, collections) {
  if (pollAutoUpdateInterval) {
    console.log('⚠️ Poll auto-update already running');
    return;
  }

  console.log('✅ Starting poll auto-update system');

  // Check immediately on start
  checkAndCloseExpiredPolls(client, collections);

  // Then check every 60 seconds
  pollAutoUpdateInterval = setInterval(() => {
    checkAndCloseExpiredPolls(client, collections);
  }, 60 * 1000);
}

/**
 * Stop the auto-update system
 */
function stopPollAutoUpdate() {
  if (pollAutoUpdateInterval) {
    clearInterval(pollAutoUpdateInterval);
    pollAutoUpdateInterval = null;
    console.log('✅ Stopped poll auto-update system');
  }
}

/**
 * Check for and close expired polls
 */
async function checkAndCloseExpiredPolls(client, collections) {
  const { guildPolls } = collections;

  try {
    const now = new Date();

    // Find all active polls that have expired
    const expiredPolls = await guildPolls.find({
      active: true,
      closed: false,
      endsAt: { $lte: now }
    }).toArray();

    if (expiredPolls.length === 0) {
      return;
    }

    console.log(`📊 Found ${expiredPolls.length} expired poll(s) to close`);

    for (const poll of expiredPolls) {
      try {
        // Mark poll as closed
        await guildPolls.updateOne(
          { _id: poll._id },
          { 
            $set: { 
              closed: true, 
              active: false 
            } 
          }
        );

        // Try to update the message
        const channel = await client.channels.fetch(poll.channelId).catch(() => null);
        if (!channel) {
          console.warn(`⚠️ Cannot find channel ${poll.channelId} for poll ${poll._id}`);
          continue;
        }

        const message = await channel.messages.fetch(poll.messageId).catch(() => null);
        if (!message) {
          console.warn(`⚠️ Cannot find message ${poll.messageId} for poll ${poll._id}`);
          continue;
        }

        const guild = await client.guilds.fetch(poll.guildId).catch(() => null);

        // Update poll with closed status
        poll.closed = true;
        poll.active = false;

        // Build updated embed
        const updatedEmbed = buildPollEmbed(poll, guild);

        // Remove all buttons (poll is closed)
        await message.edit({
          embeds: [updatedEmbed],
          components: []
        });

        console.log(`✅ Closed poll ${poll._id} in guild ${poll.guildId}`);

        // Optional: Send results announcement
        await channel.send({
          content: `📊 **Poll Closed!** The results are in for: "${poll.description.substring(0, 100)}${poll.description.length > 100 ? '...' : ''}"`
        });

      } catch (error) {
        console.error(`❌ Error closing poll ${poll._id}:`, error);
      }
    }

  } catch (error) {
    console.error('❌ Error in checkAndCloseExpiredPolls:', error);
  }
}

module.exports = {
  startPollAutoUpdate,
  stopPollAutoUpdate,
  checkAndCloseExpiredPolls
};