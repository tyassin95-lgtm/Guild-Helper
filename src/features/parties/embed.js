const { EmbedBuilder } = require('discord.js');

async function createPlayerInfoEmbed(playerInfo, member, collections) {
  // Handle case where member might be null (DM context or fetch failure)
  const displayName = member?.displayName || 'Unknown User';
  const avatarURL = member?.user?.displayAvatarURL?.() || member?.displayAvatarURL?.() || null;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`${displayName}'s Party Info`)
    .setTimestamp();

  // Only set thumbnail if we have an avatar URL
  if (avatarURL) {
    embed.setThumbnail(avatarURL);
  }

  if (!playerInfo || !playerInfo.weapon1 || !playerInfo.weapon2) {
    embed.setDescription('❌ You haven\'t set up your party info yet!\n\nUse the buttons below to get started.');
    return embed;
  }

  // Check if in reserve
  if (playerInfo.inReserve && collections) {
    embed.setColor('#e67e22'); // Orange for reserve
    embed.setDescription('✅ Your party information is set up!\n\n⏳ **Status: In Reserve Pool**');

    embed.addFields(
      { name: '⚔️ Role', value: `${playerInfo.weapon1} / ${playerInfo.weapon2}`, inline: true },
      { name: '💪 Combat Power', value: `${(playerInfo.cp || 0).toLocaleString()}`, inline: true }
    );

    // Calculate reserve position
    const { partyPlayers } = collections;
    if (partyPlayers) {
      const allReserves = await partyPlayers.find({ 
        guildId: playerInfo.guildId, 
        inReserve: true 
      }).toArray();

      // Sort by priority
      const roleOrder = { tank: 0, healer: 1, dps: 2 };
      allReserves.sort((a, b) => {
        const roleDiff = roleOrder[a.role] - roleOrder[b.role];
        if (roleDiff !== 0) return roleDiff;
        const cpDiff = (b.cp || 0) - (a.cp || 0);
        if (cpDiff !== 0) return cpDiff;
        return new Date(a.reservedAt) - new Date(b.reservedAt);
      });

      const overallPosition = allReserves.findIndex(p => p.userId === playerInfo.userId) + 1;
      const roleReserves = allReserves.filter(p => p.role === playerInfo.role);
      const rolePosition = roleReserves.findIndex(p => p.userId === playerInfo.userId) + 1;

      const timeSinceReserve = Date.now() - new Date(playerInfo.reservedAt).getTime();
      const hours = Math.floor(timeSinceReserve / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);

      let timeString;
      if (days > 0) {
        timeString = `${days} day${days > 1 ? 's' : ''} ago`;
      } else if (hours > 0) {
        timeString = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        timeString = 'recently';
      }

      embed.addFields({
        name: '📊 Reserve Position',
        value: 
          `• **Role:** ${playerInfo.role.toUpperCase()} (#${rolePosition} of ${roleReserves.length})\n` +
          `• **Overall:** #${overallPosition} of ${allReserves.length}\n` +
          `• **In reserve since:** ${timeString}`,
        inline: false
      });

      embed.addFields({
        name: 'ℹ️ How to Get Promoted',
        value:
          '• Increase your CP to be more competitive\n' +
          '• Wait for rebalancing (every 72 hours)\n' +
          '• Wait for a slot to open in active parties\n\n' +
          'You will be automatically notified when promoted!',
        inline: false
      });
    }

    return embed;
  }

  // Active player
  embed.setDescription('✅ Your party information is set up!');
  embed.addFields(
    { name: '⚔️ Role', value: `${playerInfo.weapon1} / ${playerInfo.weapon2}`, inline: true },
    { name: '💪 Combat Power', value: `${(playerInfo.cp || 0).toLocaleString()}`, inline: true }
  );

  if (playerInfo.partyNumber) {
    embed.addFields({ name: '👥 Assigned Party', value: `Party ${playerInfo.partyNumber}`, inline: true });
  }

  return embed;
}

function createPartiesOverviewEmbed(parties, guild) {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📋 Static Parties Overview')
    .setTimestamp();

  if (!parties || parties.length === 0) {
    embed.setDescription('No parties have been created yet.');
    return embed;
  }

  for (const party of parties) {
    const members = party.members || [];

    if (members.length === 0) {
      embed.addFields({
        name: `Party ${party.partyNumber} (0/6)`,
        value: '*Empty*',
        inline: false
      });
      continue;
    }

    const memberList = members.map(m => {
      const role = m.weapon1 && m.weapon2 ? `${m.weapon1}/${m.weapon2}` : 'No role';
      const cp = m.cp ? m.cp.toLocaleString() : '0';
      return `• <@${m.userId}> - ${role} - ${cp} CP`;
    }).join('\n');

    embed.addFields({
      name: `Party ${party.partyNumber} (${members.length}/6)`,
      value: memberList,
      inline: false
    });
  }

  return embed;
}

module.exports = { createPlayerInfoEmbed, createPartiesOverviewEmbed };