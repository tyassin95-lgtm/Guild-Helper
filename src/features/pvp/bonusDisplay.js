const { EmbedBuilder } = require('discord.js');

/**
 * Create PvP Bonus embed for summaries
 */
async function createPvPBonusEmbed(guildId, guild, collections) {
  const { pvpBonuses } = collections;

  const allBonuses = await pvpBonuses
    .find({ guildId })
    .sort({ bonusCount: -1 }) // Sort by highest bonus first
    .toArray();

  const embed = new EmbedBuilder()
    .setColor('#e74c3c')
    .setTitle('📊 PvP Weekly Roll Bonus')
    .setTimestamp();

  if (allBonuses.length === 0) {
    embed.setDescription('*No PvP bonuses recorded yet*');
    return embed;
  }

  // Build the list
  const bonusList = [];

  for (const bonus of allBonuses) {
    try {
      const member = await guild.members.fetch(bonus.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown User';
      const bonusAmount = bonus.bonusCount * 10; // +10 per event
      const eventCount = bonus.bonusCount;

      bonusList.push(`• **${displayName}**: +${bonusAmount} (${eventCount} event${eventCount !== 1 ? 's' : ''})`);
    } catch (err) {
      console.error('Failed to fetch member:', err);
    }
  }

  // Split into chunks if needed (Discord has 1024 char limit per field)
  const chunkSize = 20; // ~20 users per field
  const chunks = [];

  for (let i = 0; i < bonusList.length; i += chunkSize) {
    chunks.push(bonusList.slice(i, i + chunkSize).join('\n'));
  }

  // Add fields
  if (chunks.length === 1) {
    embed.setDescription(chunks[0]);
  } else {
    chunks.forEach((chunk, index) => {
      embed.addFields({
        name: index === 0 ? 'Bonuses' : '\u200b', // Use zero-width space for continuation
        value: chunk,
        inline: false
      });
    });
  }

  embed.addFields({
    name: '📈 Summary',
    value: `Total players with bonuses: **${allBonuses.length}**`,
    inline: false
  });

  return embed;
}

module.exports = { createPvPBonusEmbed };