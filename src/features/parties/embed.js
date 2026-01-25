const { EmbedBuilder } = require('discord.js');
const { RESERVE_PARTY_SIZE } = require('./constants');

async function createPlayerInfoEmbed(playerInfo, member, collections, pendingChanges = null) {
  const displayName = member?.displayName || 'Unknown User';
  const avatarURL = member?.user?.displayAvatarURL?.() || member?.displayAvatarURL?.() || null;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`${displayName}'s Party Info`)
    .setTimestamp();

  if (avatarURL) {
    embed.setThumbnail(avatarURL);
  }

  const hasInfo = playerInfo && playerInfo.weapon1 && playerInfo.weapon2;
  const hasPending = pendingChanges && pendingChanges.changes && Object.keys(pendingChanges.changes).length > 0;

  if (!hasInfo && !hasPending) {
    embed.setDescription('❌ You haven\'t set up your party info yet!\n\nUse the buttons below to get started.');
    return embed;
  }

  let description = '';

  if (hasPending && !pendingChanges.gearCheckComplete) {
    description += '⚠️ **Gear Check Required** - Complete gear check to submit changes\n\n';
  } else if (hasPending && pendingChanges.gearCheckComplete) {
    description += '✅ **Ready to Submit** - All changes ready for submission\n\n';
  } else if (hasInfo) {
    description += '✅ Your party information is set up!\n\n';
  }

  if (playerInfo?.inReserve && collections) {
    embed.setColor('#FFA500');
    description += '📦 **Status: In Reserve Party**\n\n';
  }

  embed.setDescription(description);

  const currentWeapon1 = playerInfo?.weapon1 || 'Not set';
  const currentWeapon2 = playerInfo?.weapon2 || 'Not set';
  const currentCP = playerInfo?.cp || 0;

  const pendingWeapon1 = pendingChanges?.changes?.weapon1;
  const pendingWeapon2 = pendingChanges?.changes?.weapon2;
  const pendingCP = pendingChanges?.changes?.cp;

  let weapon1Display = currentWeapon1;
  let weapon2Display = currentWeapon2;
  let cpDisplay = currentCP.toLocaleString();

  if (hasPending) {
    if (pendingWeapon1) {
      weapon1Display = `~~${currentWeapon1}~~ → **${pendingWeapon1}**`;
    }
    if (pendingWeapon2) {
      weapon2Display = `~~${currentWeapon2}~~ → **${pendingWeapon2}**`;
    }
    if (pendingCP !== undefined) {
      cpDisplay = `~~${currentCP.toLocaleString()}~~ → **${pendingCP.toLocaleString()}**`;
    }
  }

  embed.addFields(
    { 
      name: '⚔️ Primary Weapon', 
      value: weapon1Display, 
      inline: true 
    },
    { 
      name: '🗡️ Secondary Weapon', 
      value: weapon2Display, 
      inline: true 
    },
    { 
      name: '💪 Combat Power', 
      value: cpDisplay, 
      inline: true 
    }
  );

  if (playerInfo?.gearScreenshotUrl) {
    embed.addFields({
      name: '📸 Gear Screenshot',
      value: `[View Gear](${playerInfo.gearScreenshotUrl})`,
      inline: true
    });
  } else {
    embed.addFields({
      name: '📸 Gear Screenshot',
      value: '❌ Not uploaded',
      inline: true
    });
  }

  if (playerInfo?.inReserve && collections) {
    const { partyPlayers, parties } = collections;
    if (partyPlayers && parties) {
      const reserveParty = await parties.findOne({ 
        guildId: playerInfo.guildId, 
        isReserve: true 
      });

      if (reserveParty && reserveParty.members) {
        const sortedMembers = [...reserveParty.members].sort((a, b) => (b.cp || 0) - (a.cp || 0));
        const overallPosition = sortedMembers.findIndex(p => p.userId === playerInfo.userId) + 1;

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

  if (playerInfo?.partyNumber) {
    embed.addFields({ 
      name: '👥 Assigned Party', 
      value: `Party ${playerInfo.partyNumber}`, 
      inline: false 
    });
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

  const regularParties = parties.filter(p => !p.isReserve);
  const reserveParty = parties.find(p => p.isReserve);

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
      const leaderCrown = m.isLeader ? '👑 ' : '';
      return `• ${leaderCrown}<@${m.userId}> - ${role} - ${cp} CP${m.isLeader ? ' • Leader' : ''}`;
    }).join('\n');

    embed.addFields({
      name: `Party ${party.partyNumber} (${members.length}/6)`,
      value: memberList,
      inline: false
    });
  }

  if (reserveParty) {
    const members = reserveParty.members || [];

    if (members.length === 0) {
      embed.addFields({
        name: `📦 Reserve Party (0/${RESERVE_PARTY_SIZE})`,
        value: '*No reserve members*',
        inline: false
      });
    } else {
      const sortedMembers = [...members].sort((a, b) => (b.cp || 0) - (a.cp || 0));

      const memberList = sortedMembers.slice(0, 10).map(m => {
        const role = m.weapon1 && m.weapon2 ? `${m.weapon1}/${m.weapon2}` : 'No role';
        const cp = m.cp ? m.cp.toLocaleString() : '0';
        const leaderCrown = m.isLeader ? '👑 ' : '';
        return `• ${leaderCrown}<@${m.userId}> - ${role} - ${cp} CP${m.isLeader ? ' • Leader' : ''}`;
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