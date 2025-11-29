const { getAudioManager } = require('../utils/audioManager');
const { createSession } = require('../broadcastSession');

async function handleBroadcastButtons({ interaction, collections }) {
  const [action, ...params] = interaction.customId.split(':');

  if (action === 'broadcast_start_confirm') {
    await interaction.deferUpdate();

    const configHash = params[0];

    // Retrieve the configuration from database
    const config = await collections.broadcastConfigs.findOne({
      guildId: interaction.guildId,
      configName: `_pending_${configHash}`,
      isTemp: true
    });

    if (!config) {
      return interaction.editReply({
        content: '❌ Configuration expired. Please run `/broadcast setup` again.',
        embeds: [],
        components: []
      });
    }

    const sourceChannelId = config.sourceChannelId;
    const targetChannelIds = config.targetChannelIds;

    const guildId = interaction.guildId;
    const audioManager = getAudioManager(guildId);

    if (audioManager.isActive()) {
      return interaction.editReply({
        content: '❌ A broadcast is already active!',
        embeds: [],
        components: []
      });
    }

    try {
      await audioManager.startBroadcast(
        interaction.guild,
        sourceChannelId,
        targetChannelIds,
        { volume: 100 }
      );

      await createSession(
        collections,
        guildId,
        sourceChannelId,
        targetChannelIds,
        interaction.user.id
      );

      // Clean up temporary configs
      await collections.broadcastConfigs.deleteMany({
        guildId: interaction.guildId,
        isTemp: true
      });

      const sourceChannel = interaction.guild.channels.cache.get(sourceChannelId);
      const targetNames = targetChannelIds
        .map(id => interaction.guild.channels.cache.get(id)?.name)
        .filter(Boolean)
        .join(', ');

      await interaction.editReply({
        embeds: [{
          title: '✅ Broadcast Started',
          description: `Audio from **${sourceChannel.name}** is now being broadcast to ${targetChannelIds.length} channel(s).`,
          color: 0x57F287,
          fields: [
            {
              name: '📻 Source Channel',
              value: sourceChannel.name,
              inline: true
            },
            {
              name: '🎯 Target Channels',
              value: targetNames || 'None',
              inline: true
            }
          ],
          footer: { text: 'Use /broadcast stop to end the broadcast' }
        }],
        components: []
      });

    } catch (error) {
      console.error('Failed to start broadcast:', error);

      // Clean up temporary configs
      await collections.broadcastConfigs.deleteMany({
        guildId: interaction.guildId,
        isTemp: true
      });

      await interaction.editReply({
        content: `❌ Failed to start broadcast: ${error.message}\n\n⚠️ **Note:** Voice features may not work properly on Replit. This will work on an Ubuntu VM.`,
        components: []
      });
    }
  }

  if (action === 'broadcast_start_cancel') {
    // Clean up temporary configs
    await collections.broadcastConfigs.deleteMany({
      guildId: interaction.guildId,
      isTemp: true
    });

    await interaction.update({
      content: '❌ Broadcast setup cancelled.',
      embeds: [],
      components: []
    });
  }
}

module.exports = { handleBroadcastButtons };