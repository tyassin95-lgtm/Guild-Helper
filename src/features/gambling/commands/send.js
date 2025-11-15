const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getBalance, subtractBalance, addBalance } = require('../utils/balanceManager');
const { createTransferEmbed, createTransferConfirmEmbed, createTransferReceiptEmbed } = require('../embeds/transferEmbeds');

const MIN_TRANSFER = 10;
const MAX_TRANSFER = 50000;
const CONFIRM_THRESHOLD = 5000; // Amounts >= this require confirmation

async function handleSend({ interaction, collections }) {
  const senderId = interaction.user.id;
  const targetUser = interaction.options.getUser('user');
  const targetId = targetUser.id;
  const amount = interaction.options.getInteger('amount');
  const guildId = interaction.guildId;

  // Fast validations before defer
  if (targetId === senderId) {
    return interaction.reply({
      content: '❌ You can\'t send coins to yourself!',
      flags: [64]
    });
  }

  if (targetUser.bot) {
    return interaction.reply({
      content: '❌ You can\'t send coins to bots!',
      flags: [64]
    });
  }

  if (amount < MIN_TRANSFER) {
    return interaction.reply({
      content: `❌ Minimum transfer amount is **${MIN_TRANSFER} coins**.`,
      flags: [64]
    });
  }

  if (amount > MAX_TRANSFER) {
    return interaction.reply({
      content: `❌ Maximum transfer amount is **${MAX_TRANSFER.toLocaleString()} coins** per transaction.`,
      flags: [64]
    });
  }

  // Defer for DB operations
  await interaction.deferReply();

  // Check sender's balance
  const senderBalance = await getBalance({ userId: senderId, guildId, collections });

  if (senderBalance.balance < amount) {
    return interaction.editReply({
      content: `❌ Insufficient balance! You have **${senderBalance.balance.toLocaleString()} coins** but tried to send **${amount.toLocaleString()} coins**.`
    });
  }

  // If amount is large, require confirmation
  if (amount >= CONFIRM_THRESHOLD) {
    const confirmEmbed = createTransferConfirmEmbed(interaction.user, targetUser, amount);

    const confirmButton = new ButtonBuilder()
      .setCustomId(`send_confirm:${targetId}:${amount}`)
      .setLabel('✅ Confirm Transfer')
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId(`send_cancel`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    return interaction.editReply({
      embeds: [confirmEmbed],
      components: [row]
    });
  }

  // Small amounts don't need confirmation - process immediately
  await processTransfer({
    interaction,
    collections,
    senderId,
    targetUser,
    amount,
    guildId,
    isEdit: true
  });
}

async function handleSendConfirmation({ interaction, collections }) {
  const [_, action, targetId, amountStr] = interaction.customId.split(':');

  if (action === 'cancel') {
    return interaction.update({
      content: '❌ Transfer cancelled.',
      embeds: [],
      components: []
    });
  }

  // Verify it's the same user who initiated
  const senderId = interaction.user.id;
  const amount = parseInt(amountStr);
  const guildId = interaction.guildId;

  // Get target user
  const targetUser = await interaction.client.users.fetch(targetId);

  // Re-check balance (in case it changed)
  const senderBalance = await getBalance({ userId: senderId, guildId, collections });

  if (senderBalance.balance < amount) {
    return interaction.update({
      content: `❌ Insufficient balance! You now have **${senderBalance.balance.toLocaleString()} coins** but need **${amount.toLocaleString()} coins**.`,
      embeds: [],
      components: []
    });
  }

  await processTransfer({
    interaction,
    collections,
    senderId,
    targetUser,
    amount,
    guildId,
    isEdit: false
  });
}

async function processTransfer({ interaction, collections, senderId, targetUser, amount, guildId, isEdit }) {
  const targetId = targetUser.id;

  // Execute transfer (atomic operations)
  await subtractBalance({ userId: senderId, guildId, amount, collections });
  await addBalance({ userId: targetId, guildId, amount, collections });

  // Record in history
  const { transferHistory } = collections;
  await transferHistory.insertOne({
    fromUserId: senderId,
    toUserId: targetId,
    guildId,
    amount,
    timestamp: new Date()
  });

  // Get updated balances
  const senderBalance = await getBalance({ userId: senderId, guildId, collections });
  const targetBalance = await getBalance({ userId: targetId, guildId, collections });

  // Create receipt
  const receiptEmbed = createTransferReceiptEmbed(
    interaction.user,
    targetUser,
    amount,
    senderBalance.balance,
    targetBalance.balance
  );

  // Send to sender
  if (isEdit) {
    await interaction.editReply({
      embeds: [receiptEmbed],
      components: []
    });
  } else {
    await interaction.update({
      embeds: [receiptEmbed],
      components: []
    });
  }

  // Notify recipient via DM
  try {
    const notificationEmbed = createTransferEmbed(interaction.user, amount, targetBalance.balance);
    await targetUser.send({
      embeds: [notificationEmbed]
    });
  } catch (err) {
    // User has DMs disabled
  }
}

module.exports = {
  handleSend,
  handleSendConfirmation
};