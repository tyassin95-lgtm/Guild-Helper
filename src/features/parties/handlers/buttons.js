const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { WEAPONS, MAX_PARTIES, RESERVE_PARTY_SIZE } = require('../constants');
const { createPlayerInfoEmbed, createPartiesOverviewEmbed } = require('../embed');

async function handlePartyButtons({ interaction, collections }) {
  const { partyPlayers, parties, dmContexts, guildSettings } = collections;

  if (interaction.customId === 'party_set_weapon1') {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('party_select_weapon1')
        .setPlaceholder('Choose your primary weapon')
        .addOptions(WEAPONS.map(w => ({
          label: w.name,
          value: w.name,
          emoji: w.emoji
        })))
    );

    return interaction.reply({ content: 'Select your primary weapon:', components: [row], flags: [64] });
  }

  if (interaction.customId === 'party_set_weapon2') {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('party_select_weapon2')
        .setPlaceholder('Choose your secondary weapon')
        .addOptions(WEAPONS.map(w => ({
          label: w.name,
          value: w.name,
          emoji: w.emoji
        })))
    );

    return interaction.reply({ content: 'Select your secondary weapon:', components: [row], flags: [64] });
  }

  if (interaction.customId === 'party_set_cp') {
    const modal = new ModalBuilder()
      .setCustomId('party_cp_modal')
      .setTitle('Set Combat Power');

    const cpInput = new TextInputBuilder()
      .setCustomId('cp_value')
      .setLabel('Enter your Combat Power (CP)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 3500')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);

    const row = new ActionRowBuilder().addComponents(cpInput);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  if (interaction.customId === 'party_gear_check') {
    const settings = await guildSettings.findOne({ guildId: interaction.guildId });

    if (!settings || !settings.gearCheckChannelId) {
      return interaction.reply({
        content: '❌ Gear check channel not configured! Ask an admin to set it up with `/gearcheck action:Set Channel`.',
        flags: [64]
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('party_gear_check_modal')
      .setTitle('Gear Check - QuestLog Link');

    const urlInput = new TextInputBuilder()
      .setCustomId('questlog_url')
      .setLabel('Enter your QuestLog.gg build URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://questlog.gg/throne-and-liberty/...')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500);

    const row = new ActionRowBuilder().addComponents(urlInput);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  if (interaction.customId === 'party_submit_changes') {
    await interaction.deferReply({ flags: [64] });

    const pendingChanges = await dmContexts.findOne({
      userId: interaction.user.id,
      type: 'pending_party_info',
      guildId: interaction.guildId
    });

    if (!pendingChanges || !pendingChanges.changes || Object.keys(pendingChanges.changes).length === 0) {
      return interaction.editReply({
        content: '❌ No pending changes to submit!'
      });
    }

    if (!pendingChanges.gearCheckComplete) {
      return interaction.editReply({
        content: '❌ You must complete a gear check before submitting changes!'
      });
    }

    try {
      const changes = pendingChanges.changes;
      const playerBefore = await partyPlayers.findOne({
        userId: interaction.user.id,
        guildId: interaction.guildId
      });

      const oldRole = playerBefore?.role;
      const weaponsChanged = changes.weapon1 || changes.weapon2;

      await partyPlayers.updateOne(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { 
          $set: { 
            ...changes,
            updatedAt: new Date()
          } 
        },
        { upsert: true }
      );

      const playerAfter = await partyPlayers.findOne({
        userId: interaction.user.id,
        guildId: interaction.guildId
      });

      if (weaponsChanged && playerAfter.weapon1 && playerAfter.weapon2) {
        const { updatePlayerRole } = require('../roleDetection');
        const newRole = await updatePlayerRole(
          interaction.user.id,
          interaction.guildId,
          playerAfter.weapon1,
          playerAfter.weapon2,
          collections
        );

        if (oldRole && newRole !== oldRole && playerAfter.partyNumber) {
          await parties.updateOne(
            { 
              guildId: interaction.guildId, 
              partyNumber: playerAfter.partyNumber,
              'members.userId': interaction.user.id
            },
            {
              $set: { 
                'members.$.role': newRole,
                'members.$.weapon1': playerAfter.weapon1,
                'members.$.weapon2': playerAfter.weapon2,
                'members.$.cp': playerAfter.cp || 0
              },
              $inc: {
                [`roleComposition.${oldRole}`]: -1,
                [`roleComposition.${newRole}`]: 1
              }
            }
          );
        } else if (playerAfter.partyNumber) {
          await parties.updateOne(
            { 
              guildId: interaction.guildId, 
              partyNumber: playerAfter.partyNumber,
              'members.userId': interaction.user.id
            },
            {
              $set: { 
                'members.$.weapon1': playerAfter.weapon1,
                'members.$.weapon2': playerAfter.weapon2,
                'members.$.cp': playerAfter.cp || 0
              }
            }
          );
        }
      } else if (changes.cp !== undefined && playerAfter.partyNumber) {
        await parties.updateOne(
          { 
            guildId: interaction.guildId, 
            partyNumber: playerAfter.partyNumber,
            'members.userId': interaction.user.id
          },
          { $set: { 'members.$.cp': playerAfter.cp || 0 } }
        );
      }

      if (playerAfter.partyNumber) {
        const party = await parties.findOne({
          guildId: interaction.guildId,
          partyNumber: playerAfter.partyNumber
        });

        if (party) {
          const totalCP = (party.members || []).reduce((sum, m) => sum + (m.cp || 0), 0);
          await parties.updateOne(
            { _id: party._id },
            { $set: { totalCP } }
          );
        }
      }

      await dmContexts.deleteOne({
        userId: interaction.user.id,
        type: 'pending_party_info',
        guildId: interaction.guildId
      });

      const { updateGuildRoster } = require('../commands/guildroster');
      const { guildRosters } = collections;
      const rosterRecord = await guildRosters.findOne({ guildId: interaction.guild.id });
      if (rosterRecord && rosterRecord.channelId) {
        updateGuildRoster(interaction.guild, rosterRecord.channelId, collections).catch(err => {
          console.error('Error auto-updating guild roster:', err);
        });
      }

      return interaction.editReply({
        content: '✅ **Changes submitted successfully!**\n\nYour party information has been updated.'
      });

    } catch (err) {
      console.error('Error submitting changes:', err);
      return interaction.editReply({
        content: '❌ An error occurred while submitting your changes. Please try again.'
      });
    }
  }

  if (interaction.customId === 'party_create') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const reserveParty = await parties.findOne({ guildId: interaction.guildId, isReserve: true });
    const existingParties = await parties.find({ 
      guildId: interaction.guildId, 
      isReserve: { $ne: true } 
    }).toArray();

    if (existingParties.length >= MAX_PARTIES) {
      return interaction.reply({ 
        content: `❌ Maximum number of regular parties (${MAX_PARTIES}) already created.`, 
        flags: [64] 
      });
    }

    const usedNumbers = new Set(existingParties.map(p => p.partyNumber));
    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }

    await parties.insertOne({
      guildId: interaction.guildId,
      partyNumber: nextNumber,
      isReserve: false,
      members: [],
      totalCP: 0,
      roleComposition: { tank: 0, healer: 0, dps: 0 },
      createdAt: new Date()
    });

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

    return interaction.update({ embeds: [embed] });
  }

  if (interaction.customId === 'party_create_reserve') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const existingReserve = await parties.findOne({ 
      guildId: interaction.guildId, 
      isReserve: true 
    });

    if (existingReserve) {
      return interaction.reply({ 
        content: '❌ A reserve party already exists!', 
        flags: [64] 
      });
    }

    await parties.insertOne({
      guildId: interaction.guildId,
      isReserve: true,
      members: [],
      totalCP: 0,
      roleComposition: { tank: 0, healer: 0, dps: 0 },
      createdAt: new Date()
    });

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

    return interaction.update({ 
      content: `✅ Reserve party created! (Capacity: ${RESERVE_PARTY_SIZE} members)`,
      embeds: [embed] 
    });
  }

  if (interaction.customId === 'party_manage') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    if (allParties.length === 0) {
      return interaction.reply({ content: '❌ No parties exist. Create one first!', flags: [64] });
    }

    const options = allParties.map(p => {
      if (p.isReserve) {
        return {
          label: `Reserve Party (${p.members?.length || 0}/${RESERVE_PARTY_SIZE})`,
          value: 'reserve',
          emoji: '📦'
        };
      }
      return {
        label: `Party ${p.partyNumber} (${p.members?.length || 0}/6)`,
        value: p.partyNumber.toString()
      };
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('party_manage_select')
        .setPlaceholder('Select a party to manage')
        .addOptions(options)
    );

    return interaction.reply({ content: 'Select a party to manage:', components: [row], flags: [64] });
  }

  if (interaction.customId === 'party_delete') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ isReserve: 1, partyNumber: 1 })
      .toArray();

    if (allParties.length === 0) {
      return interaction.reply({ content: '❌ No parties exist to delete.', flags: [64] });
    }

    const options = allParties.map(p => {
      if (p.isReserve) {
        return {
          label: `Reserve Party (${p.members?.length || 0}/${RESERVE_PARTY_SIZE})`,
          value: 'reserve',
          description: 'This will remove all members from reserve',
          emoji: '📦'
        };
      }
      return {
        label: `Party ${p.partyNumber} (${p.members?.length || 0}/6)`,
        value: p.partyNumber.toString(),
        description: 'This will remove all members from the party'
      };
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('party_delete_confirm')
        .setPlaceholder('Select a party to delete')
        .addOptions(options)
    );

    return interaction.reply({ content: '⚠️ Select a party to delete:', components: [row], flags: [64] });
  }
}

module.exports = { handlePartyButtons };