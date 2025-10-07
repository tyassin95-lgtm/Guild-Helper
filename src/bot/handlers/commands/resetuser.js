const { PermissionFlagsBits } = require('discord.js');
const { cancelUserTokenRegenerations } = require('../../tokenRegeneration');
const { getClient } = require('../../../db/mongo');
const { scheduleLiveSummaryUpdate } = require('../../liveSummary');

async function handleResetUser({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to reset wishlists.', flags: [64] });
  }

  const targetUser = interaction.options.getUser('user');

  // Use transactions to ensure atomicity
  const client = getClient();
  const session = client.startSession();

  let result;
  let cancelledRegens = 0;
  let handedOutCount = 0;

  try {
    await session.withTransaction(async () => {
      // Cancel all pending token regenerations for this user FIRST
      cancelledRegens = await cancelUserTokenRegenerations(
        targetUser.id, 
        interaction.guildId, 
        collections
      );

      // Remove all handed-out records for this user
      const handedOutResult = await handedOut.deleteMany({
        guildId: interaction.guildId,
        userId: targetUser.id
      }, { session });
      handedOutCount = handedOutResult.deletedCount;

      // Reset wishlist to completely fresh state LAST
      result = await wishlists.updateOne(
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
        },
        { session }
      );
    });
  } catch (err) {
    console.error('Transaction failed during reset:', err);
    return interaction.reply({ 
      content: '❌ Failed to reset user. Please try again.', 
      flags: [64] 
    });
  } finally {
    await session.endSession();
  }

  if (result.matchedCount === 0) {
    return interaction.reply({ content: '❌ User has no wishlist.', flags: [64] });
  }

  // Update live summary after reset
  await scheduleLiveSummaryUpdate(interaction, collections);

  let message = `✅ ${targetUser.tag} has been completely reset:\n`;
  message += `• Wishlist cleared and unlocked for editing\n`;
  message += `• Moved back to "Not Submitted" status\n`;
  message += `• All tokens reset to default (1 weapon, 4 armor, 1 accessory)\n`;

  if (cancelledRegens > 0) {
    message += `• Cancelled ${cancelledRegens} pending token regeneration(s)\n`;
  }

  if (handedOutCount > 0) {
    message += `• Cleared ${handedOutCount} handed-out record(s)`;
  }

  return interaction.reply({ content: message, flags: [64] });
}

module.exports = { handleResetUser };