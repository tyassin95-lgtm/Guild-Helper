const { getBalance } = require('../utils/balanceManager');
const { createBalanceEmbed } = require('../embeds/gameEmbeds');

async function handleGamblingBalance({ interaction, collections }) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  const balance = await getBalance({
    userId: targetUser.id,
    guildId: interaction.guildId,
    collections
  });

  const embed = createBalanceEmbed(targetUser, balance, true);

  await interaction.reply({ embeds: [embed] });
}

module.exports = { handleGamblingBalance };