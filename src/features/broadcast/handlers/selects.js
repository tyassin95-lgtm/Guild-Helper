const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ChannelType } = require('discord.js');
const { saveConfig } = require('../broadcastSession');

async function handleBroadcastSelects({ interaction, collections }) {
  if (interaction.customId === 'broadcast_select_source') {
    await interaction.deferUpdate();

    const sourceChannelId = interaction.values[0];
    const sourceChannel = interaction.guild.channels.cache.get(sourceChannelId);

    // Get all voice channels except the source
    const voiceChannels = interaction.guild.channels.cache.filter(
      c => c.type === ChannelType.GuildVoice && c.id !== sourceChannelId
    );

    if (voiceChannels.size === 0) {
      return interaction.editReply({
        content: '❌ No other voice channels available to broadcast to.',
        embeds: [],
        components: []
      });
    }

    const targetOptions = voiceChannels.map(channel => ({
      label: `🎯 ${channel.name}`,
      value: channel.id,
      description: `${channel.members.size} members currently in channel`
    }));

    const targetSelect = new StringSelectMenuBuilder()
      .setCustomId('broadcast_select_targets')
      .setPlaceholder('Select target channels (1-25)')
      .setMinValues(1)
      .setMaxValues(Math.min(25, targetOptions.length))
      .setOptions(targetOptions.slice(0, 25));

    const row = new ActionRowBuilder().addComponents(targetSelect);

    const embed = {
      title: '🎙️ Broadcast Setup',
      description: `**Source Channel:** ${sourceChannel.name}\n\n**Step 2:** Select one or more target channels to broadcast to.`,
      color: 0x5865F2,
      footer: { text: 'Select target channels below' }
    };

    // Store source channel in a temporary database record
    await collections.broadcastConfigs.updateOne(
      { guildId: interaction.guildId, configName: '_temp_setup' },
      { 
        $set: { 
          sourceChannelId,
          createdBy: interaction.user.id,
          createdAt: new Date(),
          isTemp: true
        } 
      },
      { upsert: true }
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  }

  if (interaction.customId === 'broadcast_select_targets') {
    await interaction.deferUpdate();

    const targetChannelIds = interaction.values;

    // Get source channel from temporary config
    const tempConfig = await collections.broadcastConfigs.findOne({
      guildId: interaction.guildId,
      configName: '_temp_setup',
      isTemp: true
    });

    if (!tempConfig) {
      return interaction.editReply({
        content: '❌ Setup session expired. Please start over with `/broadcast setup`.',
        embeds: [],
        components: []
      });
    }

    const sourceChannelId = tempConfig.sourceChannelId;
    const sourceChannel = interaction.guild.channels.cache.get(sourceChannelId);

    if (!sourceChannel) {
      return interaction.editReply({
        content: '❌ Source channel not found. Please start over.',
        embeds: [],
        components: []
      });
    }

    const targetNames = targetChannelIds
      .map(id => interaction.guild.channels.cache.get(id)?.name)
      .filter(Boolean)
      .join('\n• ');

    // Create a short hash for the customId instead of full channel IDs
    const configHash = Date.now().toString(36);

    // Save the configuration with the hash
    await collections.broadcastConfigs.updateOne(
      { guildId: interaction.guildId, configName: `_pending_${configHash}` },
      { 
        $set: { 
          sourceChannelId,
          targetChannelIds,
          createdBy: interaction.user.id,
          createdAt: new Date(),
          isTemp: true
        } 
      },
      { upsert: true }
    );

    const confirmButton = new ButtonBuilder()
      .setCustomId(`broadcast_start_confirm:${configHash}`)
      .setLabel('Start Broadcast')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📡');

    const cancelButton = new ButtonBuilder()
      .setCustomId('broadcast_start_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const embed = {
      title: '🎙️ Broadcast Configuration',
      description: 'Review your broadcast setup and click **Start Broadcast** to begin.',
      color: 0x5865F2,
      fields: [
        {
          name: '📻 Source Channel',
          value: sourceChannel.name,
          inline: true
        },
        {
          name: '🎯 Target Channels',
          value: `${targetChannelIds.length} channel(s)`,
          inline: true
        },
        {
          name: '📋 Target Channel List',
          value: `• ${targetNames}`,
          inline: false
        }
      ],
      footer: { text: 'All audio from source will be broadcast to targets in real-time' }
    };

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  }
}

module.exports = { handleBroadcastSelects };