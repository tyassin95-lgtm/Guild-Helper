const { EmbedBuilder } = require('discord.js');

/**
 * Create transfer notification embed (for recipient)
 */
function createTransferEmbed(sender, amount, newBalance) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle('💸 COINS RECEIVED!')
    .setDescription(
      `${sender} sent you **${amount.toLocaleString()} coins**!\n\n` +
      `**Your New Balance:** ${newBalance.toLocaleString()} coins`
    )
    .setTimestamp();

  return embed;
}

/**
 * Create transfer confirmation embed
 */
function createTransferConfirmEmbed(sender, recipient, amount) {
  const embed = new EmbedBuilder()
    .setColor(0xFFD700) // Gold
    .setTitle('⚠️ CONFIRM TRANSFER')
    .setDescription(
      `You are about to send **${amount.toLocaleString()} coins** to ${recipient}.\n\n` +
      `This is a large transfer. Please confirm you want to proceed.`
    )
    .addFields(
      { name: 'From', value: sender.username, inline: true },
      { name: 'To', value: recipient.username, inline: true },
      { name: 'Amount', value: `${amount.toLocaleString()} coins`, inline: true }
    )
    .setFooter({ text: '⚠️ This action cannot be undone' });

  return embed;
}

/**
 * Create transfer receipt embed
 */
function createTransferReceiptEmbed(sender, recipient, amount, senderNewBalance, recipientNewBalance) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle('✅ TRANSFER COMPLETE')
    .setDescription(
      `Successfully sent **${amount.toLocaleString()} coins** to ${recipient}!`
    )
    .addFields(
      { name: `${sender.username}'s Balance`, value: `${senderNewBalance.toLocaleString()} coins`, inline: true },
      { name: `${recipient.username}'s Balance`, value: `${recipientNewBalance.toLocaleString()} coins`, inline: true }
    )
    .setFooter({ text: '💡 The recipient has been notified via DM' })
    .setTimestamp();

  return embed;
}

module.exports = {
  createTransferEmbed,
  createTransferConfirmEmbed,
  createTransferReceiptEmbed
};