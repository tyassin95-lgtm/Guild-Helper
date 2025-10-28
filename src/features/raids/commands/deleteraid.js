const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { ObjectId } = require('mongodb');

async function handleDeleteRaid({ interaction, collections }) {
  const { raidEvents } = collections;

  await interaction.deferReply({ flags: [64] });

  // Get the message this command was used in (or nearby messages)
  const channel = interaction.channel;

  // Fetch recent messages to find raid events
  const messages = await channel.messages.fetch({ limit: 50 });

  const raidMessages = [];
  for (const msg of messages.values()) {
    if (msg.author.id === interaction.client.user.id) {
      const raidEvent = await raidEvents.findOne({ messageId: msg.id, guildId: interaction.guildId });
      if (raidEvent) {
        raidMessages.push({ message: msg, event: raidEvent });
      }
    }
  }

  if (raidMessages.length === 0) {
    return interaction.editReply({
      content: '❌ No raid events found in this channel.'
    });
  }

  // Show list of raids to delete
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('Delete Raid Event')
    .setDescription('Select a raid event to delete from the buttons below:');

  const buttons = [];
  for (let i = 0; i < Math.min(raidMessages.length, 5); i++) {
    const { event } = raidMessages[i];
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`raid_delete_confirm:${event._id.toString()}`)
        .setLabel(`${event.name} - ${event.difficulty}`)
        .setStyle(ButtonStyle.Danger)
    );
  }

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  await interaction.editReply({
    embeds: [embed],
    components: rows
  });
}

async function handleDeleteConfirm({ interaction, collections }) {
  const { raidEvents } = collections;

  const raidId = interaction.customId.split(':')[1];

  await interaction.deferUpdate();

  const raidEvent = await raidEvents.findOne({ _id: new ObjectId(raidId), guildId: interaction.guildId });

  if (!raidEvent) {
    return interaction.editReply({
      content: '❌ Raid event not found.',
      embeds: [],
      components: []
    });
  }

  // Delete the raid message
  try {
    const channel = await interaction.client.channels.fetch(raidEvent.channelId);
    const message = await channel.messages.fetch(raidEvent.messageId);
    await message.delete();
  } catch (err) {
    console.error('Error deleting raid message:', err);
  }

  // Delete from database
  await raidEvents.deleteOne({ _id: new ObjectId(raidId) });

  await interaction.editReply({
    content: `✅ Deleted raid event: **${raidEvent.name}**`,
    embeds: [],
    components: []
  });
}

module.exports = { 
  handleDeleteRaid,
  handleDeleteConfirm
};