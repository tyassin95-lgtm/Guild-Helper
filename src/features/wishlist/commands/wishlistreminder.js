// Handler for /wishlistreminder command
const { PermissionFlagsBits } = require('discord.js');
const { safeSendDM } = require('../../../utils/safeExecute');

async function handleWishlistReminder({ interaction, collections }) {
  const { guildSettings, wishlistSubmissions } = collections;

  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to use this command.',
      flags: [64]
    });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    // Get excluded roles
    const settings = await guildSettings.findOne({ guildId: interaction.guildId });
    const excludedRoles = settings?.excludedRoles || [];

    // Fetch all guild members
    await interaction.guild.members.fetch();
    const allMembers = interaction.guild.members.cache;

    // Get all users who have submitted wishlists
    const submittedUsers = await wishlistSubmissions
      .find({ guildId: interaction.guildId })
      .toArray();

    const submittedUserIds = new Set(submittedUsers.map(s => s.userId));

    // Filter members who need reminders
    const needReminder = allMembers.filter(member => {
      // Skip bots
      if (member.user.bot) return false;

      // Skip if already submitted
      if (submittedUserIds.has(member.id)) return false;

      // Skip if has excluded role
      const memberRoleIds = member.roles.cache.map(r => r.id);
      if (memberRoleIds.some(roleId => excludedRoles.includes(roleId))) return false;

      return true;
    });

    if (needReminder.size === 0) {
      return interaction.editReply({
        content: '✅ **No reminders to send!**\n\nAll eligible members have already submitted their wishlists.'
      });
    }

    // Send reminders
    let successCount = 0;
    let failCount = 0;

    const reminderMessage = `📋 **Wishlist Reminder**\n\nHello! You haven't submitted your wishlist yet in **${interaction.guild.name}**.\n\nPlease use the \`/mywishlist\` command to set up your wishlist and help coordinate gear distribution.\n\nThank you! 🎯`;

    for (const [, member] of needReminder) {
      const dmSent = await safeSendDM(member.user, {
        content: reminderMessage
      });

      if (dmSent) {
        successCount++;
      } else {
        failCount++;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await interaction.editReply({
      content: `✅ **Wishlist reminders sent!**\n\n**Total eligible members:** ${needReminder.size}\n**Successfully sent:** ${successCount} ✅\n**Failed (DMs disabled):** ${failCount} ❌`
    });

  } catch (error) {
    console.error('Error sending wishlist reminders:', error);
    await interaction.editReply({
      content: '❌ An error occurred while sending reminders. Please try again.'
    });
  }
}

module.exports = {
  handleWishlistReminder
};