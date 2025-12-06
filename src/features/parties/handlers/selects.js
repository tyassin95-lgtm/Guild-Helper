const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { createPlayerInfoEmbed, createPartiesOverviewEmbed } = require('../embed');
const { PARTY_SIZE, RESERVE_PARTY_SIZE } = require('../constants');
const { updatePlayerRole } = require('../roleDetection');

async function handlePartySelects({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

  // Select weapon 1
  if (interaction.customId === 'party_select_weapon1') {
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

  // Select weapon 2
  if (interaction.customId === 'party_select_weapon2') {
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
    return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
  }

  if (interaction.customId === 'party_manage_select') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const partyIdentifier = interaction.values[0];
    const isReserve = partyIdentifier === 'reserve';
    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party_add_member:${partyIdentifier}`)
        .setLabel('Add Member')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId(`party_remove_member:${partyIdentifier}`)
        .setLabel('Remove Member')
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

  if (interaction.customId.startsWith('party_add_player:')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const userId = interaction.values[0];

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const maxSize = isReserve ? RESERVE_PARTY_SIZE : PARTY_SIZE;
    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

    if ((party.members?.length || 0) >= maxSize) {
      return interaction.update({ 
        content: `❌ ${partyLabel} is full (${maxSize}/${maxSize})!`, 
        components: [] 
      });
    }

    const playerInfo = await partyPlayers.findOne({ userId, guildId: interaction.guildId });

    if (!playerInfo || !playerInfo.weapon1 || !playerInfo.weapon2) {
      return interaction.update({ 
        content: '❌ This player hasn\'t set up their party info yet!', 
        components: [] 
      });
    }

    if (!playerInfo.role) {
      await updatePlayerRole(userId, interaction.guildId, playerInfo.weapon1, playerInfo.weapon2, collections);
      playerInfo.role = (await partyPlayers.findOne({ userId, guildId: interaction.guildId })).role;
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

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

    return interaction.update({ 
      content: `✅ Added <@${userId}> to ${partyLabel}!`, 
      embeds: [embed], 
      components: [] 
    });
  }

  if (interaction.customId.startsWith('party_remove_player:')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const partyIdentifier = interaction.customId.split(':')[1];
    const isReserve = partyIdentifier === 'reserve';
    const userId = interaction.values[0];

    const party = isReserve
      ? await parties.findOne({ guildId: interaction.guildId, isReserve: true })
      : await parties.findOne({ guildId: interaction.guildId, partyNumber: parseInt(partyIdentifier) });

    const member = party.members?.find(m => m.userId === userId);
    const partyLabel = isReserve ? 'Reserve' : `Party ${partyIdentifier}`;

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
    }

    await partyPlayers.updateOne(
      { userId, guildId: interaction.guildId },
      { $unset: { partyNumber: '', inReserve: '' } }
    );

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

    return interaction.update({ 
      content: `✅ Removed <@${userId}> from ${partyLabel}!`, 
      embeds: [embed], 
      components: [] 
    });
  }

  if (interaction.customId.startsWith('party_move_player:')) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const [, fromIdentifier, userId] = interaction.customId.split(':');
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
}

module.exports = { handlePartySelects };