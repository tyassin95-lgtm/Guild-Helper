const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const { PARTY_SIZE, RESERVE_PARTY_SIZE } = require('../constants');
const { getRoleEmoji } = require('../roleDetection');
const { updatePlayerRole } = require('../roleDetection');

async function handlePartyManageButtons({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

  // Permission check
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // =========================
  // ADD MEMBERS
  // =========================
  if (interaction.customId.startsWith('party_add_member:')) {
    await interaction.deferReply({ flags: [64] });

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const maxSize = isReserve ? RESERVE_PARTY_SIZE : PARTY_SIZE;
    const currentSize = party?.members?.length || 0;

    if (currentSize >= maxSize) {
      return interaction.editReply({
        content: `❌ ${isReserve ? 'Reserve' : `Party ${partyIdentifier}`} is full!`
      });
    }

    // Get available players
    const allPlayers = await partyPlayers.find({
      guildId: interaction.guildId,
      weapon1: { $exists: true },
      weapon2: { $exists: true },
      partyNumber: { $exists: false },
      inReserve: { $ne: true }
    }).toArray();

    if (allPlayers.length === 0) {
      return interaction.editReply({
        content: '❌ No available players to add. All players are already assigned to parties.'
      });
    }

    allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

    return showAddMembersUI(interaction, allPlayers, 0, partyIdentifier, party, collections, true);
  }

  // =========================
  // REMOVE MEMBERS
  // =========================
  if (interaction.customId.startsWith('party_remove_member:')) {
    await interaction.deferReply({ flags: [64] });

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    if (!party || !party.members || party.members.length === 0) {
      return interaction.editReply({
        content: `❌ ${isReserve ? 'Reserve' : `Party ${partyIdentifier}`} has no members to remove.`
      });
    }

    // Build member options
    const options = await Promise.all(party.members.map(async m => {
      const member = await interaction.guild.members.fetch(m.userId).catch(() => null);
      return {
        label: `${member?.displayName || 'Unknown'} - ${m.weapon1}/${m.weapon2}`,
        value: m.userId,
        description: `${getRoleEmoji(m.role)} ${(m.cp || 0).toLocaleString()} CP`,
        emoji: getRoleEmoji(m.role)
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_remove_player:${partyIdentifier}`)
        .setPlaceholder('Select members to remove')
        .setMinValues(1)
        .setMaxValues(Math.min(options.length, 25))
        .addOptions(options)
    );

    return interaction.editReply({
      content: `**Removing members from ${isReserve ? 'Reserve' : `Party ${partyIdentifier}`}**\n\nSelect members to remove:`,
      components: [row]
    });
  }

  // =========================
  // MOVE MEMBER
  // =========================
  if (interaction.customId.startsWith('party_move_member:')) {
    await interaction.deferReply({ flags: [64] });

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    if (!party || !party.members || party.members.length === 0) {
      return interaction.editReply({
        content: `❌ ${isReserve ? 'Reserve' : `Party ${partyIdentifier}`} has no members to move.`
      });
    }

    // Build member options
    const options = await Promise.all(party.members.map(async m => {
      const member = await interaction.guild.members.fetch(m.userId).catch(() => null);
      return {
        label: `${member?.displayName || 'Unknown'} - ${m.weapon1}/${m.weapon2}`,
        value: m.userId,
        description: `${getRoleEmoji(m.role)} ${(m.cp || 0).toLocaleString()} CP`,
        emoji: getRoleEmoji(m.role)
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_move_player:${partyIdentifier}`)
        .setPlaceholder('Select member to move')
        .addOptions(options)
    );

    return interaction.editReply({
      content: `**Moving member from ${isReserve ? 'Reserve' : `Party ${partyIdentifier}`}**\n\nSelect a member:`,
      components: [row]
    });
  }

  // =========================
  // SET LEADER
  // =========================
  if (interaction.customId.startsWith('party_set_leader:')) {
    // When clicked from Add Members UI, interaction may already be in a deferred state
    // We need to update the existing message, not create a new reply
    const shouldUpdate = interaction.message && interaction.message.components && 
                         interaction.message.components.length > 0;

    if (!shouldUpdate) {
      await interaction.deferReply({ flags: [64] });
    } else {
      await interaction.deferUpdate();
    }

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    if (!party || !party.members || party.members.length === 0) {
      const response = {
        content: `❌ ${isReserve ? 'Reserve' : `Party ${partyIdentifier}`} has no members.`,
        components: []
      };
      return shouldUpdate ? interaction.editReply(response) : interaction.editReply(response);
    }

    // Build member options
    const options = await Promise.all(party.members.map(async m => {
      const member = await interaction.guild.members.fetch(m.userId).catch(() => null);
      return {
        label: `${m.isLeader ? '👑 ' : ''}${member?.displayName || 'Unknown'}`,
        value: m.userId,
        description: `${m.weapon1}/${m.weapon2} • ${(m.cp || 0).toLocaleString()} CP`
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_select_leader:${partyIdentifier}`)
        .setPlaceholder('Select new party leader')
        .addOptions(options)
    );

    const response = {
      content: `**Setting party leader for ${isReserve ? 'Reserve' : `Party ${partyIdentifier}`}**\n\nSelect the new leader:`,
      components: [row]
    };

    return interaction.editReply(response);
  }

  // =========================
  // PAGINATION
  // =========================
  if (interaction.customId.startsWith('party_add_page:')) {
    await interaction.deferUpdate();

    const [, partyIdentifier, pageStr] = interaction.customId.split(':');
    const page = parseInt(pageStr);
    const isReserve = partyIdentifier === 'reserve';

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const allPlayers = await partyPlayers.find({
      guildId: interaction.guildId,
      weapon1: { $exists: true },
      weapon2: { $exists: true },
      partyNumber: { $exists: false },
      inReserve: { $ne: true }
    }).toArray();

    allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

    return showAddMembersUI(interaction, allPlayers, page, partyIdentifier, party, collections, false);
  }

  // =========================
  // DONE MANAGING
  // =========================
  if (interaction.customId.startsWith('party_done_managing:')) {
    await interaction.deferUpdate();

    return interaction.editReply({
      content: '✅ Party management complete!',
      embeds: [],
      components: []
    });
  }
}

/**
 * Show the add members UI with pagination
 */
async function showAddMembersUI(interaction, allPlayers, page, partyIdentifier, party, collections, useEditReply) {
  const pageSize = 25;
  const totalPages = Math.ceil(allPlayers.length / pageSize);
  const start = page * pageSize;
  const end = start + pageSize;
  const playersOnPage = allPlayers.slice(start, end);

  const isReserve = partyIdentifier === 'reserve';
  const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;
  const maxSize = isReserve ? RESERVE_PARTY_SIZE : PARTY_SIZE;
  const currentSize = party?.members?.length || 0;
  const availableSlots = maxSize - currentSize;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`📋 Managing ${partyLabel}`)
    .setDescription(`**${currentSize}/${maxSize} members** • **${availableSlots} slots available**`);

  const options = await Promise.all(playersOnPage.map(async p => {
    const member = await interaction.guild.members.fetch(p.userId).catch(() => null);
    return {
      label: `${member?.displayName || 'Unknown'} - ${p.weapon1}/${p.weapon2}`,
      value: p.userId,
      description: `${getRoleEmoji(p.role)} ${(p.cp || 0).toLocaleString()} CP`,
      emoji: getRoleEmoji(p.role)
    };
  }));

  const components = [];

  // Multi-select menu
  components.push(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_add_selected:${partyIdentifier}`)
        .setPlaceholder(`Select players to add (max ${Math.min(availableSlots, 25)})`)
        .setMinValues(0)
        .setMaxValues(Math.min(availableSlots, options.length, 25))
        .addOptions(options)
    )
  );

  // Pagination buttons
  if (totalPages > 1) {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`party_add_page:${partyIdentifier}:${page - 1}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('page_indicator')
          .setLabel(`Page ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`party_add_page:${partyIdentifier}:${page + 1}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      )
    );
  }

  // Action buttons
  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party_remove_member:${partyIdentifier}`)
        .setLabel('Remove Members')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('➖'),
      new ButtonBuilder()
        .setCustomId(`party_move_member:${partyIdentifier}`)
        .setLabel('Move Member')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId(`party_set_leader:${partyIdentifier}`)
        .setLabel('Set Leader')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👑'),
      new ButtonBuilder()
        .setCustomId(`party_done_managing:${partyIdentifier}`)
        .setLabel('Done')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    )
  );

  const payload = {
    content: `📊 Showing ${start + 1}-${Math.min(end, allPlayers.length)} of ${allPlayers.length} available players`,
    embeds: [embed],
    components
  };

  return useEditReply
    ? interaction.editReply(payload)
    : interaction.update(payload);
}

module.exports = { handlePartyManageButtons };