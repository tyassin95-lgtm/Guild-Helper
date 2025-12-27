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

async function handlePartyManageButtons({ interaction, collections }) {
  console.log('[MANAGE BUTTONS] Handler called for:', interaction.customId);

  const { partyPlayers, parties } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // =========================
  // ADD MEMBERS (initial open)
  // =========================
  if (interaction.customId.startsWith('party_add_member:')) {
    await interaction.deferReply({ flags: [64] });

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const partyNumber = isReserve ? null : parseInt(partyIdentifier);

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber });

    const maxSize = isReserve ? RESERVE_PARTY_SIZE : PARTY_SIZE;

    if ((party?.members?.length || 0) >= maxSize) {
      return interaction.editReply({
        content: `❌ ${isReserve ? 'Reserve' : `Party ${partyNumber}`} is full!`
      });
    }

    const allPlayers = await partyPlayers.find({
      guildId: interaction.guildId,
      weapon1: { $exists: true },
      weapon2: { $exists: true },
      partyNumber: { $exists: false },
      inReserve: { $ne: true }
    }).toArray();

    allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

    return showMultiSelectUI(
      interaction,
      allPlayers,
      0,
      partyIdentifier,
      party,
      collections,
      true // editReply is correct here
    );
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

    return showMultiSelectUI(
      interaction,
      allPlayers,
      page,
      partyIdentifier,
      party,
      collections,
      false
    );
  }

  // =========================
  // SET PARTY LEADER - FIXED
  // =========================
  if (interaction.customId.startsWith('party_set_leader:')) {
    await interaction.deferUpdate();

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    if (!party?.members?.length) {
      return interaction.editReply({
        content: '❌ Party is empty!',
        components: []
      });
    }

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

    return interaction.editReply({
      content: `**Setting party leader for ${isReserve ? 'Reserve' : `Party ${partyIdentifier}`}**`,
      components: [row]
    });
  }
}

/**
 * MULTI-SELECT UI RENDERER
 */
async function showMultiSelectUI(
  interaction,
  allPlayers,
  page,
  partyIdentifier,
  party,
  collections,
  useEditReply
) {
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

  components.push(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_add_selected:${partyIdentifier}`)
        .setPlaceholder(`Select players to add (max ${availableSlots})`)
        .setMinValues(0)
        .setMaxValues(Math.min(availableSlots, options.length, 25))
        .addOptions(options)
    )
  );

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

  const payload = {
    content: `📊 Showing ${start + 1}-${Math.min(end, allPlayers.length)} of ${allPlayers.length} players`,
    embeds: [embed],
    components
  };

  return useEditReply
    ? interaction.editReply(payload)
    : interaction.update(payload);
}

module.exports = { handlePartyManageButtons };