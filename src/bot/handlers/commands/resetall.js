const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { cancelUserTokenRegenerations } = require('../../tokenRegeneration');
const { getClient } = require('../../../db/mongo');
const { scheduleLiveSummaryUpdate } = require('../../liveSummary');

async function handleResetAll({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to reset all wishlists.', flags: [64] });
  }

  const role = interaction.options.getRole('role');

  // Get confirmation first
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_reset_all_yes:${role.id}`)
      .setLabel('Yes, reset everyone')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚠️'),
    new ButtonBuilder()
      .setCustomId('confirm_reset_all_no')
      .setLabel('No, cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  // Count affected users
  await interaction.guild.members.fetch();
  const membersWithRole = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id) && !m.user.bot);

  return interaction.reply({
    content: `⚠️ **WARNING**: This will reset **${membersWithRole.size} user(s)** with the **${role.name}** role.\n\n` +
             `This will:\n` +
             `• Clear all their wishlists\n` +
             `• Unlock them for editing\n` +
             `• Reset all tokens to default (1/4/1)\n` +
             `• Cancel all pending token regenerations\n` +
             `• Clear all handed-out records\n\n` +
             `**This action cannot be undone!**`,
    components: [row],
    flags: [64]
  });
}

async function handleResetAllConfirmation({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.update({ content: '❌ You need administrator permissions.', components: [] });
  }

  if (interaction.customId === 'confirm_reset_all_no') {
    return interaction.update({ content: '❎ Bulk reset cancelled. No changes made.', components: [] });
  }

  // Extract role ID from customId
  const roleId = interaction.customId.split(':')[1];

  await interaction.deferUpdate();

  // Get all members with the role
  await interaction.guild.members.fetch();
  const membersWithRole = interaction.guild.members.cache.filter(m => m.roles.cache.has(roleId) && !m.user.bot);

  if (membersWithRole.size === 0) {
    return interaction.editReply({ 
      content: '❌ No users found with that role.', 
      components: [] 
    });
  }

  const userIds = membersWithRole.map(m => m.id);

  // Use transactions for atomicity
  const client = getClient();
  const session = client.startSession();

  let resetCount = 0;
  let cancelledRegens = 0;
  let handedOutCleared = 0;

  try {
    await session.withTransaction(async () => {
      // Cancel all pending token regenerations for these users
      for (const userId of userIds) {
        const cancelled = await cancelUserTokenRegenerations(
          userId, 
          interaction.guildId, 
          collections
        );
        cancelledRegens += cancelled;
      }

      // Remove all handed-out records for these users
      const handedOutResult = await handedOut.deleteMany({
        guildId: interaction.guildId,
        userId: { $in: userIds }
      }, { session });
      handedOutCleared = handedOutResult.deletedCount;

      // Reset all wishlists
      const resetResult = await wishlists.updateMany(
        { 
          userId: { $in: userIds }, 
          guildId: interaction.guildId 
        },
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

      resetCount = resetResult.modifiedCount;
    });
  } catch (err) {
    console.error('Transaction failed during bulk reset:', err);
    return interaction.editReply({ 
      content: '❌ Failed to reset users. Please try again.', 
      components: [] 
    });
  } finally {
    await session.endSession();
  }

  // Update live summary after reset
  await scheduleLiveSummaryUpdate(interaction, collections);

  let message = `✅ **Bulk reset complete!**\n\n`;
  message += `• Reset ${resetCount} wishlist(s)\n`;
  message += `• All users moved to "Not Submitted" status\n`;
  message += `• All tokens reset to default (1 weapon, 4 armor, 1 accessory)\n`;

  if (cancelledRegens > 0) {
    message += `• Cancelled ${cancelledRegens} pending token regeneration(s)\n`;
  }

  if (handedOutCleared > 0) {
    message += `• Cleared ${handedOutCleared} handed-out record(s)`;
  }

  return interaction.editReply({ content: message, components: [] });
}

module.exports = { handleResetAll, handleResetAllConfirmation };