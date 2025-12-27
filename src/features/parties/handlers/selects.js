const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createPlayerInfoEmbed, createPartiesOverviewEmbed } = require('../embed');
const { PARTY_SIZE, RESERVE_PARTY_SIZE } = require('../constants');
const { updatePlayerRole } = require('../roleDetection');
const { updateGuildRoster } = require('../commands/guildroster');
const { getRoleEmoji } = require('../roleDetection');

async function handlePartySelects({ interaction, collections }) {
  console.log('[PARTY SELECTS] Handler called for:', interaction.customId);

  const { partyPlayers, parties } = collections;

  // Set weapon 1
  if (interaction.customId === 'party_select_weapon1') {
    console.log('[PARTY SELECTS] party_select_weapon1');
    await interaction.deferUpdate();

    const weapon = interaction.values[0];

    // Get guild context - for DM support
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
          content: '❌ This DM link has expired (24 hours). Please use `/myinfo` in the server to set up your party info.', 
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

      await partyPlayers.updateOne(
        { userId: interaction.user.id, guildId: guildId },
        { $set: { weapon1: weapon, updatedAt: new Date() } },
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
          if (playerInfo.inReserve) {
            await parties.updateOne(
              {
                guildId,
                isReserve: true,
                'members.userId': interaction.user.id
              },
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
          } else if (playerInfo.partyNumber) {
            await parties.updateOne(
              {
                guildId,
                partyNumber: playerInfo.partyNumber,
                'members.userId': interaction.user.id
              },
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
      }

      // Fetch member for embed
      let member = interaction.member;
      if (!member && guild) {
        try {
          member = await guild.members.fetch(interaction.user.id);
        } catch (err) {
          console.warn('Could not fetch member:', err.message);
        }
      }

      if (!member) {
        member = {
          displayName: interaction.user.username,
          user: interaction.user
        };
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
        content: `✅ Primary weapon set to **${weapon}**!`,
        embeds: [embed],
        components: [row]
      });
    } catch (err) {
      console.error('Error in party_select_weapon1:', err);
      return interaction.editReply({
        content: '❌ An error occurred while updating your weapon. Please try again.',
        embeds: [],
        components: []
      });
    }
  }

  // Set weapon 2
  if (interaction.customId === 'party_select_weapon2') {
    console.log('[PARTY SELECTS] party_select_weapon2');
    await interaction.deferUpdate();

    const weapon = interaction.values[0];

    // Get guild context - for DM support
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
          content: '❌ This DM link has expired (24 hours). Please use `/myinfo` in the server to set up your party info.', 
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

      await partyPlayers.updateOne(
        { userId: interaction.user.id, guildId: guildId },
        { $set: { weapon2: weapon, updatedAt: new Date() } },
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
          if (playerInfo.inReserve) {
            await parties.updateOne(
              {
                guildId,
                isReserve: true,
                'members.userId': interaction.user.id
              },
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
          } else if (playerInfo.partyNumber) {
            await parties.updateOne(
              {
                guildId,
                partyNumber: playerInfo.partyNumber,
                'members.userId': interaction.user.id
              },
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
      }

      // Fetch member for embed
      let member = interaction.member;
      if (!member && guild) {
        try {
          member = await guild.members.fetch(interaction.user.id);
        } catch (err) {
          console.warn('Could not fetch member:', err.message);
        }
      }

      if (!member) {
        member = {
          displayName: interaction.user.username,
          user: interaction.user
        };
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
        content: `✅ Secondary weapon set to **${weapon}**!`,
        embeds: [embed],
        components: [row]
      });
    } catch (err) {
      console.error('Error in party_select_weapon2:', err);
      return interaction.editReply({
        content: '❌ An error occurred while updating your weapon. Please try again.',
        embeds: [],
        components: []
      });
    }
  }

  // All other handlers require guild context (admin actions)
  if (!interaction.guildId) {
    console.log('[PARTY SELECTS] No guild context');
    return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
  }

  // NEW: Multi-select add players - CRITICAL FIX: Defer immediately
  if (interaction.customId.startsWith('party_add_selected:')) {
    console.log('[PARTY SELECTS] party_add_selected - Deferring update...');

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      console.log('[PARTY SELECTS] Permission denied');
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    try {
      // CRITICAL: Defer IMMEDIATELY before any processing
      await interaction.deferUpdate();
      console.log('[PARTY SELECTS] Deferred update successfully');
    } catch (err) {
      console.error('[PARTY SELECTS] Failed to defer update:', err.message);
      return;
    }

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const userIds = interaction.values; // Array of selected user IDs

    console.log('[PARTY SELECTS] Adding', userIds.length, 'players to', partyIdentifier);

    if (userIds.length === 0) {
      return interaction.editReply({
        content: '⚠️ No players selected. Please select at least one player from the menu.',
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
        content: `❌ Cannot add ${userIds.length} players! Only ${availableSlots} slot(s) available in ${partyLabel}.`,
        components: []
      });
    }

    // Process all selected players
    const addedPlayers = [];
    const failedPlayers = [];

    console.log('[PARTY SELECTS] Processing players...');

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

    console.log('[PARTY SELECTS] Added:', addedPlayers.length, 'Failed:', failedPlayers.length);

    // Get updated party info
    const updatedParty = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    // Get all available players for the UI
    const allPlayers = await partyPlayers.find({ 
      guildId: interaction.guildId,
      weapon1: { $exists: true },
      weapon2: { $exists: true },
      partyNumber: { $exists: false },
      inReserve: { $ne: true }
    }).toArray();

    allPlayers.sort((a, b) => (b.cp || 0) - (a.cp || 0));

    console.log('[PARTY SELECTS] Building response embed...');

    // Build updated embed
    const embed = new EmbedBuilder()
      .setColor('#10B981')
      .setTitle(`✅ Added ${addedPlayers.length} player(s) to ${partyLabel}`)
      .setTimestamp();

    if (addedPlayers.length > 0) {
      embed.addFields({
        name: 'Successfully Added',
        value: addedPlayers.map(name => `• ${name}`).join('\n'),
        inline: false
      });
    }

    if (failedPlayers.length > 0) {
      embed.addFields({
        name: 'Failed to Add (No Party Info)',
        value: failedPlayers.map(name => `• ${name}`).join('\n'),
        inline: false
      });
    }

    const newCurrentSize = updatedParty?.members?.length || 0;
    const newAvailableSlots = maxSize - newCurrentSize;

    embed.addFields({
      name: 'Party Status',
      value: `**${newCurrentSize}/${maxSize}** members | **${newAvailableSlots}** slots available`,
      inline: false
    });

    // Show updated roster in embed
    if (updatedParty?.members && updatedParty.members.length > 0) {
      const memberList = await Promise.all(updatedParty.members.map(async (m, index) => {
        const member = await interaction.guild.members.fetch(m.userId).catch(() => null);
        const displayName = member ? member.displayName : 'Unknown';
        const roleEmoji = getRoleEmoji(m.role);
        const cp = (m.cp || 0).toLocaleString();
        const leaderBadge = m.isLeader ? '👑 ' : '';

        return `${index + 1}. ${leaderBadge}${displayName} ${roleEmoji} ${m.weapon1}/${m.weapon2} • ${cp} CP`;
      }));

      embed.addFields({
        name: `Current Members (${updatedParty.members.length})`,
        value: memberList.slice(0, 10).join('\n') + (memberList.length > 10 ? `\n*...and ${memberList.length - 10} more*` : ''),
        inline: false
      });
    }

    // If no more slots available or no more players, show completion
    if (newAvailableSlots === 0 || allPlayers.length === 0) {
      console.log('[PARTY SELECTS] Party full or no more players, finishing');
      return interaction.editReply({
        content: newAvailableSlots === 0 
          ? `🎉 **${partyLabel} is now full!**`
          : `✅ **All available players assigned!**`,
        embeds: [embed],
        components: []
      });
    }

    console.log('[PARTY SELECTS] Building continuation UI...');

    // Continue showing the UI for more additions
    const pageSize = 25;
    const playersOnPage = allPlayers.slice(0, pageSize);

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
        .setPlaceholder(`Select more players to add (max ${Math.min(newAvailableSlots, 25)})`)
        .setMinValues(0)
        .setMaxValues(Math.min(options.length, newAvailableSlots, 25))
        .addOptions(options)
    );
    components.push(selectRow);

    // Pagination if needed
    const totalPages = Math.ceil(allPlayers.length / pageSize);
    if (totalPages > 1) {
      const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`party_add_page:${partyIdentifier}:0`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('page_indicator')
          .setLabel(`Page 1/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`party_add_page:${partyIdentifier}:1`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(totalPages === 1)
      );
      components.push(buttonRow);
    }

    // Action buttons
    const actionRow = new ActionRowBuilder().addComponents(
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
    );
    components.push(actionRow);

    console.log('[PARTY SELECTS] Sending continuation UI...');

    const result = await interaction.editReply({
      content: `📊 Showing 1-${Math.min(pageSize, allPlayers.length)} of ${allPlayers.length} available players\n` +
               `💡 Select more players to continue adding, or use the buttons below for other actions.`,
      embeds: [embed],
      components
    });

    console.log('[PARTY SELECTS] party_add_selected complete');
    return result;
  }

  if (interaction.customId === 'party_manage_select') {
    console.log('[PARTY SELECTS] party_manage_select');

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

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
        .setEmoji('🔄')
    );

    return interaction.update({ 
      content: `Managing **${partyLabel}**\n\nChoose an action:`, 
      components: [row1, row2] 
    });
  }

  // Remove player(s) - NOW SUPPORTS MULTI-SELECT
  if (interaction.customId.startsWith('party_remove_player:')) {
    console.log('[PARTY SELECTS] party_remove_player');

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const userIds = interaction.values; // Array of selected user IDs

    await interaction.deferUpdate();

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;
    const removedPlayers = [];

    // Remove all selected players
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
      content: `✅ Removed **${removedPlayers.length}** player(s) from ${partyLabel}:\n${removedPlayers.map(n => `• ${n}`).join('\n')}`, 
      embeds: [embed], 
      components: [] 
    });
  }

  if (interaction.customId.startsWith('party_move_player:')) {
    console.log('[PARTY SELECTS] party_move_player');

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

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

  if (interaction.customId.startsWith('party_move_destination:')) {
    console.log('[PARTY SELECTS] party_move_destination');

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

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
      return interaction.update({ 
        content: `❌ ${toLabel} is full (${maxSize}/${maxSize})!`, 
        components: [] 
      });
    }

    const sourceParty = isFromReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(fromIdentifier) });

    const memberToMove = sourceParty.members?.find(m => m.userId === userId);

    if (!memberToMove) {
      return interaction.update({ content: '❌ Member not found in source party!', components: [] });
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

    return interaction.update({ 
      content: `✅ Moved <@${userId}> from ${fromLabel} to ${toLabel}!`, 
      embeds: [embed], 
      components: [] 
    });
  }

  if (interaction.customId === 'party_delete_confirm') {
    console.log('[PARTY SELECTS] party_delete_confirm');

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

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

    return interaction.update({ 
      content: `✅ ${partyLabel} has been deleted!`, 
      embeds: [embed], 
      components: [] 
    });
  }

  // Select party leader
  if (interaction.customId.startsWith('party_select_leader:')) {
    console.log('[PARTY SELECTS] party_select_leader - Processing selection');

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const newLeaderId = interaction.values[0];

    console.log('[PARTY SELECTS] Setting leader', newLeaderId, 'for', partyIdentifier);

    const updateQuery = isReserve
      ? { guildId: interaction.guildId, isReserve: true }
      : { guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) };

    const party = await parties.findOne(updateQuery);
    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

    if (!party) {
      return interaction.update({ content: '❌ Party not found!', components: [] });
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

    // Remove isPartyLeader from other members in this party
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

    console.log('[PARTY SELECTS] Leader set successfully, updating message');

    return interaction.update({ 
      content: `✅ Set <@${newLeaderId}> as the leader of ${partyLabel}!`, 
      embeds: [embed], 
      components: [] 
    });
  }
}

module.exports = { handlePartySelects };