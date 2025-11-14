const { addBalance, getBalance } = require('../utils/balanceManager');

async function handleGiveGamblingMoney({ interaction, collections }) {
  const targetUser = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  if (amount <= 0) {
    return interaction.reply({
      content: '❌ Amount must be greater than 0.',
      flags: [64]
    });
  }

  // Add money to the user
  await addBalance({
    userId: targetUser.id,
    guildId: interaction.guildId,
    amount,
    collections
  });

  // Get the updated balance
  const balance = await getBalance({
    userId: targetUser.id,
    guildId: interaction.guildId,
    collections
  });

  await interaction.reply({
    content: `✅ Successfully granted **${amount.toLocaleString()} coins** to ${targetUser}.\n\n` +
             `Their new balance: **${balance.balance.toLocaleString()} coins**`
  });
}

module.exports = { handleGiveGamblingMoney };