const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { WEAPONS, MAX_PARTIES } = require('../constants');
const { createPlayerInfoEmbed, createPartiesOverviewEmbed } = require('../embed');

async function handlePartyButtons({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

  // Set weapon 1
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

  // Set weapon 2
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

  // Set CP modal
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

  // Create party (admin only - guild context required)
  if (interaction.customId === 'party_create') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const existingParties = await parties.find({ guildId: interaction.guildId }).toArray();

    if (existingParties.length >= MAX_PARTIES) {
      return interaction.reply({ content: `❌ Maximum number of parties (${MAX_PARTIES}) already created.`, flags: [64] });
    }

    // Find next available party number
    const usedNumbers = new Set(existingParties.map(p => p.partyNumber));
    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }

    await parties.insertOne({
      guildId: interaction.guildId,
      partyNumber: nextNumber,
      members: [],
      totalCP: 0,
      roleComposition: { tank: 0, healer: 0, dps: 0 },
      createdAt: new Date()
    });

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ partyNumber: 1 })
      .toArray();

    const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

    return interaction.update({ embeds: [embed] });
  }

  // Manage parties (admin only - guild context required)
  if (interaction.customId === 'party_manage') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ partyNumber: 1 })
      .toArray();

    if (allParties.length === 0) {
      return interaction.reply({ content: '❌ No parties exist. Create one first!', flags: [64] });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('party_manage_select')
        .setPlaceholder('Select a party to manage')
        .addOptions(allParties.map(p => ({
          label: `Party ${p.partyNumber} (${p.members?.length || 0}/6)`,
          value: p.partyNumber.toString()
        })))
    );

    return interaction.reply({ content: 'Select a party to manage:', components: [row], flags: [64] });
  }

  // Delete party (admin only - guild context required)
  if (interaction.customId === 'party_delete') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ partyNumber: 1 })
      .toArray();

    if (allParties.length === 0) {
      return interaction.reply({ content: '❌ No parties exist to delete.', flags: [64] });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('party_delete_confirm')
        .setPlaceholder('Select a party to delete')
        .addOptions(allParties.map(p => ({
          label: `Party ${p.partyNumber} (${p.members?.length || 0}/6)`,
          value: p.partyNumber.toString(),
          description: 'This will remove all members from the party'
        })))
    );

    return interaction.reply({ content: '⚠️ Select a party to delete:', components: [row], flags: [64] });
  }
}

module.exports = { handlePartyButtons };