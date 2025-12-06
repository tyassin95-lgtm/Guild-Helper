const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { PARTY_SIZE, RESERVE_PARTY_SIZE } = require('../constants');

async function handlePartyManageButtons({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // Add member to party
  if (interaction.customId.startsWith('party_add_member:')) {
    // CRITICAL: Defer immediately to prevent timeout
    await interaction.deferUpdate();

    try {
      const partyIdentifier = interaction.customId.split(':')[1];
      const isReserve = partyIdentifier === 'reserve';
      const partyNumber = isReserve ? null : parseInt(partyIdentifier);

      const party = isReserve 
        ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
        : await parties.findOne({ guildId: interaction.guildId, partyNumber });

      const maxSize = isReserve ? RESERVE_PARTY_SIZE : PARTY_SIZE;
      const partyLabel = isReserve ? 'Reserve' : `Party ${partyNumber}`;

      if ((party?.members?.length || 0) >= maxSize) {
        return interaction.editReply({ 
          content: `❌ ${partyLabel} is full (${maxSize}/${maxSize})!`, 
          components: [] 
        });
      }

      // Get all players with info who are NOT in ANY party
      const allPlayers = await partyPlayers.find({ 
        guildId: interaction.guildId,
        weapon1: { $exists: true },
        weapon2: { $exists: true },
        partyNumber: { $exists: false },
        inReserve: { $ne: true }
      }).toArray();

      if (allPlayers.length === 0) {
        return interaction.editReply({ 
          content: '❌ No available players to add! All players with party info are already assigned.', 
          components: [] 
        });
      }

      // Sort by CP descending
      allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

      // Pagination: Show 25 players per page
      const pageSize = 25;
      const totalPages = Math.ceil(allPlayers.length / pageSize);

      // Show first page
      await showPlayerPage(interaction, allPlayers, 0, partyIdentifier, totalPages, collections);
    } catch (err) {
      console.error('Error in party_add_member:', err);
      return interaction.editReply({ 
        content: '❌ Failed to load players. Please try again.', 
        components: [] 
      });
    }
  }

  // Handle page navigation
  if (interaction.customId.startsWith('party_add_page:')) {
    // CRITICAL: Defer FIRST before any async operations
    await interaction.deferUpdate();

    try {
      const [, , partyIdentifier, pageStr] = interaction.customId.split(':');
      const page = parseInt(pageStr);

      // Get all available players again
      const allPlayers = await partyPlayers.find({ 
        guildId: interaction.guildId,
        weapon1: { $exists: true },
        weapon2: { $exists: true },
        partyNumber: { $exists: false },
        inReserve: { $ne: true }
      }).toArray();

      allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

      const pageSize = 25;
      const totalPages = Math.ceil(allPlayers.length / pageSize);

      await showPlayerPage(interaction, allPlayers, page, partyIdentifier, totalPages, collections);
    } catch (err) {
      console.error('Error in page navigation:', err);
      return interaction.editReply({ 
        content: '❌ Failed to load page. Please try again.', 
        components: [] 
      });
    }
  }

  // Remove member from party
  if (interaction.customId.startsWith('party_remove_member:')) {
    await interaction.deferUpdate();

    try {
      const partyIdentifier = interaction.customId.split(':')[1];
      const isReserve = partyIdentifier === 'reserve';

      const party = isReserve
        ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
        : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

      const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

      if (!party?.members || party.members.length === 0) {
        return interaction.editReply({ 
          content: `❌ ${partyLabel} is empty!`, 
          components: [] 
        });
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
          .setCustomId(`party_remove_player:${partyIdentifier}`)
          .setPlaceholder('Select a player to remove')
          .addOptions(options)
      );

      return interaction.editReply({ 
        content: `Removing member from ${partyLabel}:`, 
        components: [row] 
      });
    } catch (err) {
      console.error('Error in party_remove_member:', err);
      return interaction.editReply({ 
        content: '❌ Failed to load members. Please try again.', 
        components: [] 
      });
    }
  }

  // Move member to another party
  if (interaction.customId.startsWith('party_move_member:')) {
    await interaction.deferUpdate();

    try {
      const partyIdentifier = interaction.customId.split(':')[1];
      const isReserve = partyIdentifier === 'reserve';

      const party = isReserve
        ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
        : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

      const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

      if (!party?.members || party.members.length === 0) {
        return interaction.editReply({ 
          content: `❌ ${partyLabel} is empty!`, 
          components: [] 
        });
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
          .setCustomId(`party_move_player:${partyIdentifier}`)
          .setPlaceholder('Select a player to move')
          .addOptions(options)
      );

      return interaction.editReply({ 
        content: `Moving member from ${partyLabel}:`, 
        components: [row] 
      });
    } catch (err) {
      console.error('Error in party_move_member:', err);
      return interaction.editReply({ 
        content: '❌ Failed to load members. Please try again.', 
        components: [] 
      });
    }
  }
}

/**
 * Show a page of players for selection
 */
async function showPlayerPage(interaction, allPlayers, page, partyIdentifier, totalPages, collections) {
  const pageSize = 25;
  const start = page * pageSize;
  const end = start + pageSize;
  const playersOnPage = allPlayers.slice(start, end);

  const isReserve = partyIdentifier === 'reserve';
  const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

  const options = await Promise.all(playersOnPage.map(async p => {
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

  const components = [];

  // Add select menu
  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`party_add_player:${partyIdentifier}`)
      .setPlaceholder('Select a player to add')
      .addOptions(options)
  );
  components.push(selectRow);

  // Add pagination buttons if needed
  if (totalPages > 1) {
    const buttonRow = new ActionRowBuilder();

    // Previous button
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`party_add_page:${partyIdentifier}:${Math.max(0, page - 1)}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0)
    );

    // Page indicator
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId('page_indicator')
        .setLabel(`Page ${page + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    // Next button
    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`party_add_page:${partyIdentifier}:${Math.min(totalPages - 1, page + 1)}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === totalPages - 1)
    );

    components.push(buttonRow);
  }

  const message = `Adding member to ${partyLabel}:\n\n**${allPlayers.length}** total available player(s) | Showing ${start + 1}-${Math.min(end, allPlayers.length)}`;

  return interaction.editReply({ content: message, components });
}

module.exports = { handlePartyManageButtons };