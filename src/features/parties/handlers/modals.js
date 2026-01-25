const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPlayerInfoEmbed } = require('../embed');

async function handlePartyModals({ interaction, collections }) {
  const { partyPlayers, dmContexts, guildSettings } = collections;

  if (interaction.customId === 'party_cp_modal') {
    await interaction.deferReply({ flags: [64] }).catch(() => {});

    const cpValue = interaction.fields.getTextInputValue('cp_value');
    const cp = parseInt(cpValue.replace(/,/g, ''));

    if (isNaN(cp) || cp < 0) {
      return interaction.editReply({ content: '❌ Invalid Combat Power value! Please enter a valid number.' });
    }

    if (cp > 10000000) {
      return interaction.editReply({ content: '❌ Combat Power value too high! Maximum is 10,000,000.' });
    }

    let guildId = interaction.guildId;
    let guild = interaction.guild;

    if (!guildId) {
      const context = await dmContexts.findOne({ 
        userId: interaction.user.id,
        expiresAt: { $gt: new Date() }
      });

      if (!context) {
        return interaction.editReply({
          content: '❌ **This DM link has expired (24 hours)**\n\nPlease return to the server and use `/myinfo` to update your Combat Power.'
        });
      }

      guildId = context.guildId;
      guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
    }

    try {
      const pendingChanges = await dmContexts.findOne({
        userId: interaction.user.id,
        type: 'pending_party_info',
        guildId: guildId
      });

      const gearCheckComplete = pendingChanges?.gearCheckComplete || false;

      await dmContexts.updateOne(
        { userId: interaction.user.id, type: 'pending_party_info', guildId: guildId },
        { 
          $set: { 
            'changes.cp': cp,
            gearCheckComplete: gearCheckComplete,
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          } 
        },
        { upsert: true }
      );

      const playerInfo = await partyPlayers.findOne({
        userId: interaction.user.id,
        guildId: guildId
      });

      const updatedPendingChanges = await dmContexts.findOne({
        userId: interaction.user.id,
        type: 'pending_party_info',
        guildId: guildId
      });

      let member = interaction.member;
      if (!member && guild) {
        member = await guild.members.fetch(interaction.user.id).catch(() => ({
          displayName: interaction.user.username,
          user: interaction.user
        }));
      }

      if (!member) {
        member = {
          displayName: interaction.user.username,
          user: interaction.user
        };
      }

      const embed = await createPlayerInfoEmbed(playerInfo, member, collections, updatedPendingChanges);

      const hasPendingChanges = updatedPendingChanges && updatedPendingChanges.changes && Object.keys(updatedPendingChanges.changes).length > 0;

      const row1 = new ActionRowBuilder().addComponents(
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

      const gearCheckButton = gearCheckComplete
        ? new ButtonBuilder()
            .setCustomId('party_gear_check')
            .setLabel('Gear Check Complete')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
        : new ButtonBuilder()
            .setCustomId('party_gear_check')
            .setLabel('Gear Check')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔴');

      const submitButton = new ButtonBuilder()
        .setCustomId('party_submit_changes')
        .setLabel('Submit Changes')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝')
        .setDisabled(!hasPendingChanges || !gearCheckComplete);

      const row2 = new ActionRowBuilder().addComponents(
        gearCheckButton,
        submitButton
      );

      return interaction.editReply({
        content: `✅ Combat Power set to **${cp.toLocaleString()}** (pending)`,
        embeds: [embed],
        components: [row1, row2]
      });

    } catch (err) {
      console.error('Error processing CP update:', err);
      return interaction.editReply({
        content: '❌ An error occurred while setting your CP. Please try again using `/myinfo` in the server.'
      });
    }
  }

  if (interaction.customId === 'party_gear_check_modal') {
    await interaction.deferReply({ flags: [64] });

    const questlogUrl = interaction.fields.getTextInputValue('questlog_url');

    if (!questlogUrl.includes('questlog.gg')) {
      return interaction.editReply({
        content: '❌ Invalid URL! Please provide a valid questlog.gg link.\n\nExample: https://questlog.gg/throne-and-liberty/...'
      });
    }

    try {
      const guildId = interaction.guildId;
      const guild = interaction.guild;

      await dmContexts.updateOne(
        { userId: interaction.user.id, type: 'gear_upload', guildId: guildId },
        { 
          $set: { 
            questlogUrl: questlogUrl,
            channelId: interaction.channelId,
            guildName: guild?.name || 'Unknown',
            sentAt: new Date(),
            expiresAt: new Date(Date.now() + 120 * 1000)
          } 
        },
        { upsert: true }
      );

      return interaction.editReply({
        content: '📸 **Great! Now upload your gear screenshot:**\n\n' +
                 'Please send your gear screenshot as an image in your **next message**.\n\n' +
                 '• Accepted formats: PNG, JPG, JPEG, WEBP\n' +
                 '• Maximum size: 8MB\n' +
                 '• This will be posted in your gear check thread\n\n' +
                 '**Send the image now!** (You have 2 minutes)'
      });

    } catch (err) {
      console.error('Error processing gear check modal:', err);
      return interaction.editReply({
        content: '❌ An error occurred. Please try again.'
      });
    }
  }
}

module.exports = { handlePartyModals };