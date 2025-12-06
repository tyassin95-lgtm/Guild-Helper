const { EmbedBuilder } = require('discord.js');
const { RESERVE_PARTY_SIZE } = require('./constants');

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
    embed.setColor('#FFA500'); // Orange for reserve
    embed.setDescription('✅ Your party information is set up!\n\n📦 **Status: In Reserve Party**');

    embed.addFields(
      { name: '⚔️ Role', value: `${playerInfo.weapon1} / ${playerInfo.weapon2}`, inline: true },
      { name: '💪 Combat Power', value: `${(playerInfo.cp || 0).toLocaleString()}`, inline: true }
    );

    // Calculate reserve position
    const { partyPlayers, parties } = collections;
    if (partyPlayers && parties) {
      const reserveParty = await parties.findOne({ 
        guildId: playerInfo.guildId, 
        isReserve: true 
      });

      if (reserveParty && reserveParty.members) {
        // Sort by CP descending to find position
        const sortedMembers = [...reserveParty.members].sort((a, b) => (b.cp || 0) - (a.cp || 0));
        const overallPosition = sortedMembers.findIndex(p => p.userId === playerInfo.userId) + 1;

        // Role-specific position
        const roleMembers = sortedMembers.filter(p => p.role === playerInfo.role);
        const rolePosition = roleMembers.findIndex(p => p.userId === playerInfo.userId) + 1;

        const memberInfo = reserveParty.members.find(m => m.userId === playerInfo.userId);
        const timeSinceAdded = memberInfo?.addedAt ? Date.now() - new Date(memberInfo.addedAt).getTime() : 0;
        const hours = Math.floor(timeSinceAdded / (1000 * 60 * 60));
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
            `• **Role:** ${playerInfo.role.toUpperCase()} (#${rolePosition} of ${roleMembers.length})\n` +
            `• **Overall:** #${overallPosition} of ${sortedMembers.length}\n` +
            `• **Added to reserve:** ${timeString}`,
          inline: false
        });

        embed.addFields({
          name: 'ℹ️ About Reserve',
          value:
            '• Reserve members are standby for active parties\n' +
            '• You may be promoted when slots open\n' +
            '• Keep your CP updated to stay competitive\n\n' +
            'You will be notified if promoted to an active party!',
          inline: false
        });
      }
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

  // Separate regular parties and reserve
  const regularParties = parties.filter(p => !p.isReserve);
  const reserveParty = parties.find(p => p.isReserve);

  // Add regular parties
  for (const party of regularParties) {
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

  // Add reserve party at the end if it exists
  if (reserveParty) {
    const members = reserveParty.members || [];

    if (members.length === 0) {
      embed.addFields({
        name: `📦 Reserve Party (0/${RESERVE_PARTY_SIZE})`,
        value: '*No reserve members*',
        inline: false
      });
    } else {
      // Sort reserve by CP descending
      const sortedMembers = [...members].sort((a, b) => (b.cp || 0) - (a.cp || 0));

      const memberList = sortedMembers.slice(0, 10).map(m => {
        const role = m.weapon1 && m.weapon2 ? `${m.weapon1}/${m.weapon2}` : 'No role';
        const cp = m.cp ? m.cp.toLocaleString() : '0';
        return `• <@${m.userId}> - ${role} - ${cp} CP`;
      }).join('\n');

      const displayText = members.length > 10 
        ? `${memberList}\n*...and ${members.length - 10} more*`
        : memberList;

      embed.addFields({
        name: `📦 Reserve Party (${members.length}/${RESERVE_PARTY_SIZE})`,
        value: displayText,
        inline: false
      });
    }
  }

  return embed;
}

module.exports = { createPlayerInfoEmbed, createPartiesOverviewEmbed };