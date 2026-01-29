const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { WEAPONS } = require('../constants');

async function handlePartyButtons({ interaction, collections }) {
  const { dmContexts } = collections;

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
}

module.exports = { handlePartyButtons };