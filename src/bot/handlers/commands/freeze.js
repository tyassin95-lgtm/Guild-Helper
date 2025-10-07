const { PermissionFlagsBits } = require('discord.js');

async function handleFreeze({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const action = interaction.options.getString('action');

  if (action === 'freeze') {
    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $set: { finalizeFrozen: true, frozenAt: new Date() } },
      { upsert: true }
    );

    return interaction.reply({
      content: '❄️ **Wishlist finalization has been FROZEN!**\n\n' +
               '• Users cannot finalize their wishlists\n' +
               '• Users cannot add/remove items\n' +
               '• Use `/freeze action:unfreeze` when ready to allow changes again',
      flags: [64]
    });
  }

  if (action === 'unfreeze') {
    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $set: { finalizeFrozen: false, unfrozenAt: new Date() } },
      { upsert: true }
    );

    return interaction.reply({
      content: '✅ **Wishlist finalization has been UNFROZEN!**\n\n' +
               '• Users can now finalize their wishlists\n' +
               '• Users can add/remove items again',
      flags: [64]
    });
  }

  return interaction.reply({ content: 'Unknown action.', flags: [64] });
}

async function handleFreezeStatus({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const isFrozen = settings?.finalizeFrozen || false;

  if (isFrozen) {
    const frozenAt = settings.frozenAt ? new Date(settings.frozenAt).toLocaleString() : 'Unknown';
    return interaction.reply({
      content: `❄️ **Status: FROZEN**\n\nWishlists have been frozen since: ${frozenAt}\n\nUsers cannot make changes until unfrozen.`,
      flags: [64]
    });
  }

  const unfrozenAt = settings?.unfrozenAt ? new Date(settings.unfrozenAt).toLocaleString() : 'Never frozen';
  return interaction.reply({
    content: `✅ **Status: UNFROZEN**\n\nLast unfrozen: ${unfrozenAt}\n\nUsers can freely make changes to their wishlists.`,
    flags: [64]
  });
}

module.exports = { handleFreeze, handleFreezeStatus };