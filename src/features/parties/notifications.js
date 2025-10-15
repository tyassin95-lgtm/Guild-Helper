const { EmbedBuilder } = require('discord.js');
const { getRoleDisplayName, getRoleEmoji } = require('./roleDetection');

/**
 * Send DM when player is initially assigned to a party
 */
async function sendPartyAssignmentDM(userId, partyNumber, role, client, collections) {
  const { parties, partyPlayers } = collections;

  // FIX: Get the player's guildId first
  const player = await partyPlayers.findOne({ userId });
  if (!player || !player.guildId) {
    console.error(`Cannot send assignment DM: Player ${userId} not found or missing guildId`);
    return;
  }

  // FIX: Include guildId in the query to get the correct party
  const party = await parties.findOne({ 
    guildId: player.guildId, 
    partyNumber 
  });

  if (!party) {
    console.error(`Cannot send assignment DM: Party ${partyNumber} not found in guild ${player.guildId}`);
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
async function sendPartyChangeDM(userId, fromParty, toParty, reason, client, collections) {
  const { parties, partyPlayers } = collections;

  const user = await client.users.fetch(userId);
  if (!user) return;

  const player = await partyPlayers.findOne({ userId });
  if (!player || !player.guildId) {
    console.error(`Cannot send change DM: Player ${userId} not found or missing guildId`);
    return;
  }

  // FIX: Include guildId in the query
  const party = await parties.findOne({ 
    guildId: player.guildId, 
    partyNumber: toParty 
  });

  if (!party) {
    console.error(`Cannot send change DM: Party ${toParty} not found in guild ${player.guildId}`);
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
async function sendRoleChangeDM(userId, partyNumber, oldRole, newRole, client, collections) {
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
  shouldNotifyUser,
  updateLastNotified
};