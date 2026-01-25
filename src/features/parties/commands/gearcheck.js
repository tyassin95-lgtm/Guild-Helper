const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getStorageChannelInfo, deleteFromDiscordStorage } = require('../../../utils/discordStorage');

async function handleGearCheck({ interaction, collections }) {
  const { partyPlayers, guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ 
      content: '❌ You need administrator permissions to use this command.', 
      flags: [64] 
    });
  }

  const action = interaction.options.getString('action');

  if (action === 'set_channel') {
    const channel = interaction.options.getChannel('channel');

    if (!channel) {
      return interaction.reply({
        content: '❌ Please specify a channel.',
        flags: [64]
      });
    }

    if (channel.type !== 0) {
      return interaction.reply({
        content: '❌ Please select a text channel.',
        flags: [64]
      });
    }

    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    const requiredPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.ReadMessageHistory
    ];

    const missingPermissions = requiredPermissions.filter(perm => !botPermissions.has(perm));

    if (missingPermissions.length > 0) {
      return interaction.reply({
        content: '❌ I don\'t have the required permissions in that channel!\n\n' +
                 '**Missing permissions:**\n' +
                 missingPermissions.map(p => `• ${Object.keys(PermissionFlagsBits).find(key => PermissionFlagsBits[key] === p)}`).join('\n'),
        flags: [64]
      });
    }

    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $set: { gearCheckChannelId: channel.id } },
      { upsert: true }
    );

    const embed = new EmbedBuilder()
      .setColor('#10B981')
      .setTitle('✅ Gear Check Channel Set')
      .setDescription(
        `Gear check threads will now be created in ${channel}\n\n` +
        '**What this means:**\n' +
        '• Each user will get their own thread for gear checks\n' +
        '• Threads will contain questlog.gg builds and screenshots\n' +
        '• Admins can review all submissions in one place\n\n' +
        '**Note:** Users must complete a gear check before submitting their party info.'
      )
      .addFields({
        name: 'Channel Info',
        value: `**Name:** ${channel.name}\n**ID:** ${channel.id}`,
        inline: false
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  if (action === 'set_storage_channel') {
    const channel = interaction.options.getChannel('channel');

    if (!channel) {
      return interaction.reply({
        content: '❌ Please specify a channel.',
        flags: [64]
      });
    }

    if (channel.type !== 0) {
      return interaction.reply({
        content: '❌ Please select a text channel.',
        flags: [64]
      });
    }

    const botPermissions = channel.permissionsFor(interaction.guild.members.me);
    const requiredPermissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages
    ];

    const missingPermissions = requiredPermissions.filter(perm => !botPermissions.has(perm));

    if (missingPermissions.length > 0) {
      return interaction.reply({
        content: '❌ I don\'t have the required permissions in that channel!\n\n' +
                 '**Missing permissions:**\n' +
                 missingPermissions.map(p => `• ${Object.keys(PermissionFlagsBits).find(key => PermissionFlagsBits[key] === p)}`).join('\n'),
        flags: [64]
      });
    }

    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $set: { gearStorageChannelId: channel.id } },
      { upsert: true }
    );

    const embed = new EmbedBuilder()
      .setColor('#10B981')
      .setTitle('✅ Storage Channel Set')
      .setDescription(
        `Gear screenshots will now be stored in ${channel}\n\n` +
        '**What this means:**\n' +
        '• All new gear uploads will be saved to this channel\n' +
        '• Images stored here will never expire\n' +
        '• Do not delete messages from this channel!\n\n' +
        '**Tip:** Consider making this channel hidden from regular members.'
      )
      .addFields({
        name: 'Channel Info',
        value: `**Name:** ${channel.name}\n**ID:** ${channel.id}`,
        inline: false
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  if (action === 'clean_storage') {
    await interaction.deferReply({ flags: [64] });

    try {
      const storageInfo = await getStorageChannelInfo(interaction.guild);

      if (!storageInfo) {
        return interaction.editReply({
          content: '❌ No storage channel found. Gear screenshots will be stored automatically when users upload them.'
        });
      }

      const playersWithGear = await partyPlayers.find({
        guildId: interaction.guildId,
        gearStorageMessageId: { $exists: true }
      }).toArray();

      if (playersWithGear.length === 0) {
        return interaction.editReply({
          content: '✅ No gear screenshots to clean up!'
        });
      }

      const ageOptions = interaction.options.getInteger('older_than_days') || 90;
      const cutoffDate = new Date(Date.now() - ageOptions * 24 * 60 * 60 * 1000);

      const oldPlayers = playersWithGear.filter(p => 
        p.gearScreenshotUpdatedAt && p.gearScreenshotUpdatedAt < cutoffDate
      );

      if (oldPlayers.length === 0) {
        return interaction.editReply({
          content: `✅ No gear screenshots older than ${ageOptions} days found.`
        });
      }

      const confirm = interaction.options.getBoolean('confirm');

      if (!confirm) {
        const embed = new EmbedBuilder()
          .setColor('#F59E0B')
          .setTitle('⚠️ Confirm Storage Cleanup')
          .setDescription(
            `This will delete **${oldPlayers.length}** gear screenshots older than **${ageOptions} days**.\n\n` +
            '**What will happen:**\n' +
            '• Old gear screenshot messages will be deleted\n' +
            '• Gear links will be removed from the database\n' +
            '• Users will need to re-upload their gear\n\n' +
            '**This action cannot be undone!**'
          )
          .addFields(
            {
              name: '📊 Storage Info',
              value: 
                `**Total stored:** ${playersWithGear.length} screenshots\n` +
                `**To be deleted:** ${oldPlayers.length} screenshots\n` +
                `**Will remain:** ${playersWithGear.length - oldPlayers.length} screenshots`,
              inline: false
            }
          )
          .setTimestamp();

        return interaction.editReply({ 
          embeds: [embed],
          content: '⚠️ **Preview mode** - Add `confirm:True` to actually delete these screenshots.'
        });
      }

      let deletedCount = 0;
      let failedCount = 0;

      for (const player of oldPlayers) {
        const success = await deleteFromDiscordStorage(
          interaction.guild,
          player.gearStorageChannelId,
          player.gearStorageMessageId
        );

        if (success) {
          deletedCount++;
          await partyPlayers.updateOne(
            { _id: player._id },
            { 
              $unset: { 
                gearStorageMessageId: '',
                gearStorageChannelId: '',
                gearScreenshotUrl: '',
                gearScreenshotSource: ''
              }
            }
          );
        } else {
          failedCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const resultEmbed = new EmbedBuilder()
        .setColor('#10B981')
        .setTitle('✅ Storage Cleanup Complete')
        .setDescription(
          `Successfully cleaned up old gear screenshots!\n\n` +
          `**Results:**\n` +
          `• ✅ Deleted: **${deletedCount}** screenshots\n` +
          `• ❌ Failed: **${failedCount}** screenshots\n` +
          `• 📦 Remaining: **${playersWithGear.length - deletedCount}** screenshots`
        )
        .setTimestamp();

      return interaction.editReply({ 
        embeds: [resultEmbed],
        content: null
      });

    } catch (err) {
      console.error('Error cleaning storage:', err);
      return interaction.editReply({
        content: '❌ Failed to clean storage. Check bot logs for details.'
      });
    }
  }

  if (action === 'info') {
    await interaction.deferReply({ flags: [64] });

    try {
      const storageInfo = await getStorageChannelInfo(interaction.guild);
      const settings = await guildSettings.findOne({ guildId: interaction.guildId });

      const playersWithGear = await partyPlayers.countDocuments({
        guildId: interaction.guildId,
        gearStorageMessageId: { $exists: true }
      });

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Gear System Information')
        .setTimestamp();

      if (settings?.gearCheckChannelId) {
        embed.addFields({
          name: '📋 Gear Check Channel',
          value: `<#${settings.gearCheckChannelId}>\nWhere gear check threads are created`,
          inline: false
        });
      } else {
        embed.addFields({
          name: '⚠️ Gear Check Channel',
          value: 'Not set - use `/gearcheck action:Set Channel`',
          inline: false
        });
      }

      if (storageInfo) {
        embed.addFields(
          {
            name: '📁 Storage Channel',
            value: 
              `**Name:** ${storageInfo.name}\n` +
              `**ID:** ${storageInfo.id}\n` +
              `**Created:** <t:${Math.floor(storageInfo.createdAt.getTime() / 1000)}:R>`,
            inline: false
          },
          {
            name: '📸 Stored Screenshots',
            value: `**Total:** ${playersWithGear} gear screenshots`,
            inline: true
          }
        );
      } else {
        embed.addFields({
          name: '📁 Storage Channel',
          value: 'Will be created automatically on first upload',
          inline: false
        });
      }

      if (settings?.gearStorageChannelId) {
        embed.addFields({
          name: '⚙️ Custom Storage',
          value: `<#${settings.gearStorageChannelId}>`,
          inline: false
        });
      }

      embed.setDescription(
        '**Available Commands:**\n' +
        '• `/gearcheck action:Set Channel` - Set gear check threads channel\n' +
        '• `/gearcheck action:Set Storage Channel` - Set custom storage channel\n' +
        '• `/gearcheck action:Clean Old Storage` - Remove old screenshots\n' +
        '• `/gearcheck action:Storage Info` - View this information'
      );

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error getting storage info:', err);
      return interaction.editReply({
        content: '❌ Failed to get storage information.'
      });
    }
  }
}

module.exports = { handleGearCheck };