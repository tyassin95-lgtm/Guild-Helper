// Core update logic for raid panels
// Currently not needed since we update directly in button handlers
// But keeping this file for future enhancements like auto-cleanup, reminders, etc.

async function updateRaidPanel(raidId, collections, client) {
  const { raidEvents } = collections;
  const { buildRaidEmbed } = require('./utils/raidEmbed');

  const raidEvent = await raidEvents.findOne({ _id: raidId });
  if (!raidEvent) return;

  try {
    const channel = await client.channels.fetch(raidEvent.channelId);
    const message = await channel.messages.fetch(raidEvent.messageId);

    const { embed, components } = await buildRaidEmbed(raidEvent, collections, client);

    await message.edit({
      embeds: [embed],
      components
    });
  } catch (err) {
    console.error('Error updating raid panel:', err);
  }
}

module.exports = { updateRaidPanel };