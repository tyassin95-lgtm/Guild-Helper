const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { WEAPONS, MAX_PARTIES, RESERVE_PARTY_SIZE } = require('../constants');
const { createPlayerInfoEmbed, createPartiesOverviewEmbed } = require('../embed');

async function handlePartyButtons({ interaction, collections }) {
  const { partyPlayers, parties, dmContexts } = collections;

  // Web Editor button (admin only)
  if (interaction.customId === 'party_web_editor') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    // Generate web token
    const { webServer } = require('../../../web/server');
    const token = webServer.generateStaticPartyToken(interaction.guildId, interaction.user.id);

    const baseUrl = process.env.WEB_BASE_URL || 'http://34.170.220.22:3001';
    const webUrl = `${baseUrl}/static-party-editor/${token}`;

    return interaction.reply({
      content: `🌐 **Static Party Editor**\n\n` +
               `Click the link below to edit parties in your browser:\n\n` +
               `**[Open Party Editor](${webUrl})**\n\n` +
               `⏰ Link expires in 1 hour\n` +
               `ℹ️ Changes are saved directly to the database`,
      flags: [64]
    });
  }

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

  // Upload gear screenshot
  if (interaction.customId === 'party_upload_gear') {
    await interaction.reply({
      content: '📸 **Upload your gear screenshot:**\n\n' +
               'Please send your gear screenshot as an image in your **next message**.\n\n' +
               '• Accepted formats: PNG, JPG, JPEG, WEBP\n' +
               '• Maximum size: 8MB\n' +
               '• This will be visible in the guild roster\n\n' +
               '**Send the image now!** (You have 60 seconds)',
      flags: [64] // Ephemeral flag (64 = MessageFlags.Ephemeral)
    });

    // Get guild context - for DM support
    let guildId = interaction.guildId;
    let guild = interaction.guild;

    if (!guildId) {
      const context = await dmContexts.findOne({ 
        userId: interaction.user.id,
        expiresAt: { $gt: new Date() }
      });

      if (!context) {
        return interaction.editReply({
          content: '❌ This DM link has expired (24 hours). Please use `/myinfo` in the server to upload your gear screenshot.'
        });
      }

      guildId = context.guildId;
      guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
    }

    // Store upload context with expiration + the channel ID for cleanup
    await dmContexts.updateOne(
      { userId: interaction.user.id },
      { 
        $set: { 
          type: 'gear_upload',
          guildId: guildId,
          guildName: guild?.name || 'Unknown',
          channelId: interaction.channelId, // Store channel for cleanup
          sentAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 1000) // 60 seconds
        } 
      },
      { upsert: true }
    );

    return;
  }

  // Create party (admin only - guild context required)
  if (interaction.customId === 'party_create') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    // Check if reserve party exists
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

    // Find next available party number
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

  // Create reserve party
  if (interaction.customId === 'party_create_reserve') {
    if (!interaction.guildId) {
      return interaction.reply({ content: '❌ This action must be performed in the server.', flags: [64] });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    // Check if reserve already exists
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

  // Manage parties (admin only - guild context required)
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

  // Delete party (admin only - guild context required)
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