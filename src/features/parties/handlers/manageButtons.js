const { ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { PARTY_SIZE } = require('../constants');

async function handlePartyManageButtons({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // Add member to party
  if (interaction.customId.startsWith('party_add_member:')) {
    const partyNumber = parseInt(interaction.customId.split(':')[1]);

    const party = await parties.findOne({ guildId: interaction.guildId, partyNumber });

    if ((party.members?.length || 0) >= PARTY_SIZE) {
      return interaction.update({ content: `❌ Party ${partyNumber} is full (${PARTY_SIZE}/${PARTY_SIZE})!`, components: [] });
    }

    // Get all players with info who are not in this party
    const allPlayers = await partyPlayers.find({ 
      guildId: interaction.guildId,
      weapon1: { $exists: true },
      weapon2: { $exists: true }
    }).toArray();

    const currentMemberIds = new Set((party.members || []).map(m => m.userId));
    const availablePlayers = allPlayers.filter(p => !currentMemberIds.has(p.userId));

    if (availablePlayers.length === 0) {
      return interaction.update({ content: '❌ No available players to add! All players with party info are already in this party.', components: [] });
    }

    // Sort by CP descending
    availablePlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

    const options = await Promise.all(availablePlayers.slice(0, 25).map(async p => {
      const member = await interaction.guild.members.fetch(p.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown';
      const role = `${p.weapon1}/${p.weapon2}`;
      const cp = (p.cp || 0).toLocaleString();
      const partyStatus = p.partyNumber ? ` [P${p.partyNumber}]` : '';

      return {
        label: `${displayName} - ${role}`,
        value: p.userId,
        description: `${cp} CP${partyStatus}`
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_add_player:${partyNumber}`)
        .setPlaceholder('Select a player to add')
        .addOptions(options)
    );

    return interaction.update({ content: `Adding member to Party ${partyNumber}:`, components: [row] });
  }

  // Remove member from party
  if (interaction.customId.startsWith('party_remove_member:')) {
    const partyNumber = parseInt(interaction.customId.split(':')[1]);

    const party = await parties.findOne({ guildId: interaction.guildId, partyNumber });

    if (!party.members || party.members.length === 0) {
      return interaction.update({ content: `❌ Party ${partyNumber} is empty!`, components: [] });
    }

    const options = await Promise.all(party.members.map(async m => {
      const member = await interaction.guild.members.fetch(m.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown';
      const role = `${m.weapon1}/${m.weapon2}`;
      const cp = (m.cp || 0).toLocaleString();

      return {
        label: `${displayName} - ${role}`,
        value: m.userId,
        description: `${cp} CP`
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_remove_player:${partyNumber}`)
        .setPlaceholder('Select a player to remove')
        .addOptions(options)
    );

    return interaction.update({ content: `Removing member from Party ${partyNumber}:`, components: [row] });
  }

  // Move member to another party
  if (interaction.customId.startsWith('party_move_member:')) {
    const partyNumber = parseInt(interaction.customId.split(':')[1]);

    const party = await parties.findOne({ guildId: interaction.guildId, partyNumber });

    if (!party.members || party.members.length === 0) {
      return interaction.update({ content: `❌ Party ${partyNumber} is empty!`, components: [] });
    }

    const options = await Promise.all(party.members.map(async m => {
      const member = await interaction.guild.members.fetch(m.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown';
      const role = `${m.weapon1}/${m.weapon2}`;
      const cp = (m.cp || 0).toLocaleString();

      return {
        label: `${displayName} - ${role}`,
        value: m.userId,
        description: `${cp} CP`
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_move_player:${partyNumber}`)
        .setPlaceholder('Select a player to move')
        .addOptions(options)
    );

    return interaction.update({ content: `Moving member from Party ${partyNumber}:`, components: [row] });
  }
}

module.exports = { handlePartyManageButtons };