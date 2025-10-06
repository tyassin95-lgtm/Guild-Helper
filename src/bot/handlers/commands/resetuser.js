const { PermissionFlagsBits } = require('discord.js');
const { cancelUserTokenRegenerations } = require('../../tokenRegeneration');

async function handleResetUser({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to reset wishlists.', ephemeral: true });
  }

  const targetUser = interaction.options.getUser('user');

  // Reset wishlist to completely fresh state
  const result = await wishlists.updateOne(
    { userId: targetUser.id, guildId: interaction.guildId },
    { 
      $set: { 
        finalized: false,
        weapons: [],
        armor: [],
        accessories: [],
        tokensUsed: { weapon: 0, armor: 0, accessory: 0 },
        tokenGrants: { weapon: 0, armor: 0, accessory: 0 },
        timestamps: {}
      } 
    }
  );

  if (result.matchedCount === 0) {
    return interaction.reply({ content: '❌ User has no wishlist.', ephemeral: true });
  }

  // Cancel all pending token regenerations for this user
  const cancelledRegens = await cancelUserTokenRegenerations(
    targetUser.id, 
    interaction.guildId, 
    collections
  );

  // Remove all handed-out records for this user
  const handedOutResult = await handedOut.deleteMany({
    guildId: interaction.guildId,
    userId: targetUser.id
  });

  let message = `✅ ${targetUser.tag} has been completely reset:\n`;
  message += `• Wishlist cleared and unlocked for editing\n`;
  message += `• Moved back to "Not Submitted" status\n`;
  message += `• All tokens reset to default (1 weapon, 4 armor, 1 accessory)\n`;

  if (cancelledRegens > 0) {
    message += `• Cancelled ${cancelledRegens} pending token regeneration(s)\n`;
  }

  if (handedOutResult.deletedCount > 0) {
    message += `• Cleared ${handedOutResult.deletedCount} handed-out record(s)`;
  }

  return interaction.reply({ content: message, ephemeral: true });
}

module.exports = { handleResetUser };