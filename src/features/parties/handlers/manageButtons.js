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

    // Get all players with info who are NOT in ANY party
    const allPlayers = await partyPlayers.find({ 
      guildId: interaction.guildId,
      weapon1: { $exists: true },
      weapon2: { $exists: true },
      partyNumber: { $exists: false } // Only players not in a party
    }).toArray();

    if (allPlayers.length === 0) {
      return interaction.update({ content: '❌ No available players to add! All players with party info are already assigned to parties.', components: [] });
    }

    // Sort by CP descending
    allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

    // Limit to 25 options (Discord limit)
    const playersToShow = allPlayers.slice(0, 25);

    const options = await Promise.all(playersToShow.map(async p => {
      const member = await interaction.guild.members.fetch(p.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown';
      const role = `${p.weapon1}/${p.weapon2}`;
      const cp = (p.cp || 0).toLocaleString();

      return {
        label: `${displayName} - ${role}`,
        value: p.userId,
        description: `${cp} CP`
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_add_player:${partyNumber}`)
        .setPlaceholder('Select a player to add')
        .addOptions(options)
    );

    let message = `Adding member to Party ${partyNumber}:`;
    if (allPlayers.length > 25) {
      message += `\n\n⚠️ Showing top 25 by CP (${allPlayers.length - 25} more available)`;
    }

    return interaction.update({ content: message, components: [row] });
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