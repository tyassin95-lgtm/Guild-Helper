const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { PARTY_SIZE, RESERVE_PARTY_SIZE } = require('../constants');
const { getRoleEmoji } = require('../roleDetection');

async function handlePartyManageButtons({ interaction, collections }) {
  console.log('[MANAGE BUTTONS] Handler called for:', interaction.customId);

  const { partyPlayers, parties } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    console.log('[MANAGE BUTTONS] Permission denied');
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // Add member to party - NEW: Show persistent multi-select UI
  if (interaction.customId.startsWith('party_add_member:')) {
    console.log('[MANAGE BUTTONS] party_add_member - Deferring reply...');

    try {
      // CRITICAL: Defer immediately to prevent timeout - use reply for new message
      await interaction.deferReply({ flags: [64] });
      console.log('[MANAGE BUTTONS] Deferred successfully');
    } catch (err) {
      console.error('[MANAGE BUTTONS] Failed to defer:', err.message);
      return;
    }

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const partyNumber = isReserve ? null : parseInt(partyIdentifier);

    console.log('[MANAGE BUTTONS] Party identifier:', partyIdentifier, 'isReserve:', isReserve);

    const party = isReserve 
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber });

    const maxSize = isReserve ? RESERVE_PARTY_SIZE : PARTY_SIZE;
    const partyLabel = isReserve ? 'Reserve' : `Party ${partyNumber}`;

    if ((party?.members?.length || 0) >= maxSize) {
      console.log('[MANAGE BUTTONS] Party full');
      return interaction.editReply({ 
        content: `❌ ${partyLabel} is full (${maxSize}/${maxSize})!`
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

    console.log('[MANAGE BUTTONS] Found', allPlayers.length, 'available players');

    if (allPlayers.length === 0) {
      return interaction.editReply({ 
        content: '❌ No available players to add! All players with party info are already assigned.'
      });
    }

    // Sort by CP descending
    allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

    console.log('[MANAGE BUTTONS] Showing multi-select UI...');
    // Show first page of multi-select UI
    await showMultiSelectUI(interaction, allPlayers, 0, partyIdentifier, party, collections, true);
    console.log('[MANAGE BUTTONS] Multi-select UI shown');
  }

  // Handle page navigation for multi-select
  if (interaction.customId.startsWith('party_add_page:')) {
    console.log('[MANAGE BUTTONS] party_add_page - Deferring update...');

    try {
      // CRITICAL: Use deferUpdate for button interactions to update the existing message
      await interaction.deferUpdate();
      console.log('[MANAGE BUTTONS] Deferred update successfully');
    } catch (err) {
      console.error('[MANAGE BUTTONS] Failed to defer update:', err.message);
      return;
    }

    const [, partyIdentifier, pageStr] = interaction.customId.split(':');
    const page = parseInt(pageStr);
    const isReserve = partyIdentifier === 'reserve';

    console.log('[MANAGE BUTTONS] Navigating to page', page, 'for party', partyIdentifier);

    // Get party info
    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    // Get all available players again
    const allPlayers = await partyPlayers.find({ 
      guildId: interaction.guildId,
      weapon1: { $exists: true },
      weapon2: { $exists: true },
      partyNumber: { $exists: false },
      inReserve: { $ne: true }
    }).toArray();

    allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

    console.log('[MANAGE BUTTONS] Found', allPlayers.length, 'players, showing page', page);

    // Show the requested page (use false since we deferred update)
    await showMultiSelectUI(interaction, allPlayers, page, partyIdentifier, party, collections, false);
    console.log('[MANAGE BUTTONS] Page navigation complete');
  }

  // Handle "Add Selected" button
  if (interaction.customId.startsWith('party_confirm_add:')) {
    return interaction.reply({
      content: '⚠️ Please select players from the menu above, then click "Add Selected" again.',
      flags: [64]
    });
  }

  // Handle "Done" button
  if (interaction.customId.startsWith('party_done_managing:')) {
    return interaction.update({
      content: '✅ Party management complete!',
      embeds: [],
      components: []
    });
  }

  // Remove member from party
  if (interaction.customId.startsWith('party_remove_member:')) {
    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

    if (!party?.members || party.members.length === 0) {
      return interaction.reply({ 
        content: `❌ ${partyLabel} is empty!`, 
        flags: [64]
      });
    }

    const options = await Promise.all(party.members.map(async m => {
      const member = await interaction.guild.members.fetch(m.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown';
      const role = `${m.weapon1}/${m.weapon2}`;
      const cp = (m.cp || 0).toLocaleString();

      const leaderBadge = m.isLeader ? '👑 ' : '';

      return {
        label: `${leaderBadge}${displayName} - ${role}`,
        value: m.userId,
        description: `${cp} CP${m.isLeader ? ' • Party Leader' : ''}`
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_remove_player:${partyIdentifier}`)
        .setPlaceholder('Select player(s) to remove')
        .setMinValues(1)
        .setMaxValues(Math.min(options.length, 25))
        .addOptions(options)
    );

    return interaction.reply({ 
      content: `**Removing members from ${partyLabel}**\n\nSelect one or more players to remove:`, 
      components: [row],
      flags: [64]
    });
  }

  // Move member to another party
  if (interaction.customId.startsWith('party_move_member:')) {
    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

    if (!party?.members || party.members.length === 0) {
      return interaction.reply({ 
        content: `❌ ${partyLabel} is empty!`, 
        flags: [64]
      });
    }

    const options = await Promise.all(party.members.map(async m => {
      const member = await interaction.guild.members.fetch(m.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown';
      const role = `${m.weapon1}/${m.weapon2}`;
      const cp = (m.cp || 0).toLocaleString();

      const leaderBadge = m.isLeader ? '👑 ' : '';

      return {
        label: `${leaderBadge}${displayName} - ${role}`,
        value: m.userId,
        description: `${cp} CP${m.isLeader ? ' • Party Leader' : ''}`
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_move_player:${partyIdentifier}`)
        .setPlaceholder('Select a player to move')
        .addOptions(options)
    );

    return interaction.reply({ 
      content: `**Moving member from ${partyLabel}**\n\nSelect a player:`, 
      components: [row],
      flags: [64]
    });
  }

  // Set party leader
  if (interaction.customId.startsWith('party_set_leader:')) {
    console.log('[MANAGE BUTTONS] party_set_leader - Deferring update...');

    try {
      // CRITICAL: Use deferUpdate instead of deferReply to update the existing message
      await interaction.deferUpdate();
      console.log('[MANAGE BUTTONS] Deferred update successfully');
    } catch (err) {
      console.error('[MANAGE BUTTONS] Failed to defer update:', err.message);
      return;
    }

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

      const leaderBadge = m.isLeader ? '👑 ' : '';

      return {
        label: `${leaderBadge}${displayName} - ${role}`,
        value: m.userId,
        description: `${cp} CP${m.isLeader ? ' • Current Leader' : ''}`
      };
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_select_leader:${partyIdentifier}`)
        .setPlaceholder('Select new party leader')
        .addOptions(options)
    );

    console.log('[MANAGE BUTTONS] Sending set leader menu...');
    const result = await interaction.editReply({ 
      content: `**Setting party leader for ${partyLabel}**\n\nSelect a member:`, 
      components: [row]
    });
    console.log('[MANAGE BUTTONS] Set leader menu sent');
    return result;
  }
}

/**
 * Show multi-select UI for adding players to a party
 * @param {Interaction} interaction - Discord interaction
 * @param {Array} allPlayers - All available players
 * @param {number} page - Current page number
 * @param {string} partyIdentifier - Party identifier (number or 'reserve')
 * @param {Object} party - Party document from database
 * @param {Object} collections - Database collections
 * @param {boolean} useEditReply - If true, use editReply (after defer); if false, use update
 */
async function showMultiSelectUI(interaction, allPlayers, page, partyIdentifier, party, collections, useEditReply = false) {
  console.log('[SHOW UI] Called with page:', page, 'useEditReply:', useEditReply);

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

  console.log('[SHOW UI] Building embed...');

  // Build embed showing current party roster
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`📋 Managing ${partyLabel}`)
    .setDescription(`**Current Status:** ${currentSize}/${maxSize} members\n**Available Slots:** ${availableSlots}`)
    .setTimestamp();

  if (party?.members && party.members.length > 0) {
    const memberList = await Promise.all(party.members.map(async (m, index) => {
      const member = await interaction.guild.members.fetch(m.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown';
      const roleEmoji = getRoleEmoji(m.role);
      const cp = (m.cp || 0).toLocaleString();
      const leaderBadge = m.isLeader ? '👑 ' : '';

      return `${index + 1}. ${leaderBadge}${displayName} ${roleEmoji} ${m.weapon1}/${m.weapon2} • ${cp} CP`;
    }));

    embed.addFields({
      name: `Current Members (${party.members.length})`,
      value: memberList.join('\n'),
      inline: false
    });
  } else {
    embed.addFields({
      name: 'Current Members',
      value: '*No members yet*',
      inline: false
    });
  }

  console.log('[SHOW UI] Building player options...');

  // Build player options for current page
  const options = await Promise.all(playersOnPage.map(async p => {
    const member = await interaction.guild.members.fetch(p.userId).catch(() => null);
    const displayName = member ? member.displayName : 'Unknown';
    const roleEmoji = getRoleEmoji(p.role);
    const role = `${p.weapon1}/${p.weapon2}`;
    const cp = (p.cp || 0).toLocaleString();

    return {
      label: `${displayName} - ${role}`,
      value: p.userId,
      description: `${roleEmoji} ${cp} CP`,
      emoji: roleEmoji
    };
  }));

  const components = [];

  // Multi-select menu
  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`party_add_selected:${partyIdentifier}`)
      .setPlaceholder(`Select players to add (max ${Math.min(availableSlots, 25)})`)
      .setMinValues(0)
      .setMaxValues(Math.min(options.length, availableSlots, 25))
      .addOptions(options)
  );
  components.push(selectRow);

  // Pagination buttons if needed
  if (totalPages > 1) {
    const buttonRow = new ActionRowBuilder();

    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`party_add_page:${partyIdentifier}:${Math.max(0, page - 1)}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0)
    );

    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId('page_indicator')
        .setLabel(`Page ${page + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    buttonRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`party_add_page:${partyIdentifier}:${Math.min(totalPages - 1, page + 1)}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1)
    );

    components.push(buttonRow);
  }

  // Action buttons
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`party_remove_member:${partyIdentifier}`)
      .setLabel('Remove Members')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖')
      .setDisabled(currentSize === 0),
    new ButtonBuilder()
      .setCustomId(`party_move_member:${partyIdentifier}`)
      .setLabel('Move Member')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄')
      .setDisabled(currentSize === 0),
    new ButtonBuilder()
      .setCustomId(`party_set_leader:${partyIdentifier}`)
      .setLabel('Set Leader')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👑')
      .setDisabled(currentSize === 0),
    new ButtonBuilder()
      .setCustomId(`party_done_managing:${partyIdentifier}`)
      .setLabel('Done')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  );
  components.push(actionRow);

  const message = {
    content: `**Adding members to ${partyLabel}**\n\n` +
             `📊 Showing ${start + 1}-${Math.min(end, allPlayers.length)} of ${allPlayers.length} available players\n` +
             `💡 Select up to ${Math.min(availableSlots, 25)} players from the menu above, then they will be added automatically!`,
    embeds: [embed],
    components
  };

  console.log('[SHOW UI] Sending message with method:', useEditReply ? 'editReply' : 'update');

  try {
    if (useEditReply) {
      // After deferReply() or deferUpdate(), use editReply
      const result = await interaction.editReply(message);
      console.log('[SHOW UI] editReply successful');
      return result;
    } else {
      const result = await interaction.update(message);
      console.log('[SHOW UI] update successful');
      return result;
    }
  } catch (err) {
    console.error('[SHOW UI] Failed to send message:', err.message);
    throw err;
  }
}

module.exports = { handlePartyManageButtons };