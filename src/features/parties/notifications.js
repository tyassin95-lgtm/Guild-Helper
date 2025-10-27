const { EmbedBuilder } = require('discord.js');
const { getRoleDisplayName, getRoleEmoji } = require('./roleDetection');

/**
 * Send DM when player is initially assigned to a party
 */
async function sendPartyAssignmentDM(userId, partyNumber, role, guildId, client, collections) {
  const { parties, partyPlayers } = collections;

  // Get the player's data for THIS guild
  const player = await partyPlayers.findOne({ userId, guildId });
  if (!player) {
    console.error(`Cannot send assignment DM: Player ${userId} not found in guild ${guildId}`);
    return;
  }

  // Include guildId in the party query
  const party = await parties.findOne({ 
    guildId, 
    partyNumber 
  });

  if (!party) {
    console.error(`Cannot send assignment DM: Party ${partyNumber} not found in guild ${guildId}`);
    return;
  }

  const user = await client.users.fetch(userId);
  if (!user) return;

  const members = party.members || [];
  const totalCP = party.totalCP || 0;
  const avgCP = members.length > 0 ? Math.round(totalCP / members.length) : 0;

  // Build member list by role
  const tanks = members.filter(m => m.role === 'tank');
  const healers = members.filter(m => m.role === 'healer');
  const dps = members.filter(m => m.role === 'dps');

  const buildRoleList = async (roleMembers, roleIcon) => {
    if (roleMembers.length === 0) return '*None*';

    const names = await Promise.all(roleMembers.map(async m => {
      if (m.userId === userId) return 'You';
      try {
        const member = await client.users.fetch(m.userId);
        return member.username;
      } catch {
        return 'Unknown';
      }
    }));

    return names.map(name => `• ${name}`).join('\n');
  };

  const tankList = await buildRoleList(tanks, '🛡️');
  const healerList = await buildRoleList(healers, '💚');
  const dpsList = await buildRoleList(dps, '⚔️');

  const embed = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle('🎉 Party Assignment!')
    .setDescription(`You've been assigned to **Party ${partyNumber}**!`)
    .addFields(
      { 
        name: 'Your Role', 
        value: `${getRoleEmoji(role)} ${getRoleDisplayName(role)}`, 
        inline: true 
      },
      { 
        name: 'Party Size', 
        value: `${members.length}/6`, 
        inline: true 
      },
      { 
        name: 'Average CP', 
        value: avgCP.toLocaleString(), 
        inline: true 
      },
      {
        name: '🛡️ Tanks',
        value: tankList,
        inline: true
      },
      {
        name: '💚 Healers',
        value: healerList,
        inline: true
      },
      {
        name: '⚔️ DPS',
        value: dpsList,
        inline: true
      }
    )
    .setFooter({ text: 'Good luck on your adventures!' })
    .setTimestamp();

  try {
    await user.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Cannot send DM to ${userId}:`, err.message);
  }
}

/**
 * Send DM when player is moved to a different party
 */
async function sendPartyChangeDM(userId, fromParty, toParty, reason, guildId, client, collections) {
  const { parties, partyPlayers } = collections;

  const user = await client.users.fetch(userId);
  if (!user) return;

  const player = await partyPlayers.findOne({ userId, guildId });
  if (!player) {
    console.error(`Cannot send change DM: Player ${userId} not found in guild ${guildId}`);
    return;
  }

  // Include guildId in the query
  const party = await parties.findOne({ 
    guildId, 
    partyNumber: toParty 
  });

  if (!party) {
    console.error(`Cannot send change DM: Party ${toParty} not found in guild ${guildId}`);
    return;
  }

  const members = party.members || [];
  const totalCP = party.totalCP || 0;
  const avgCP = members.length > 0 ? Math.round(totalCP / members.length) : 0;

  // Build member list
  const tanks = members.filter(m => m.role === 'tank');
  const healers = members.filter(m => m.role === 'healer');
  const dps = members.filter(m => m.role === 'dps');

  const buildRoleList = async (roleMembers) => {
    if (roleMembers.length === 0) return '*None*';

    const names = await Promise.all(roleMembers.map(async m => {
      if (m.userId === userId) return 'You';
      try {
        const member = await client.users.fetch(m.userId);
        return member.username;
      } catch {
        return 'Unknown';
      }
    }));

    return names.map(name => `• ${name}`).join('\n');
  };

  const tankList = await buildRoleList(tanks);
  const healerList = await buildRoleList(healers);
  const dpsList = await buildRoleList(dps);

  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('🔄 Party Update!')
    .setDescription(`You've been moved from **Party ${fromParty}** to **Party ${toParty}**`)
    .addFields(
      { 
        name: 'Reason', 
        value: reason, 
        inline: false 
      },
      { 
        name: 'Your Role', 
        value: `${getRoleEmoji(player.role)} ${getRoleDisplayName(player.role)}`, 
        inline: true 
      },
      { 
        name: 'Party Size', 
        value: `${members.length}/6`, 
        inline: true 
      },
      { 
        name: 'Average CP', 
        value: avgCP.toLocaleString(), 
        inline: true 
      },
      {
        name: '🛡️ Tanks',
        value: tankList,
        inline: true
      },
      {
        name: '💚 Healers',
        value: healerList,
        inline: true
      },
      {
        name: '⚔️ DPS',
        value: dpsList,
        inline: true
      }
    )
    .setFooter({ text: 'Your new party composition' })
    .setTimestamp();

  try {
    await user.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Cannot send DM to ${userId}:`, err.message);
  }
}

/**
 * Send DM when player's role changes
 */
async function sendRoleChangeDM(userId, partyNumber, oldRole, newRole, guildId, client, collections) {
  const user = await client.users.fetch(userId);
  if (!user) return;

  const embed = new EmbedBuilder()
    .setColor('#e67e22')
    .setTitle('⚠️ Role Changed!')
    .setDescription('Your role has changed due to a weapon update.')
    .addFields(
      { 
        name: 'Old Role', 
        value: `${getRoleEmoji(oldRole)} ${getRoleDisplayName(oldRole)}`, 
        inline: true 
      },
      { 
        name: 'New Role', 
        value: `${getRoleEmoji(newRole)} ${getRoleDisplayName(newRole)}`, 
        inline: true 
      },
      {
        name: 'Party',
        value: `You remain in Party ${partyNumber}`,
        inline: false
      }
    )
    .setFooter({ text: 'Your position may be adjusted in future rebalancing' })
    .setTimestamp();

  try {
    await user.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Cannot send DM to ${userId}:`, err.message);
  }
}

/**
 * Send DM when player is promoted from reserve to active party
 */
async function sendReservePromotionDM(userId, partyNumber, role, guildId, client, collections) {
  const { parties } = collections;

  const user = await client.users.fetch(userId);
  if (!user) return;

  const party = await parties.findOne({ guildId, partyNumber });
  if (!party) return;

  const members = party.members || [];
  const totalCP = party.totalCP || 0;
  const avgCP = members.length > 0 ? Math.round(totalCP / members.length) : 0;

  // Build member list
  const tanks = members.filter(m => m.role === 'tank');
  const healers = members.filter(m => m.role === 'healer');
  const dps = members.filter(m => m.role === 'dps');

  const buildRoleList = async (roleMembers) => {
    if (roleMembers.length === 0) return '*None*';

    const names = await Promise.all(roleMembers.map(async m => {
      if (m.userId === userId) return 'You';
      try {
        const member = await client.users.fetch(m.userId);
        return member.username;
      } catch {
        return 'Unknown';
      }
    }));

    return names.map(name => `• ${name}`).join('\n');
  };

  const tankList = await buildRoleList(tanks);
  const healerList = await buildRoleList(healers);
  const dpsList = await buildRoleList(dps);

  const embed = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle('🎉 Promoted from Reserve!')
    .setDescription(`Great news! You've been assigned to **Party ${partyNumber}**!`)
    .addFields(
      { 
        name: 'Your Role', 
        value: `${getRoleEmoji(role)} ${getRoleDisplayName(role)}`, 
        inline: true 
      },
      { 
        name: 'Party Size', 
        value: `${members.length}/6`, 
        inline: true 
      },
      { 
        name: 'Average CP', 
        value: avgCP.toLocaleString(), 
        inline: true 
      },
      {
        name: '🛡️ Tanks',
        value: tankList,
        inline: true
      },
      {
        name: '💚 Healers',
        value: healerList,
        inline: true
      },
      {
        name: '⚔️ DPS',
        value: dpsList,
        inline: true
      }
    )
    .setFooter({ text: 'Good luck on your adventures!' })
    .setTimestamp();

  try {
    await user.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Cannot send DM to ${userId}:`, err.message);
  }
}

/**
 * Send DM when player is demoted from active party to reserve
 */
async function sendReserveDemotionDM(userId, fromParty, guildId, client, collections) {
  const { partyPlayers } = collections;

  const user = await client.users.fetch(userId);
  if (!user) return;

  const player = await partyPlayers.findOne({ userId, guildId });
  if (!player) return;

  // Get reserve position
  const allReserves = await partyPlayers.find({ 
    guildId, 
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

  const overallPosition = allReserves.findIndex(p => p.userId === userId) + 1;
  const roleReserves = allReserves.filter(p => p.role === player.role);
  const rolePosition = roleReserves.findIndex(p => p.userId === userId) + 1;

  const embed = new EmbedBuilder()
    .setColor('#e67e22')
    .setTitle('⏸️ Moved to Reserve Pool')
    .setDescription(
      fromParty 
        ? `You have been moved from **Party ${fromParty}** to the reserve pool.\n\n**Reason:** ${player.reserveReason || 'Party restructuring'}`
        : `You have been placed in the reserve pool.\n\n**Reason:** ${player.reserveReason || 'Party limit reached'}`
    )
    .addFields(
      {
        name: 'Your Info',
        value: 
          `• **Role:** ${getRoleEmoji(player.role)} ${getRoleDisplayName(player.role)} (${player.weapon1}/${player.weapon2})\n` +
          `• **CP:** ${(player.cp || 0).toLocaleString()}\n` +
          `• **Reserve Position:** #${overallPosition} of ${allReserves.length} overall\n` +
          `• **Role Position:** #${rolePosition} of ${roleReserves.length} ${getRoleDisplayName(player.role)}s`,
        inline: false
      },
      {
        name: 'How to Get Promoted',
        value:
          '• Increase your CP to be more competitive\n' +
          '• Wait for rebalancing (every 72 hours)\n' +
          '• Wait for a slot to open in active parties\n\n' +
          'You will be automatically notified when promoted!',
        inline: false
      }
    )
    .setFooter({ text: 'Tip: Update your CP using /myinfo to improve your ranking!' })
    .setTimestamp();

  try {
    await user.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Cannot send DM to ${userId}:`, err.message);
  }
}

/**
 * Check if user was notified recently (anti-spam)
 */
async function shouldNotifyUser(userId, guildId, collections) {
  const { partyPlayers } = collections;
  const NOTIFICATION_COOLDOWN_MS = 30 * 1000; // 30 seconds

  const player = await partyPlayers.findOne({ userId, guildId });
  if (!player || !player.lastNotified) return true;

  const timeSinceLastNotification = Date.now() - new Date(player.lastNotified).getTime();
  return timeSinceLastNotification >= NOTIFICATION_COOLDOWN_MS;
}

/**
 * Update last notification time
 */
async function updateLastNotified(userId, guildId, collections) {
  const { partyPlayers } = collections;

  await partyPlayers.updateOne(
    { userId, guildId },
    { $set: { lastNotified: new Date() } }
  );
}

module.exports = {
  sendPartyAssignmentDM,
  sendPartyChangeDM,
  sendRoleChangeDM,
  sendReservePromotionDM,
  sendReserveDemotionDM,
  shouldNotifyUser,
  updateLastNotified
};