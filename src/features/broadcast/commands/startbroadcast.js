const { EmbedBuilder } = require('discord.js');
const { broadcastManager } = require('../utils/broadcastManager');
const { createSession, getBroadcastUsers } = require('../db/broadcastDb');

async function handleStartBroadcast({ interaction, collections, client }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;
  const sourceChannel = interaction.options.getChannel('source_channel');

  try {
    if (broadcastManager.isActive(guildId)) {
      return interaction.editReply({
        content: '❌ A broadcast is already active! Use `/stopbroadcast` first.'
      });
    }

    const broadcastUsers = await getBroadcastUsers(collections, guildId);
    if (broadcastUsers.length === 0) {
      return interaction.editReply({
        content: '❌ No users configured for broadcasting! Use `/addbroadcaster` first.'
      });
    }

    const userIds = broadcastUsers.map(u => u.userId);

    // Start broadcast and get stream URL
    const streamUrl = await broadcastManager.startBroadcast(
      client,
      collections,
      guildId,
      sourceChannel.id,
      userIds
    );

    // Save to database
    await createSession(collections, guildId, sourceChannel.id, streamUrl);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎙️ Broadcast Started')
      .setDescription(`Broadcasting from **${sourceChannel.name}**`)
      .addFields(
        {
          name: '📡 Broadcasting Users',
          value: broadcastUsers.map(u => `• <@${u.userId}>`).join('\n'),
          inline: false
        },
        {
          name: '🌐 Stream URL',
          value: `\`\`\`${streamUrl}\`\`\``,
          inline: false
        },
        {
          name: '🎵 How to Use',
          value: 'Copy the stream URL above and use it with your music bot to play in multiple channels.',
          inline: false
        }
      )
      .setFooter({ text: 'Use /stopbroadcast to end the stream' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('[StartBroadcast] Error:', err);
    await interaction.editReply({
      content: `❌ Failed to start broadcast: ${err.message}`
    });
  }
}

module.exports = { handleStartBroadcast };