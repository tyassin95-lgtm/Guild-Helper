const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

async function handleRemind({ interaction, collections }) {
  const { wishlists } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  // Fetch all guild members
  await interaction.guild.members.fetch();
  const humans = interaction.guild.members.cache.filter(m => !m.user.bot);

  // Get all finalized wishlists
  const finalized = await wishlists.find({ guildId: interaction.guildId, finalized: true }).toArray();
  const finalizedIds = new Set(finalized.map(w => w.userId));

  // Find users who haven't submitted
  const notSubmitted = humans.filter(m => !finalizedIds.has(m.id));

  if (notSubmitted.size === 0) {
    return interaction.editReply({
      content: '✅ All members have already submitted their wishlists!',
      flags: [64]
    });
  }

  // Prepare reminder embed
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

  // Send DMs with delay
  let successCount = 0;
  let failCount = 0;
  const failedUsers = [];

  for (const member of notSubmitted.values()) {
    try {
      await member.send({ embeds: [reminderEmbed] });
      successCount++;

      // Delay between DMs (1 second) to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      failCount++;
      failedUsers.push(member.displayName);
      console.error(`Failed to DM ${member.user.tag}:`, err.message);
    }
  }

  // Build response
  let response = `📨 **Reminder sent!**\n\n`;
  response += `✅ Successfully sent to: **${successCount}** user(s)\n`;

  if (failCount > 0) {
    response += `❌ Failed to send to: **${failCount}** user(s)\n\n`;
    response += `**Failed users (DMs may be disabled):**\n`;
    response += failedUsers.slice(0, 10).map(name => `• ${name}`).join('\n');

    if (failedUsers.length > 10) {
      response += `\n... and ${failedUsers.length - 10} more`;
    }
  }

  return interaction.editReply({ content: response });
}

module.exports = { handleRemind };