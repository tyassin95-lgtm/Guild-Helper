const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

async function handlePlayerList({ interaction, collections }) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const { partyPlayers, parties } = collections;

  // Get all players with info
  const allPlayers = await partyPlayers.find({ guildId: interaction.guildId }).toArray();

  if (allPlayers.length === 0) {
    return interaction.reply({ content: '❌ No players have set up their party info yet.', flags: [64] });
  }

  // Get all parties to check assignments
  const allParties = await parties.find({ guildId: interaction.guildId }).toArray();
  const assignedUserIds = new Set();

  for (const party of allParties) {
    for (const member of party.members || []) {
      assignedUserIds.add(member.userId);
    }
  }

  // Separate assigned and unassigned players
  const assigned = [];
  const unassigned = [];

  for (const player of allPlayers) {
    if (assignedUserIds.has(player.userId)) {
      assigned.push(player);
    } else {
      unassigned.push(player);
    }
  }

  // Sort by CP descending
  const sortByCP = (a, b) => (b.cp || 0) - (a.cp || 0);
  assigned.sort(sortByCP);
  unassigned.sort(sortByCP);

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📊 Player List')
    .setDescription(`Total players: **${allPlayers.length}** | Assigned: **${assigned.length}** | Unassigned: **${unassigned.length}**`)
    .setTimestamp();

  // Add unassigned players
  if (unassigned.length > 0) {
    const unassignedList = unassigned.map(p => {
      const role = p.weapon1 && p.weapon2 ? `${p.weapon1}/${p.weapon2}` : 'No role';
      const cp = (p.cp || 0).toLocaleString();
      return `• <@${p.userId}> - ${role} - ${cp} CP`;
    }).join('\n');

    const truncated = unassignedList.length > 1024 ? unassignedList.substring(0, 1021) + '...' : unassignedList;
    embed.addFields({
      name: `🔓 Unassigned Players (${unassigned.length})`,
      value: truncated,
      inline: false
    });
  }

  // Add assigned players
  if (assigned.length > 0) {
    const assignedList = assigned.map(p => {
      const role = p.weapon1 && p.weapon2 ? `${p.weapon1}/${p.weapon2}` : 'No role';
      const cp = (p.cp || 0).toLocaleString();

      // Find which party they're in
      let partyNum = '?';
      for (const party of allParties) {
        if (party.members?.some(m => m.userId === p.userId)) {
          partyNum = party.partyNumber;
          break;
        }
      }

      return `• <@${p.userId}> - ${role} - ${cp} CP - Party ${partyNum}`;
    }).join('\n');

    const truncated = assignedList.length > 1024 ? assignedList.substring(0, 1021) + '...' : assignedList;
    embed.addFields({
      name: `✅ Assigned Players (${assigned.length})`,
      value: truncated,
      inline: false
    });
  }

  return interaction.reply({ embeds: [embed], flags: [64] });
}

module.exports = { handlePlayerList };