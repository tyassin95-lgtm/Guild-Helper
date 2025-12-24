// Handler for /freezewishlists command
const { PermissionFlagsBits } = require('discord.js');
const { updateWishlistPanels } = require('./wishlists');

async function handleFreezeWishlists({ interaction, collections, client }) {
  const { wishlistSettings } = collections;

  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to use this command.',
      flags: [64]
    });
  }

  // Get action from options
  const action = interaction.options.getString('action');
  if (!action || (action !== 'on' && action !== 'off')) {
    return interaction.reply({
      content: '❌ Please specify `on` or `off`.',
      flags: [64]
    });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    const frozen = action === 'on';

    // Update settings
    await wishlistSettings.updateOne(
      { guildId: interaction.guildId },
      {
        $set: {
          frozen,
          lastModified: new Date()
        }
      },
      { upsert: true }
    );

    // Update wishlist panels to show frozen status
    await updateWishlistPanels({
      client,
      guildId: interaction.guildId,
      collections
    });

    if (frozen) {
      await interaction.editReply({
        content: '🔒 **Wishlists have been frozen.**\n\nUsers can no longer submit or modify their wishlists until unfrozen.'
      });
    } else {
      await interaction.editReply({
        content: '🔓 **Wishlists have been unfrozen.**\n\nUsers can now submit and modify their wishlists.'
      });
    }

  } catch (error) {
    console.error('Error updating freeze status:', error);
    await interaction.editReply({
      content: '❌ An error occurred while updating the freeze status. Please try again.'
    });
  }
}

module.exports = {
  handleFreezeWishlists
};