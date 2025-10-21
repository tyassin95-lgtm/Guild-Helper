const { EmbedBuilder } = require('discord.js');

/**
 * Create PvP Activity Ranking embed for summaries
 * Shows all-time event attendance leaderboard
 */
async function createPvPActivityRankingEmbed(guildId, guild, collections) {
  const { pvpActivityRanking } = collections;

  const allActivity = await pvpActivityRanking
    .find({ guildId })
    .sort({ totalEvents: -1 }) // Sort by most events first
    .toArray();

  const embed = new EmbedBuilder()
    .setColor('#9b59b6')
    .setTitle('🏆 All-Time PvP Activity Ranking')
    .setTimestamp();

  if (allActivity.length === 0) {
    embed.setDescription('*No PvP event attendance recorded yet*');
    return embed;
  }

  // Build the leaderboard
  const leaderboard = [];

  for (let i = 0; i < allActivity.length; i++) {
    const activity = allActivity[i];

    try {
      const member = await guild.members.fetch(activity.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown User';

      // Medal emojis for top 3
      let rank;
      if (i === 0) rank = '🥇';
      else if (i === 1) rank = '🥈';
      else if (i === 2) rank = '🥉';
      else rank = `${i + 1}.`;

      const eventCount = activity.totalEvents;
      const plural = eventCount !== 1 ? 's' : '';

      leaderboard.push(`${rank} **${displayName}** — ${eventCount} event${plural}`);
    } catch (err) {
      console.error('Failed to fetch member for activity ranking:', err);
    }
  }

  // Split into chunks if needed (Discord has 1024 char limit per field)
  const chunkSize = 20; // ~20 users per field
  const chunks = [];

  for (let i = 0; i < leaderboard.length; i += chunkSize) {
    chunks.push(leaderboard.slice(i, i + chunkSize).join('\n'));
  }

  // Add fields
  if (chunks.length === 1) {
    embed.setDescription(chunks[0]);
  } else {
    chunks.forEach((chunk, index) => {
      embed.addFields({
        name: index === 0 ? 'Leaderboard' : '\u200b', // Use zero-width space for continuation
        value: chunk,
        inline: false
      });
    });
  }

  embed.addFields({
    name: '📈 Summary',
    value: `Total active participants: **${allActivity.length}**`,
    inline: false
  });

  return embed;
}

module.exports = { createPvPActivityRankingEmbed };