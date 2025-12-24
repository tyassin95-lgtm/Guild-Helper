// Handler for /resetuserwishlist command
const { PermissionFlagsBits } = require('discord.js');
const { updateWishlistPanels } = require('./wishlists');
const { safeSendDM } = require('../../../utils/safeExecute');

async function handleResetUserWishlist({ interaction, collections, client }) {
  const { wishlistSubmissions, wishlistGivenItems } = collections;

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

    // Check if user has received items
    const receivedItems = await wishlistGivenItems.find({
      userId: targetUser.id,
      guildId: interaction.guildId
    }).toArray();

    const hasReceivedItems = receivedItems.length > 0;

    if (!existingWishlist && !hasReceivedItems) {
      return interaction.editReply({
        content: `❌ **${targetUser.tag}** does not have a submitted wishlist or any received items.`
      });
    }

    let resetMessage = '';

    // Both reset types work the same way now - only delete the submission
    // Given items are NEVER deleted as they're historical distribution records
    if (!existingWishlist) {
      return interaction.editReply({
        content: `❌ **${targetUser.tag}** does not have a submitted wishlist to reset.${hasReceivedItems ? `\n\nThey have ${receivedItems.length} received item(s) on record which will remain visible in the wishlist panel.` : ''}`
      });
    }

    await wishlistSubmissions.deleteOne({
      userId: targetUser.id,
      guildId: interaction.guildId
    });

    if (hasReceivedItems) {
      resetMessage = `📋 **Wishlist Reset Notification**\n\nYour wishlist in **${interaction.guild.name}** has been reset by an administrator.\n\n✅ **Your ${receivedItems.length} previously received item(s) are preserved.** You can only modify items you haven't received yet.\n\nYou can now update your wishlist using the \`/mywishlist\` command.`;
    } else {
      resetMessage = `📋 **Wishlist Reset Notification**\n\nYour wishlist in **${interaction.guild.name}** has been reset by an administrator.\n\nYou can now submit a new wishlist using the \`/mywishlist\` command.`;
    }

    // Update wishlist panels
    await updateWishlistPanels({
      client,
      guildId: interaction.guildId,
      collections
    });

    // Send DM to user
    const dmSent = await safeSendDM(targetUser, {
      content: resetMessage
    });

    let responseMessage = `✅ **Wishlist reset successfully!**\n\n**User:** ${targetUser.tag}\n`;

    if (hasReceivedItems) {
      responseMessage += `**Received Items (preserved in panel):** ${receivedItems.length}\n`;
    }

    responseMessage += `**DM Notification:** ${dmSent ? 'Sent ✅' : 'Failed (DMs disabled) ❌'}\n\nThe wishlist panels have been updated.`;

    if (hasReceivedItems) {
      responseMessage += `\n\n*Note: Received items remain visible in the wishlist panel as historical records.*`;
    }

    await interaction.editReply({
      content: responseMessage
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