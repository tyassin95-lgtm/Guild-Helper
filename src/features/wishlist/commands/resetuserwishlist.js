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

  // Get reset type (default to 'normal')
  const resetType = interaction.options.getString('reset_type') || 'normal';

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

    if (resetType === 'full') {
      // FULL RESET: Delete both wishlist submission AND given items
      if (existingWishlist) {
        await wishlistSubmissions.deleteOne({
          userId: targetUser.id,
          guildId: interaction.guildId
        });
      }

      if (hasReceivedItems) {
        await wishlistGivenItems.deleteMany({
          userId: targetUser.id,
          guildId: interaction.guildId
        });
      }

      resetMessage = `📋 **Full Wishlist Reset**\n\nYour wishlist and **all received items** in **${interaction.guild.name}** have been completely reset by an administrator.\n\nYou can now submit a brand new wishlist using the \`/mywishlist\` command.`;

    } else {
      // NORMAL RESET: Only delete wishlist submission, keep given items
      if (!existingWishlist) {
        return interaction.editReply({
          content: `❌ **${targetUser.tag}** does not have a submitted wishlist to reset.\n\nThey have ${receivedItems.length} received item(s) on record. Use \`reset_type: full\` to clear everything including received items.`
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

    let responseMessage = `✅ **Wishlist reset successfully!**\n\n**User:** ${targetUser.tag}\n**Reset Type:** ${resetType === 'full' ? 'Full (including received items)' : 'Normal (preserves received items)'}\n`;

    if (resetType === 'normal' && hasReceivedItems) {
      responseMessage += `**Received Items Preserved:** ${receivedItems.length}\n`;
    }

    if (resetType === 'full' && hasReceivedItems) {
      responseMessage += `**Received Items Deleted:** ${receivedItems.length}\n`;
    }

    responseMessage += `**DM Notification:** ${dmSent ? 'Sent ✅' : 'Failed (DMs disabled) ❌'}\n\nThe wishlist panels have been updated.`;

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