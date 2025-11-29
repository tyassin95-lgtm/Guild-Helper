const { ActionRowBuilder, StringSelectMenuBuilder, ChannelType, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

async function handleBroadcastSetup({ interaction, collections }) {
  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guildId;

  // Get all voice channels
  const voiceChannels = interaction.guild.channels.cache.filter(
    c => c.type === ChannelType.GuildVoice
  );

  if (voiceChannels.size < 2) {
    return interaction.editReply({
      content: '❌ You need at least 2 voice channels to set up a broadcast (1 source + 1 target).'
    });
  }

  const embed = {
    title: '🎙️ Broadcast Setup',
    description: 'Configure your audio broadcast system.\n\n**Step 1:** Select the source channel (where people will speak)\n**Step 2:** Select target channels (where audio will be broadcast to)',
    color: 0x5865F2,
    fields: [
      {
        name: '📻 How it works',
        value: 'All audio from the source channel will be relayed in real-time to all target channels. Perfect for announcements, events, or multi-room broadcasts.'
      }
    ],
    footer: { text: 'Use the dropdown below to select the source channel' }
  };

  // Create source channel selector
  const sourceOptions = voiceChannels.map(channel => ({
    label: `🔊 ${channel.name}`,
    value: channel.id,
    description: `${channel.members.size} members currently in channel`
  }));

  const sourceSelect = new StringSelectMenuBuilder()
    .setCustomId('broadcast_select_source')
    .setPlaceholder('Select source channel')
    .setOptions(sourceOptions.slice(0, 25)); // Discord limit

  const row = new ActionRowBuilder().addComponents(sourceSelect);

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

module.exports = { handleBroadcastSetup };