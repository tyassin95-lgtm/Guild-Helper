// Handler for /resetuserwishlist command
const { PermissionFlagsBits } = require('discord.js');
const { updateWishlistPanels } = require('./wishlists');
const { safeSendDM } = require('../../../utils/safeExecute');

async function handleResetUserWishlist({ interaction, collections, client }) {
  const { wishlistSubmissions } = collections;

  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to use this command.',
      flags: [64]
    });
  }

  // Get target user from options
  const targetUser = interaction.options.getUser('user');
  if (!targetUser) {
    return interaction.reply({
      content: '❌ Please specify a user to reset.',
      flags: [64]
    });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    // Check if user has a wishlist
    const existingWishlist = await wishlistSubmissions.findOne({
      userId: targetUser.id,
      guildId: interaction.guildId
    });

    if (!existingWishlist) {
      return interaction.editReply({
        content: `❌ **${targetUser.tag}** does not have a submitted wishlist.`
      });
    }

    // Delete the wishlist
    await wishlistSubmissions.deleteOne({
      userId: targetUser.id,
      guildId: interaction.guildId
    });

    // Update wishlist panels
    await updateWishlistPanels({
      client,
      guildId: interaction.guildId,
      collections
    });

    // Send DM to user
    const dmSent = await safeSendDM(targetUser, {
      content: `📋 **Wishlist Reset Notification**\n\nYour wishlist in **${interaction.guild.name}** has been reset by an administrator.\n\nYou can now submit a new wishlist using the \`/mywishlist\` command.`
    });

    await interaction.editReply({
      content: `✅ **Wishlist reset successfully!**\n\n**User:** ${targetUser.tag}\n**DM Notification:** ${dmSent ? 'Sent ✅' : 'Failed (DMs disabled) ❌'}\n\nThe wishlist panels have been updated.`
    });

  } catch (error) {
    console.error('Error resetting user wishlist:', error);
    await interaction.editReply({
      content: '❌ An error occurred while resetting the wishlist. Please try again.'
    });
  }
}

module.exports = {
  handleResetUserWishlist
};