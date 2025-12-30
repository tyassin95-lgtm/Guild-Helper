const { EmbedBuilder } = require('discord.js');

/**
 * Create rob result embed
 */
function createRobEmbed(success, robber, target, amount, robberNewBalance, targetNewBalance) {
  let color, title, description;

  if (success) {
    color = 0x00FF00; // Green
    title = '💰 ROBBERY SUCCESSFUL!';
    description = 
      `${robber} successfully robbed ${target}!\n\n` +
      `**Stolen:** ${amount.toLocaleString()} coins\n\n` +
      `**${robber.username}'s Balance:** ${robberNewBalance.toLocaleString()} coins\n` +
      `**${target.username}'s Balance:** ${targetNewBalance.toLocaleString()} coins`;
  } else {
    color = 0xFF0000; // Red
    title = '🚨 CAUGHT BY POLICE!';
    description = 
      `${robber} tried to rob ${target} but got caught!\n\n` +
      `**Police Fine:** ${amount.toLocaleString()} coins\n\n` +
      `**${robber.username}'s Balance:** ${robberNewBalance.toLocaleString()} coins\n` +
      `**${target.username}'s Balance:** ${targetNewBalance.toLocaleString()} coins`;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: success ? '⏰ 1 hour cooldown before you can rob again' : '⏰ 1 hour cooldown | Better luck next time!' })
    .setTimestamp();

  return embed;
}

module.exports = {
  createRobEmbed
};