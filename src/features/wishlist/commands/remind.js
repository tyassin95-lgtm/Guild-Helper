const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

async function handleRemind({ interaction, collections }) {
  const { wishlists, guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const excludedRoles = settings?.excludedRoles || [];

  await interaction.guild.members.fetch();

  const humans = interaction.guild.members.cache.filter(m => {
    if (m.user.bot) return false;

    if (excludedRoles.length > 0) {
      const hasExcludedRole = m.roles.cache.some(role => excludedRoles.includes(role.id));
      if (hasExcludedRole) return false;
    }

    return true;
  });

  const finalized = await wishlists.find({ guildId: interaction.guildId, finalized: true }).toArray();
  const finalizedIds = new Set(finalized.map(w => w.userId));

  const notSubmitted = humans.filter(m => !finalizedIds.has(m.id));

  if (notSubmitted.size === 0) {
    let message = '✅ All members have already submitted their wishlists!';

    if (excludedRoles.length > 0) {
      const roleNames = [];
      for (const roleId of excludedRoles) {
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (role) roleNames.push(role.name);
      }

      if (roleNames.length > 0) {
        message += `\n\n*Excluding members with: ${roleNames.join(', ')}*`;
      }
    }

    return interaction.editReply({ content: message });
  }

  await interaction.editReply({ 
    content: `🔄 **Processing reminders...**\n\nSending DMs to **${notSubmitted.size}** user(s) who haven't submitted.\nThis may take a while. You'll receive a follow-up when complete.` 
  });

  const reminderEmbed = new EmbedBuilder()
    .setColor('#e67e22')
    .setTitle('⏰ Wishlist Reminder')
    .setDescription(
      `Hello! This is a friendly reminder from **${interaction.guild.name}**.\n\n` +
      `You haven't submitted your wishlist yet! Please take a moment to finalize your selections.\n\n` +
      `**How to submit:**\n` +
      `1. Use the \`/mywishlist\` command in the server\n` +
      `2. Add your desired items using the buttons\n` +
      `3. Click "Finalize Wishlist" when done\n\n` +
      `Thank you for your cooperation! 🎯`
    )
    .setFooter({ text: `Message sent by ${interaction.user.tag}` })
    .setTimestamp();

  let successCount = 0;
  let failCount = 0;
  const failedUsers = [];

  for (const member of notSubmitted.values()) {
    try {
      await member.send({ embeds: [reminderEmbed] });
      successCount++;

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      failCount++;
      failedUsers.push(member.displayName);
      console.error(`Failed to DM ${member.user.tag}:`, err.message);
    }
  }

  let response = `📨 **Reminder complete!**\n\n`;
  response += `✅ Successfully sent to: **${successCount}** user(s)\n`;

  if (failCount > 0) {
    response += `❌ Failed to send to: **${failCount}** user(s)\n\n`;
    response += `**Failed users (DMs may be disabled):**\n`;
    response += failedUsers.slice(0, 10).map(name => `• ${name}`).join('\n');

    if (failedUsers.length > 10) {
      response += `\n... and ${failedUsers.length - 10} more`;
    }
  }

  if (excludedRoles.length > 0) {
    const roleNames = [];
    for (const roleId of excludedRoles) {
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (role) roleNames.push(role.name);
    }

    if (roleNames.length > 0) {
      response += `\n\n*Excluded roles from reminders: ${roleNames.join(', ')}*`;
    }
  }

  return interaction.followUp({ content: response, flags: [64] });
}

module.exports = { handleRemind };