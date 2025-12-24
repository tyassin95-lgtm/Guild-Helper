// Handler for /wishlists command
const { PermissionFlagsBits } = require('discord.js');
const { buildWishlistPanels } = require('../utils/panelBuilder');

async function handleWishlists({ interaction, collections }) {
  const { wishlistSubmissions, wishlistPanels, wishlistSettings } = collections;

  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to use this command.',
      flags: [64]
    });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    // Get all submissions for this guild
    const submissions = await wishlistSubmissions
      .find({ guildId: interaction.guildId })
      .toArray();

    // Check if wishlists are frozen
    const wishlistConfig = await wishlistSettings.findOne({ guildId: interaction.guildId });
    const frozen = wishlistConfig?.frozen || false;

    // Build panel embeds
    const embeds = await buildWishlistPanels({
      submissions,
      guild: interaction.guild,
      frozen,
      collections
    });

    // Send all embeds as separate messages
    const messageIds = [];
    for (const embed of embeds) {
      const message = await interaction.channel.send({ embeds: [embed] });
      messageIds.push(message.id);
    }

    // Store panel information in database
    await wishlistPanels.updateOne(
      { guildId: interaction.guildId },
      {
        $set: {
          channelId: interaction.channelId,
          messageIds: messageIds,
          lastUpdated: new Date()
        }
      },
      { upsert: true }
    );

    await interaction.editReply({
      content: `✅ **Wishlist panel created successfully!**\n\n${messageIds.length} panel message${messageIds.length > 1 ? 's' : ''} posted.\n\nThe panel will automatically update when users submit their wishlists.`
    });

  } catch (error) {
    console.error('Error creating wishlist panel:', error);
    await interaction.editReply({
      content: '❌ An error occurred while creating the wishlist panel. Please try again.'
    });
  }
}

/**
 * Update all wishlist panels in a guild
 * @param {Object} params
 * @param {Client} params.client - Discord client
 * @param {string} params.guildId - Guild ID
 * @param {Object} params.collections - Database collections
 */
async function updateWishlistPanels({ client, guildId, collections }) {
  const { wishlistSubmissions, wishlistPanels, wishlistSettings } = collections;

  try {
    // Get panel info
    const panelInfo = await wishlistPanels.findOne({ guildId });
    if (!panelInfo) return; // No panel exists

    // Get guild
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    // Get channel
    const channel = await guild.channels.fetch(panelInfo.channelId).catch(() => null);
    if (!channel) {
      // Channel deleted, remove panel info
      await wishlistPanels.deleteOne({ guildId });
      return;
    }

    // Get all submissions
    const submissions = await wishlistSubmissions.find({ guildId }).toArray();

    // Check if wishlists are frozen
    const wishlistConfig = await wishlistSettings.findOne({ guildId });
    const frozen = wishlistConfig?.frozen || false;

    // Build new embeds
    const embeds = await buildWishlistPanels({
      submissions,
      guild,
      frozen,
      collections
    });

    // Delete old messages
    for (const messageId of panelInfo.messageIds) {
      try {
        const message = await channel.messages.fetch(messageId);
        await message.delete();
      } catch (err) {
        // Message already deleted or not found
      }
    }

    // Send new messages
    const newMessageIds = [];
    for (const embed of embeds) {
      const message = await channel.send({ embeds: [embed] });
      newMessageIds.push(message.id);
    }

    // Update panel info
    await wishlistPanels.updateOne(
      { guildId },
      {
        $set: {
          messageIds: newMessageIds,
          lastUpdated: new Date()
        }
      }
    );

  } catch (error) {
    console.error('Error updating wishlist panels:', error);
  }
}

module.exports = {
  handleWishlists,
  updateWishlistPanels
};