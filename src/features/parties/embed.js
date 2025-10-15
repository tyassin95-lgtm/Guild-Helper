const { EmbedBuilder } = require('discord.js');

function createPlayerInfoEmbed(playerInfo, member) {
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