const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { ObjectId } = require('mongodb');

async function handleCloseRaid({ interaction, collections }) {
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

  // Show list of raids to close/reopen
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Close/Reopen Raid Event')
    .setDescription('Select a raid event to close or reopen from the buttons below:');

  const buttons = [];
  for (let i = 0; i < Math.min(raidMessages.length, 5); i++) {
    const { event } = raidMessages[i];
    const status = event.closed ? '[CLOSED]' : '[OPEN]';
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`raid_close_confirm:${event._id.toString()}`)
        .setLabel(`${status} ${event.name} - ${event.difficulty}`)
        .setStyle(event.closed ? ButtonStyle.Success : ButtonStyle.Secondary)
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

async function handleCloseConfirm({ interaction, collections }) {
  const { raidEvents } = collections;
  const { buildRaidEmbed } = require('../utils/raidEmbed');

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

  // Toggle closed status
  const newClosedStatus = !raidEvent.closed;

  await raidEvents.updateOne(
    { _id: new ObjectId(raidId) },
    { $set: { closed: newClosedStatus } }
  );

  // Update the raid message
  try {
    const channel = await interaction.client.channels.fetch(raidEvent.channelId);
    const message = await channel.messages.fetch(raidEvent.messageId);

    const updatedRaid = await raidEvents.findOne({ _id: new ObjectId(raidId) });
    const { embed, components } = await buildRaidEmbed(updatedRaid, collections, interaction.client);

    await message.edit({
      embeds: [embed],
      components
    });
  } catch (err) {
    console.error('Error updating raid message:', err);
  }

  await interaction.editReply({
    content: newClosedStatus 
      ? `🔒 Closed raid event: **${raidEvent.name}** - No more signups allowed.`
      : `🔓 Reopened raid event: **${raidEvent.name}** - Signups are now allowed.`,
    embeds: [],
    components: []
  });
}

module.exports = { 
  handleCloseRaid,
  handleCloseConfirm
};