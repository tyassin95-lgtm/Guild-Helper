const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

async function handleLeaderboard({ interaction, collections }) {
  const type = interaction.options?.getString('type') || 'balance';

  await interaction.deferReply();

  const guildId = interaction.guildId;
  const { gamblingBalances } = collections;

  try {
    let topUsers;
    let title;
    let description = '';
    let sortField;
    let valueFormatter;
    let valueLabel;

    // Determine which leaderboard to show
    switch (type) {
      case 'balance':
        sortField = { balance: -1 };
        title = '🏆 Balance Leaderboard';
        valueFormatter = (user) => `${user.balance.toLocaleString()} coins`;
        valueLabel = 'Balance';
        break;

      case 'profit':
        sortField = null; // Custom sort
        title = '📈 Net Profit Leaderboard';
        valueFormatter = (user) => {
          const netProfit = user.totalWon - user.totalLost;
          const sign = netProfit >= 0 ? '+' : '';
          return `${sign}${netProfit.toLocaleString()} coins`;
        };
        valueLabel = 'Net Profit';
        break;

      case 'wins':
        sortField = { totalWon: -1 };
        title = '✅ Total Winnings Leaderboard';
        valueFormatter = (user) => `${user.totalWon.toLocaleString()} coins`;
        valueLabel = 'Total Won';
        break;

      case 'games':
        sortField = { gamesPlayed: -1 };
        title = '🎰 Most Active Gamblers';
        valueFormatter = (user) => `${user.gamesPlayed.toLocaleString()} games`;
        valueLabel = 'Games Played';
        break;

      default:
        sortField = { balance: -1 };
        title = '🏆 Balance Leaderboard';
        valueFormatter = (user) => `${user.balance.toLocaleString()} coins`;
        valueLabel = 'Balance';
    }

    // Fetch top users
    if (type === 'profit') {
      // For profit, we need to calculate it, so fetch all and sort manually
      const allUsers = await gamblingBalances.find({ guildId }).toArray();
      topUsers = allUsers
        .map(user => ({
          ...user,
          netProfit: user.totalWon - user.totalLost
        }))
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, 10);
    } else {
      topUsers = await gamblingBalances
        .find({ guildId })
        .sort(sortField)
        .limit(10)
        .toArray();
    }

    if (topUsers.length === 0) {
      return interaction.editReply({
        content: '📊 No one has started gambling yet! Be the first with `/gamblingbalance`.'
      });
    }

    // Get guild for member lookups
    const guild = interaction.guild;

    // Build leaderboard
    const medals = ['🥇', '🥈', '🥉'];

    for (let i = 0; i < topUsers.length; i++) {
      const userData = topUsers[i];
      const rank = i + 1;
      const medal = rank <= 3 ? medals[rank - 1] : `**${rank}.**`;

      // Get display name
      let displayName = 'Unknown User';
      try {
        const member = await guild.members.fetch(userData.userId);
        displayName = member.displayName || member.user.username;

        // Truncate long names
        if (displayName.length > 20) {
          displayName = displayName.substring(0, 17) + '...';
        }
      } catch (err) {
        displayName = `User ${userData.userId.slice(0, 8)}`;
      }

      const value = valueFormatter(userData);

      // Create progress bar
      let maxValue;
      if (type === 'balance') {
        maxValue = topUsers[0].balance;
      } else if (type === 'profit') {
        maxValue = Math.abs(topUsers[0].netProfit);
      } else if (type === 'wins') {
        maxValue = topUsers[0].totalWon;
      } else if (type === 'games') {
        maxValue = topUsers[0].gamesPlayed;
      }

      const currentValue = type === 'balance' ? userData.balance :
                          type === 'profit' ? Math.abs(userData.netProfit) :
                          type === 'wins' ? userData.totalWon :
                          userData.gamesPlayed;

      const barLength = maxValue > 0 ? Math.max(1, Math.floor((currentValue / maxValue) * 18)) : 1;
      const bar = '█'.repeat(barLength) + '░'.repeat(18 - barLength);

      // Build entry
      description += `${medal} **${displayName}**\n`;
      description += `💎 ${value}\n`;
      description += `\`${bar}\`\n`;

      // Add extra spacing between entries
      if (i < topUsers.length - 1) {
        description += '\n';
      }
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0xFFD700) // Gold
      .setTitle(title)
      .setDescription(description)
      .setFooter({ 
        text: `${guild.name} • Showing top ${topUsers.length} players` 
      })
      .setTimestamp();

    // Add thumbnail
    if (guild.iconURL()) {
      embed.setThumbnail(guild.iconURL());
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Leaderboard error:', error);
    await interaction.editReply({
      content: '❌ Failed to fetch leaderboard. Please try again later.'
    });
  }
}

module.exports = { handleLeaderboard };