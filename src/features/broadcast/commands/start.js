const { getAudioManager } = require('../utils/audioManager');
const { createSession, getConfig } = require('../broadcastSession');

async function handleBroadcastStart({ interaction, collections }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;
  const configName = interaction.options.getString('config');

  const audioManager = getAudioManager(guildId);

  // Check if already broadcasting
  if (audioManager.isActive()) {
    return interaction.editReply({
      content: '❌ A broadcast is already active! Use `/broadcast stop` first.'
    });
  }

  let sourceChannelId, targetChannelIds;

  if (configName) {
    // Load from saved config
    const config = await getConfig(collections, guildId, configName);

    if (!config) {
      return interaction.editReply({
        content: `❌ Configuration "${configName}" not found. Use \`/broadcast setup\` to create one.`
      });
    }

    sourceChannelId = config.sourceChannelId;
    targetChannelIds = config.targetChannelIds;

  } else {
    // Try to resume last session
    const session = await collections.broadcastSessions.findOne(
      { guildId },
      { sort: { startedAt: -1 } }
    );

    if (!session) {
      return interaction.editReply({
        content: '❌ No broadcast configuration found. Use `/broadcast setup` first.'
      });
    }

    sourceChannelId = session.sourceChannelId;
    targetChannelIds = session.targetChannelIds;
  }

  // Verify channels exist
  const sourceChannel = interaction.guild.channels.cache.get(sourceChannelId);
  if (!sourceChannel) {
    return interaction.editReply({
      content: '❌ Source channel no longer exists. Please run `/broadcast setup` again.'
    });
  }

  const validTargets = targetChannelIds.filter(id => 
    interaction.guild.channels.cache.has(id)
  );

  if (validTargets.length === 0) {
    return interaction.editReply({
      content: '❌ No valid target channels found. Please run `/broadcast setup` again.'
    });
  }

  try {
    // Start the broadcast
    await audioManager.startBroadcast(
      interaction.guild,
      sourceChannelId,
      validTargets,
      { volume: 100 }
    );

    // Save session to database
    await createSession(
      collections,
      guildId,
      sourceChannelId,
      validTargets,
      interaction.user.id
    );

    const targetNames = validTargets
      .map(id => interaction.guild.channels.cache.get(id)?.name)
      .filter(Boolean)
      .join(', ');

    await interaction.editReply({
      embeds: [{
        title: '✅ Broadcast Started',
        description: `Audio from **${sourceChannel.name}** is now being broadcast to ${validTargets.length} channel(s).`,
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
          },
          {
            name: '🔊 Volume',
            value: '100%',
            inline: true
          }
        ],
        footer: { text: 'Use /broadcast stop to end the broadcast' }
      }]
    });

  } catch (error) {
    console.error('Failed to start broadcast:', error);
    await interaction.editReply({
      content: `❌ Failed to start broadcast: ${error.message}`
    });
  }
}

module.exports = { handleBroadcastStart };