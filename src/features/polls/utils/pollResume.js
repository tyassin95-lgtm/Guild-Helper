/**
 * Resume active polls after bot restart
 * This ensures polls continue to function even after the bot restarts
 */
async function resumeActivePolls(client, collections) {
  const { guildPolls } = collections;

  try {
    const now = new Date();

    // Find all active polls
    const activePolls = await guildPolls.find({
      active: true,
      closed: false
    }).toArray();

    if (activePolls.length === 0) {
      console.log('ℹ️ No active polls to resume');
      return;
    }

    console.log(`📊 Resuming ${activePolls.length} active poll(s)...`);

    let resumedCount = 0;
    let expiredCount = 0;

    for (const poll of activePolls) {
      try {
        // Check if poll has expired while bot was offline
        if (poll.endsAt <= now) {
          expiredCount++;
          // Will be handled by the auto-update system
          continue;
        }

        // Verify channel and message still exist
        const channel = await client.channels.fetch(poll.channelId).catch(() => null);
        if (!channel) {
          console.warn(`⚠️ Channel ${poll.channelId} not found for poll ${poll._id}, marking inactive`);
          await guildPolls.updateOne(
            { _id: poll._id },
            { $set: { active: false } }
          );
          continue;
        }

        const message = await channel.messages.fetch(poll.messageId).catch(() => null);
        if (!message) {
          console.warn(`⚠️ Message ${poll.messageId} not found for poll ${poll._id}, marking inactive`);
          await guildPolls.updateOne(
            { _id: poll._id },
            { $set: { active: false } }
          );
          continue;
        }

        resumedCount++;
        console.log(`✅ Resumed poll ${poll._id} in guild ${poll.guildId}`);

      } catch (error) {
        console.error(`❌ Error resuming poll ${poll._id}:`, error);
      }
    }

    console.log(`✅ Poll resume complete: ${resumedCount} active, ${expiredCount} expired`);

  } catch (error) {
    console.error('❌ Error in resumeActivePolls:', error);
  }
}

module.exports = { resumeActivePolls };