const { 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits, 
  EmbedBuilder 
} = require('discord.js');
const { createPlayerInfoEmbed, createPartiesOverviewEmbed } = require('../embed');
const { PARTY_SIZE, RESERVE_PARTY_SIZE } = require('../constants');
const { updatePlayerRole, getRoleEmoji } = require('../roleDetection');
const { updateGuildRoster } = require('../commands/guildroster');

async function handlePartySelects({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

  // =========================
  // WEAPON SELECTION (supports DMs)
  // =========================
  if (interaction.customId === 'party_select_weapon1' || interaction.customId === 'party_select_weapon2') {
    await interaction.deferUpdate();

    const isWeapon1 = interaction.customId === 'party_select_weapon1';
    const weapon = interaction.values[0];

    // Get guild context (supports DM)
    let guildId = interaction.guildId;
    let guild = interaction.guild;

    if (!guildId) {
      const { dmContexts } = collections;
      const context = await dmContexts.findOne({ 
        userId: interaction.user.id,
        expiresAt: { $gt: new Date() }
      });

      if (!context) {
        return interaction.editReply({ 
          content: '❌ This DM link has expired (24 hours). Please use `/myinfo` in the server.', 
          embeds: [], 
          components: [] 
        });
      }

      guildId = context.guildId;
      guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
    }

    try {
      const playerBefore = await partyPlayers.findOne({
        userId: interaction.user.id,
        guildId: guildId
      });

      const oldRole = playerBefore?.role;

      // Update weapon
      await partyPlayers.updateOne(
        { userId: interaction.user.id, guildId: guildId },
        { $set: { [isWeapon1 ? 'weapon1' : 'weapon2']: weapon, updatedAt: new Date() } },
        { upsert: true }
      );

      const playerInfo = await partyPlayers.findOne({
        userId: interaction.user.id,
        guildId: guildId
      });

      // Update role if both weapons are set
      if (playerInfo.weapon1 && playerInfo.weapon2) {
        const newRole = await updatePlayerRole(
          interaction.user.id,
          guildId,
          playerInfo.weapon1,
          playerInfo.weapon2,
          collections
        );

        // If in a party and role changed, update party composition
        if (oldRole && newRole !== oldRole) {
          const partyQuery = playerInfo.inReserve
            ? { guildId, isReserve: true, 'members.userId': interaction.user.id }
            : { guildId, partyNumber: playerInfo.partyNumber, 'members.userId': interaction.user.id };

          await parties.updateOne(
            partyQuery,
            {
              $set: { 
                'members.$.role': newRole,
                'members.$.weapon1': playerInfo.weapon1,
                'members.$.weapon2': playerInfo.weapon2
              },
              $inc: {
                [`roleComposition.${oldRole}`]: -1,
                [`roleComposition.${newRole}`]: 1
              }
            }
          );
        }
      }

      // Fetch member for embed
      let member = interaction.member;
      if (!member && guild) {
        member = await guild.members.fetch(interaction.user.id).catch(() => ({
          displayName: interaction.user.username,
          user: interaction.user
        }));
      }

      const embed = await createPlayerInfoEmbed(playerInfo, member, collections);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('party_set_weapon1')
          .setLabel('Set Primary Weapon')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚔️'),
        new ButtonBuilder()
          .setCustomId('party_set_weapon2')
          .setLabel('Set Secondary Weapon')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🗡️'),
        new ButtonBuilder()
          .setCustomId('party_set_cp')
          .setLabel('Set Combat Power')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💪')
      );

      // Update guild roster if it exists
      if (guild) {
        const { guildRosters } = collections;
        const rosterRecord = await guildRosters.findOne({ guildId: guild.id });
        if (rosterRecord && rosterRecord.channelId) {
          updateGuildRoster(guild, rosterRecord.channelId, collections).catch(err => {
            console.error('Error auto-updating guild roster:', err);
          });
        }
      }

      return interaction.editReply({
        content: `✅ ${isWeapon1 ? 'Primary' : 'Secondary'} weapon set to **${weapon}**!`,
        embeds: [embed],
        components: [row]
      });
    } catch (err) {
      console.error('Error in weapon select:', err);
      return interaction.editReply({
        content: '❌ An error occurred while updating your weapon. Please try again.',
        embeds: [],
        components: []
      });
    }
  }

  // All other handlers require guild context
  if (!interaction.guildId) {
    return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
  }

  // Permission check for admin actions
  const requiresAdmin = [
    'party_add_selected:',
    'party_manage_select',
    'party_remove_player:',
    'party_move_player:',
    'party_move_destination:',
    'party_delete_confirm',
    'party_select_leader:'
  ];

  if (requiresAdmin.some(prefix => interaction.customId.startsWith(prefix))) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }
  }

  // =========================
  // ADD SELECTED PLAYERS
  // =========================
  if (interaction.customId.startsWith('party_add_selected:')) {
    await interaction.deferUpdate();

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const userIds = interaction.values;

    if (userIds.length === 0) {
      return interaction.editReply({
        content: '⚠️ No players selected.',
        components: []
      });
    }

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const maxSize = isReserve ? RESERVE_PARTY_SIZE : PARTY_SIZE;
    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;
    const currentSize = party?.members?.length || 0;
    const availableSlots = maxSize - currentSize;

    if (userIds.length > availableSlots) {
      return interaction.editReply({
        content: `❌ Cannot add ${userIds.length} players! Only ${availableSlots} slot(s) available.`,
        components: []
      });
    }

    // Process players
    const addedPlayers = [];
    const failedPlayers = [];

    for (const userId of userIds) {
      const playerInfo = await partyPlayers.findOne({ userId, guildId: interaction.guildId });

      if (!playerInfo || !playerInfo.weapon1 || !playerInfo.weapon2) {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        failedPlayers.push(member?.displayName || userId);
        continue;
      }

      // Ensure player has role
      if (!playerInfo.role) {
        await updatePlayerRole(userId, interaction.guildId, playerInfo.weapon1, playerInfo.weapon2, collections);
        const updatedPlayer = await partyPlayers.findOne({ userId, guildId: interaction.guildId });
        playerInfo.role = updatedPlayer.role;
      }

      const updateQuery = isReserve
        ? { guildId: interaction.guildId, isReserve: true }
        : { guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) };

      await parties.updateOne(
        updateQuery,
        { 
          $push: { 
            members: {
              userId: playerInfo.userId,
              weapon1: playerInfo.weapon1,
              weapon2: playerInfo.weapon2,
              cp: playerInfo.cp || 0,
              role: playerInfo.role,
              addedAt: new Date()
            }
          },
          $inc: {
            totalCP: (playerInfo.cp || 0),
            [`roleComposition.${playerInfo.role}`]: 1
          }
        }
      );

      const playerUpdate = isReserve
        ? { $set: { inReserve: true }, $unset: { partyNumber: '' } }
        : { $set: { partyNumber: parseInt(partyIdentifier) }, $unset: { inReserve: '' } };

      await partyPlayers.updateOne(
        { userId, guildId: interaction.guildId },
        playerUpdate
      );

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      addedPlayers.push(member?.displayName || userId);
    }

    // Build success message
    let message = `✅ Added **${addedPlayers.length}** player(s) to ${partyLabel}`;
    if (failedPlayers.length > 0) {
      message += `\n⚠️ Failed to add **${failedPlayers.length}** (incomplete info)`;
    }

    // Get updated party info to show in continuation UI
    const updatedParty = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const newCurrentSize = updatedParty?.members?.length || 0;
    const newAvailableSlots = maxSize - newCurrentSize;

    // Check if we should continue showing UI
    if (newAvailableSlots === 0) {
      return interaction.editReply({
        content: `🎉 **${partyLabel} is now full!**\n\n${message}`,
        components: []
      });
    }

    // Get remaining available players
    const allPlayers = await partyPlayers.find({ 
      guildId: interaction.guildId,
      weapon1: { $exists: true },
      weapon2: { $exists: true },
      partyNumber: { $exists: false },
      inReserve: { $ne: true }
    }).toArray();

    if (allPlayers.length === 0) {
      return interaction.editReply({
        content: `✅ **All available players assigned!**\n\n${message}`,
        components: []
      });
    }

    allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

    // Continue showing add UI
    return showAddMembersUI(interaction, allPlayers, 0, partyIdentifier, updatedParty, collections, message);
  }

  // =========================
  // MANAGE PARTY SELECT
  // =========================
  if (interaction.customId === 'party_manage_select') {
    const partyIdentifier = interaction.values[0];
    const isReserve = partyIdentifier === 'reserve';
    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party_add_member:${partyIdentifier}`)
        .setLabel('Add Members')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId(`party_remove_member:${partyIdentifier}`)
        .setLabel('Remove Members')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('➖')
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party_move_member:${partyIdentifier}`)
        .setLabel('Move Member')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId(`party_set_leader:${partyIdentifier}`)
        .setLabel('Set Leader')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👑')
    );

    return interaction.update({ 
      content: `**Managing ${partyLabel}**\n\nChoose an action:`, 
      components: [row1, row2] 
    });
  }

  // =========================
  // REMOVE PLAYERS
  // =========================
  if (interaction.customId.startsWith('party_remove_player:')) {
    await interaction.deferUpdate();

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const userIds = interaction.values;

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;
    const removedPlayers = [];

    for (const userId of userIds) {
      const member = party.members?.find(m => m.userId === userId);

      if (member) {
        const updateQuery = isReserve
          ? { guildId: interaction.guildId, isReserve: true }
          : { guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) };

        await parties.updateOne(
          updateQuery,
          { 
            $pull: { members: { userId } },
            $inc: {
              totalCP: -(member.cp || 0),
              [`roleComposition.${member.role}`]: -1
            }
          }
        );

        await partyPlayers.updateOne(
          { userId, guildId: interaction.guildId },
          { $unset: { partyNumber: '', inReserve: '' } }
        );

        const guildMember = await interaction.guild.members.fetch(userId).catch(() => null);
        removedPlayers.push(guildMember?.displayName || userId);
      }
    }

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

    return interaction.editReply({ 
      content: `✅ Removed **${removedPlayers.length}** player(s) from ${partyLabel}`, 
      embeds: [embed], 
      components: [] 
    });
  }

  // =========================
  // MOVE PLAYER (SELECT MEMBER)
  // =========================
  if (interaction.customId.startsWith('party_move_player:')) {
    const [, fromIdentifier] = interaction.customId.split(':');
    const userId = interaction.values[0];
    const isFromReserve = fromIdentifier === 'reserve';

    const otherParties = await parties.find({ 
      guildId: interaction.guildId,
      ...(isFromReserve 
        ? { isReserve: { $ne: true } }
        : { $or: [{ isReserve: true }, { partyNumber: { $ne: parseInt(fromIdentifier) } }] }
      )
    }).sort({ isReserve: 1, partyNumber: 1 }).toArray();

    if (otherParties.length === 0) {
      return interaction.update({ content: '❌ No other parties exist to move to!', components: [] });
    }

    const options = otherParties.map(p => {
      if (p.isReserve) {
        return {
          label: `Reserve Party (${p.members?.length || 0}/${RESERVE_PARTY_SIZE})`,
          value: 'reserve',
          description: (p.members?.length || 0) >= RESERVE_PARTY_SIZE ? 'FULL' : 'Available',
          emoji: '📦'
        };
      }
      return {
        label: `Party ${p.partyNumber} (${p.members?.length || 0}/6)`,
        value: p.partyNumber.toString(),
        description: (p.members?.length || 0) >= PARTY_SIZE ? 'FULL' : 'Available'
      };
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`party_move_destination:${fromIdentifier}:${userId}`)
        .setPlaceholder('Select destination party')
        .addOptions(options)
    );

    return interaction.update({ content: 'Select destination party:', components: [row] });
  }

  // =========================
  // MOVE PLAYER (SELECT DESTINATION)
  // =========================
  if (interaction.customId.startsWith('party_move_destination:')) {
    await interaction.deferUpdate();

    const [, fromIdentifier, userId] = interaction.customId.split(':');
    const toIdentifier = interaction.values[0];

    const isFromReserve = fromIdentifier === 'reserve';
    const isToReserve = toIdentifier === 'reserve';

    const destParty = isToReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(toIdentifier) });

    const maxSize = isToReserve ? RESERVE_PARTY_SIZE : PARTY_SIZE;
    const toLabel = isToReserve ? 'Reserve' : `Party ${toIdentifier}`;

    if ((destParty.members?.length || 0) >= maxSize) {
      return interaction.editReply({ 
        content: `❌ ${toLabel} is full!`, 
        components: [] 
      });
    }

    const sourceParty = isFromReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(fromIdentifier) });

    const memberToMove = sourceParty.members?.find(m => m.userId === userId);

    if (!memberToMove) {
      return interaction.editReply({ content: '❌ Member not found!', components: [] });
    }

    const fromLabel = isFromReserve ? 'Reserve' : `Party ${fromIdentifier}`;

    // Remove from source
    const sourceQuery = isFromReserve
      ? { guildId: interaction.guildId, isReserve: true }
      : { guildId: interaction.guildId, partyNumber: parseInt(fromIdentifier) };

    await parties.updateOne(
      sourceQuery,
      { 
        $pull: { members: { userId } },
        $inc: {
          totalCP: -(memberToMove.cp || 0),
          [`roleComposition.${memberToMove.role}`]: -1
        }
      }
    );

    // Add to destination
    const destQuery = isToReserve
      ? { guildId: interaction.guildId, isReserve: true }
      : { guildId: interaction.guildId, partyNumber: parseInt(toIdentifier) };

    await parties.updateOne(
      destQuery,
      { 
        $push: { members: { ...memberToMove, addedAt: new Date() } },
        $inc: {
          totalCP: (memberToMove.cp || 0),
          [`roleComposition.${memberToMove.role}`]: 1
        }
      }
    );

    // Update player record
    const playerUpdate = isToReserve
      ? { $set: { inReserve: true }, $unset: { partyNumber: '' } }
      : { $set: { partyNumber: parseInt(toIdentifier) }, $unset: { inReserve: '' } };

    await partyPlayers.updateOne(
      { userId, guildId: interaction.guildId },
      playerUpdate
    );

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

    return interaction.editReply({ 
      content: `✅ Moved <@${userId}> from ${fromLabel} to ${toLabel}!`, 
      embeds: [embed], 
      components: [] 
    });
  }

  // =========================
  // DELETE PARTY
  // =========================
  if (interaction.customId === 'party_delete_confirm') {
    await interaction.deferUpdate();

    const partyIdentifier = interaction.values[0];
    const isReserve = partyIdentifier === 'reserve';

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

    if (party && party.members && party.members.length > 0) {
      const userIds = party.members.map(m => m.userId);
      await partyPlayers.updateMany(
        { userId: { $in: userIds }, guildId: interaction.guildId },
        { $unset: { partyNumber: '', inReserve: '' } }
      );
    }

    const deleteQuery = isReserve
      ? { guildId: interaction.guildId, isReserve: true }
      : { guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) };

    await parties.deleteOne(deleteQuery);

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

    return interaction.editReply({ 
      content: `✅ ${partyLabel} has been deleted!`, 
      embeds: [embed], 
      components: [] 
    });
  }

  // =========================
  // SET PARTY LEADER
  // =========================
  if (interaction.customId.startsWith('party_select_leader:')) {
    await interaction.deferUpdate();

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const newLeaderId = interaction.values[0];

    const updateQuery = isReserve
      ? { guildId: interaction.guildId, isReserve: true }
      : { guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) };

    const party = await parties.findOne(updateQuery);
    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

    if (!party) {
      return interaction.editReply({ content: '❌ Party not found!', components: [] });
    }

    // Remove leader status from all members
    await parties.updateOne(
      updateQuery,
      { $set: { 'members.$[].isLeader': false } }
    );

    // Set new leader
    await parties.updateOne(
      { ...updateQuery, 'members.userId': newLeaderId },
      { $set: { 'members.$.isLeader': true } }
    );

    // Update player record
    await partyPlayers.updateOne(
      { userId: newLeaderId, guildId: interaction.guildId },
      { $set: { isPartyLeader: true } }
    );

    // Remove isPartyLeader from other members
    const otherMemberIds = party.members
      .filter(m => m.userId !== newLeaderId)
      .map(m => m.userId);

    if (otherMemberIds.length > 0) {
      await partyPlayers.updateMany(
        { userId: { $in: otherMemberIds }, guildId: interaction.guildId },
        { $unset: { isPartyLeader: '' } }
      );
    }

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

    return interaction.editReply({ 
      content: `✅ Set <@${newLeaderId}> as the leader of ${partyLabel}!`, 
      embeds: [embed], 
      components: [] 
    });
  }
}

/**
 * Show add members UI with continuation support
 */
async function showAddMembersUI(interaction, allPlayers, page, partyIdentifier, party, collections, previousMessage = null) {
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
        .setMaxValues(Math.min(options.length, availableSlots, 25))
        .addOptions(options)
    )
  );

  // Pagination
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

  let content = `📊 Showing ${start + 1}-${Math.min(end, allPlayers.length)} of ${allPlayers.length} available players\n`;
  content += `**${currentSize}/${maxSize}** members in ${partyLabel} • **${availableSlots}** slots available`;

  if (previousMessage) {
    content = `${previousMessage}\n\n${content}`;
  }

  return interaction.update({
    content,
    components
  });
}

module.exports = { handlePartySelects };