  const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
  const { createPlayerInfoEmbed, createPartiesOverviewEmbed } = require('../embed');
  const { PARTY_SIZE } = require('../constants');
  const { updatePlayerRole } = require('../roleDetection');
  const { autoAssignPlayer, handleRoleChange } = require('../autoAssignment');
  const { schedulePartyPanelUpdate } = require('../panelUpdater');
  const { getGuildContext } = require('./buttons');

  async function handlePartySelects({ interaction, collections }) {
    const { partyPlayers, parties } = collections;

    // Select weapon 1
    if (interaction.customId === 'party_select_weapon1') {
      await interaction.deferUpdate();

      const weapon = interaction.values[0];

      try {
        // Get guild context (works in both DM and guild)
        const { guildId, guild } = await getGuildContext(interaction, collections);

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

        if (playerInfo.weapon1 && playerInfo.weapon2) {
          const newRole = await updatePlayerRole(
            interaction.user.id,
            guildId,
            playerInfo.weapon1,
            playerInfo.weapon2,
            collections
          );

          if (oldRole && newRole !== oldRole && playerInfo.partyNumber) {
            handleRoleChange(
              interaction.user.id,
              guildId,
              oldRole,
              newRole,
              interaction.client,
              collections
            ).catch(err => {
              console.error('Role change error:', err);
            });

            schedulePartyPanelUpdate(guildId, interaction.client, collections);
          } else if (!playerInfo.partyNumber && playerInfo.cp) {
            autoAssignPlayer(
              interaction.user.id,
              guildId,
              interaction.client,
              collections
            ).then(result => {
              if (result.success) {
                schedulePartyPanelUpdate(guildId, interaction.client, collections);
              }
            }).catch(err => {
              console.error('Auto-assign error:', err);
            });
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

        const embed = createPlayerInfoEmbed(playerInfo, member);

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

        if (err.message === 'DM_CONTEXT_EXPIRED') {
          return interaction.editReply({ 
            content: '❌ This DM link has expired (24 hours). Please use `/myinfo` in the server to set up your party info.', 
            embeds: [], 
            components: [] 
          });
        }

        return interaction.editReply({ 
          content: '❌ An error occurred while updating your weapon. Please try again.', 
          embeds: [], 
          components: [] 
        });
      }
    }

    if (interaction.customId === 'party_select_weapon2') {
      await interaction.deferUpdate();

      const weapon = interaction.values[0];

      try {
        // Get guild context (works in both DM and guild)
        const { guildId, guild } = await getGuildContext(interaction, collections);

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

        if (playerInfo.weapon1 && playerInfo.weapon2) {
          const newRole = await updatePlayerRole(
            interaction.user.id,
            guildId,
            playerInfo.weapon1,
            playerInfo.weapon2,
            collections
          );

          if (oldRole && newRole !== oldRole && playerInfo.partyNumber) {
            handleRoleChange(
              interaction.user.id,
              guildId,
              oldRole,
              newRole,
              interaction.client,
              collections
            ).catch(err => {
              console.error('Role change error:', err);
            });

            schedulePartyPanelUpdate(guildId, interaction.client, collections);
          } else if (!playerInfo.partyNumber && playerInfo.cp) {
            autoAssignPlayer(
              interaction.user.id,
              guildId,
              interaction.client,
              collections
            ).then(result => {
              if (result.success) {
                schedulePartyPanelUpdate(guildId, interaction.client, collections);
              }
            }).catch(err => {
              console.error('Auto-assign error:', err);
            });
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

        const embed = createPlayerInfoEmbed(playerInfo, member);

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

        if (err.message === 'DM_CONTEXT_EXPIRED') {
          return interaction.editReply({ 
            content: '❌ This DM link has expired (24 hours). Please use `/myinfo` in the server to set up your party info.', 
            embeds: [], 
            components: [] 
          });
        }

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

      const partyNumber = parseInt(interaction.values[0]);

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`party_add_member:${partyNumber}`)
          .setLabel('Add Member')
          .setStyle(ButtonStyle.Success)
          .setEmoji('➕'),
        new ButtonBuilder()
          .setCustomId(`party_remove_member:${partyNumber}`)
          .setLabel('Remove Member')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('➖')
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`party_move_member:${partyNumber}`)
          .setLabel('Move Member')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄')
      );

      return interaction.update({ 
        content: `Managing **Party ${partyNumber}**\n\nChoose an action:`, 
        components: [row1, row2] 
      });
    }

    if (interaction.customId.startsWith('party_add_player:')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
      }

      const partyNumber = parseInt(interaction.customId.split(':')[1]);
      const userId = interaction.values[0];

      const party = await parties.findOne({ guildId: interaction.guildId, partyNumber });

      if ((party.members?.length || 0) >= PARTY_SIZE) {
        return interaction.update({ content: `❌ Party ${partyNumber} is full (${PARTY_SIZE}/${PARTY_SIZE})!`, components: [] });
      }

      const playerInfo = await partyPlayers.findOne({ userId, guildId: interaction.guildId });

      if (!playerInfo || !playerInfo.weapon1 || !playerInfo.weapon2) {
        return interaction.update({ content: '❌ This player hasn\'t set up their party info yet!', components: [] });
      }

      if (!playerInfo.role) {
        await updatePlayerRole(userId, interaction.guildId, playerInfo.weapon1, playerInfo.weapon2, collections);
        playerInfo.role = (await partyPlayers.findOne({ userId, guildId: interaction.guildId })).role;
      }

      await parties.updateOne(
        { guildId: interaction.guildId, partyNumber },
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

      await partyPlayers.updateOne(
        { userId, guildId: interaction.guildId },
        { $set: { partyNumber } }
      );

      schedulePartyPanelUpdate(interaction.guildId, interaction.client, collections);

      const allParties = await parties.find({ guildId: interaction.guildId })
        .sort({ partyNumber: 1 })
        .toArray();

      const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

      return interaction.update({ 
        content: `✅ Added <@${userId}> to Party ${partyNumber}!`, 
        embeds: [embed], 
        components: [] 
      });
    }

    if (interaction.customId.startsWith('party_remove_player:')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
      }

      const partyNumber = parseInt(interaction.customId.split(':')[1]);
      const userId = interaction.values[0];

      const party = await parties.findOne({ guildId: interaction.guildId, partyNumber });
      const member = party.members?.find(m => m.userId === userId);

      if (member) {
        await parties.updateOne(
          { guildId: interaction.guildId, partyNumber },
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
        { $unset: { partyNumber: '' } }
      );

      schedulePartyPanelUpdate(interaction.guildId, interaction.client, collections);

      const allParties = await parties.find({ guildId: interaction.guildId })
        .sort({ partyNumber: 1 })
        .toArray();

      const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

      return interaction.update({ 
        content: `✅ Removed <@${userId}> from Party ${partyNumber}!`, 
        embeds: [embed], 
        components: [] 
      });
    }

    if (interaction.customId.startsWith('party_move_player:')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
      }

      const [fromParty, userId] = interaction.customId.split(':').slice(1);

      const otherParties = await parties.find({ 
        guildId: interaction.guildId,
        partyNumber: { $ne: parseInt(fromParty) }
      }).sort({ partyNumber: 1 }).toArray();

      if (otherParties.length === 0) {
        return interaction.update({ content: '❌ No other parties exist to move to!', components: [] });
      }

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`party_move_destination:${fromParty}:${userId}`)
          .setPlaceholder('Select destination party')
          .addOptions(otherParties.map(p => ({
            label: `Party ${p.partyNumber} (${p.members?.length || 0}/6)`,
            value: p.partyNumber.toString(),
            description: (p.members?.length || 0) >= PARTY_SIZE ? 'FULL' : 'Available'
          })))
      );

      return interaction.update({ content: 'Select destination party:', components: [row] });
    }

    if (interaction.customId.startsWith('party_move_destination:')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
      }

      const [fromPartyStr, userId] = interaction.customId.split(':').slice(1);
      const fromParty = parseInt(fromPartyStr);
      const toParty = parseInt(interaction.values[0]);

      const destParty = await parties.findOne({ guildId: interaction.guildId, partyNumber: toParty });

      if ((destParty.members?.length || 0) >= PARTY_SIZE) {
        return interaction.update({ content: `❌ Party ${toParty} is full (${PARTY_SIZE}/${PARTY_SIZE})!`, components: [] });
      }

      const sourceParty = await parties.findOne({ guildId: interaction.guildId, partyNumber: fromParty });
      const memberToMove = sourceParty.members?.find(m => m.userId === userId);

      if (!memberToMove) {
        return interaction.update({ content: '❌ Member not found in source party!', components: [] });
      }

      await parties.updateOne(
        { guildId: interaction.guildId, partyNumber: fromParty },
        { 
          $pull: { members: { userId } },
          $inc: {
            totalCP: -(memberToMove.cp || 0),
            [`roleComposition.${memberToMove.role}`]: -1
          }
        }
      );

      await parties.updateOne(
        { guildId: interaction.guildId, partyNumber: toParty },
        { 
          $push: { members: { ...memberToMove, addedAt: new Date() } },
          $inc: {
            totalCP: (memberToMove.cp || 0),
            [`roleComposition.${memberToMove.role}`]: 1
          }
        }
      );

      await partyPlayers.updateOne(
        { userId, guildId: interaction.guildId },
        { $set: { partyNumber: toParty } }
      );

      schedulePartyPanelUpdate(interaction.guildId, interaction.client, collections);

      const allParties = await parties.find({ guildId: interaction.guildId })
        .sort({ partyNumber: 1 })
        .toArray();

      const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

      return interaction.update({ 
        content: `✅ Moved <@${userId}> from Party ${fromParty} to Party ${toParty}!`, 
        embeds: [embed], 
        components: [] 
      });
    }

    if (interaction.customId === 'party_delete_confirm') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
      }

      const partyNumber = parseInt(interaction.values[0]);

      const party = await parties.findOne({ guildId: interaction.guildId, partyNumber });

      if (party && party.members && party.members.length > 0) {
        const userIds = party.members.map(m => m.userId);
        await partyPlayers.updateMany(
          { userId: { $in: userIds }, guildId: interaction.guildId },
          { $unset: { partyNumber: '' } }
        );
      }

      await parties.deleteOne({ guildId: interaction.guildId, partyNumber });

      schedulePartyPanelUpdate(interaction.guildId, interaction.client, collections);

      const allParties = await parties.find({ guildId: interaction.guildId })
        .sort({ partyNumber: 1 })
        .toArray();

      const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

      return interaction.update({ 
        content: `✅ Party ${partyNumber} has been deleted!`, 
        embeds: [embed], 
        components: [] 
      });
    }
  }

  module.exports = { handlePartySelects };