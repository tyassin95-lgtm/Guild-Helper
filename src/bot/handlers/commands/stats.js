const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

async function handleStats({ interaction, collections }) {
  const { wishlists } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to view statistics.', flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  // Get all finalized wishlists for this guild
  const allWishlists = await wishlists.find({ guildId: interaction.guildId, finalized: true }).toArray();

  if (allWishlists.length === 0) {
    return interaction.editReply({ content: '❌ No finalized wishlists found yet.', flags: [64] });
  }

  // Statistics containers
  const itemCounts = {}; // item name -> count
  const bossCounts = {}; // boss name -> count (weapons only)
  const tokenUsageStats = {
    weapon: { total: 0, used: 0 },
    armor: { total: 0, used: 0 },
    accessory: { total: 0, used: 0 }
  };

  // Process all wishlists
  for (const wl of allWishlists) {
    // Count items by name
    const allItems = [
      ...(wl.weapons || []),
      ...(wl.armor || []),
      ...(wl.accessories || [])
    ];

    for (const item of allItems) {
      const name = typeof item === 'string' ? item : item.name;
      itemCounts[name] = (itemCounts[name] || 0) + 1;
    }

    // Count boss popularity (weapons only)
    for (const weapon of (wl.weapons || [])) {
      if (typeof weapon === 'object' && weapon.boss) {
        bossCounts[weapon.boss] = (bossCounts[weapon.boss] || 0) + 1;
      }
    }

    // Token usage statistics
    ['weapon', 'armor', 'accessory'].forEach(tokenType => {
      const base = tokenType === 'weapon' ? 1 : tokenType === 'armor' ? 4 : 1;
      const grants = wl.tokenGrants?.[tokenType] || 0;
      const used = wl.tokensUsed?.[tokenType] || 0;

      tokenUsageStats[tokenType].total += (base + grants);
      tokenUsageStats[tokenType].used += used;
    });
  }

  // Sort items by popularity
  const sortedItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Sort bosses by popularity (weapons only)
  const sortedBosses = Object.entries(bossCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Build embed
  const embed = new EmbedBuilder()
    .setColor('#e67e22')
    .setTitle('📊 Guild Wishlist Statistics')
    .setDescription(`Data from **${allWishlists.length}** finalized wishlist(s)`)
    .setTimestamp();

  // Most wanted items
  if (sortedItems.length > 0) {
    const itemList = sortedItems.map(([item, count], index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${medal} **${item}** — ${count} user${count !== 1 ? 's' : ''}`;
    }).join('\n');

    embed.addFields({
      name: '🔥 Most Wanted Items (Top 10)',
      value: itemList,
      inline: false
    });
  }

  // Boss popularity (weapons only)
  if (sortedBosses.length > 0) {
    const bossList = sortedBosses.map(([boss, count], index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${medal} **${boss}** — ${count} weapon${count !== 1 ? 's' : ''}`;
    }).join('\n');

    embed.addFields({
      name: '💀 Boss Popularity (Weapons Only)',
      value: bossList,
      inline: false
    });
  } else {
    embed.addFields({
      name: '💀 Boss Popularity (Weapons Only)',
      value: 'No weapon selections with boss data yet.',
      inline: false
    });
  }

  // Token usage statistics
  const tokenStats = [];
  ['weapon', 'armor', 'accessory'].forEach(type => {
    const { total, used } = tokenUsageStats[type];
    const percentage = total > 0 ? ((used / total) * 100).toFixed(1) : '0.0';
    const icon = type === 'weapon' ? '⚔️' : type === 'armor' ? '🛡️' : '💍';
    tokenStats.push(`${icon} **${type.charAt(0).toUpperCase() + type.slice(1)}**: ${used}/${total} used (${percentage}%)`);
  });

  embed.addFields({
    name: '🎫 Token Usage',
    value: tokenStats.join('\n'),
    inline: false
  });

  // General stats
  const totalItems = Object.values(itemCounts).reduce((sum, count) => sum + count, 0);
  const uniqueItems = Object.keys(itemCounts).length;
  const avgItemsPerUser = (totalItems / allWishlists.length).toFixed(1);

  embed.addFields({
    name: '📈 General Statistics',
    value: 
      `• **Total Items Selected**: ${totalItems}\n` +
      `• **Unique Items**: ${uniqueItems}\n` +
      `• **Average Items per User**: ${avgItemsPerUser}\n` +
      `• **Most Contested Item**: ${sortedItems[0]?.[0] || 'N/A'} (${sortedItems[0]?.[1] || 0} users)`,
    inline: false
  });

  return interaction.editReply({ embeds: [embed] });
}

module.exports = { handleStats };