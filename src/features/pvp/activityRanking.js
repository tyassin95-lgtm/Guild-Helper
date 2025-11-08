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
  let rank = 1; // Track actual rank for active members

  for (let i = 0; i < allActivity.length; i++) {
    const activity = allActivity[i];

    try {
      const member = await guild.members.fetch(activity.userId).catch(() => null);

      // Skip users who have left the server
      if (!member) {
        continue;
      }

      const displayName = member.displayName;

      // Medal emojis for top 3
      let rankDisplay;
      if (rank === 1) rankDisplay = '🥇';
      else if (rank === 2) rankDisplay = '🥈';
      else if (rank === 3) rankDisplay = '🥉';
      else rankDisplay = `${rank}.`;

      const eventCount = activity.totalEvents;
      const plural = eventCount !== 1 ? 's' : '';

      leaderboard.push(`${rankDisplay} **${displayName}** — ${eventCount} event${plural}`);
      rank++; // Increment rank for the next active member
    } catch (err) {
      console.error('Failed to fetch member for activity ranking:', err);
    }
  }

  // If no active members have activity after filtering
  if (leaderboard.length === 0) {
    embed.setDescription('*No active members in PvP activity ranking*');
    return embed;
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
    value: `Total active participants: **${leaderboard.length}**`,
    inline: false
  });

  return embed;
}

module.exports = { createPvPActivityRankingEmbed };