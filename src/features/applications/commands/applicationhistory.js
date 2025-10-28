const { formatHistoryEmbed } = require('../utils/applicationFormatter');

async function handleApplicationHistory({ interaction, collections }) {
  const { applicationResponses } = collections;

  const targetUser = interaction.options.getUser('user');

  await interaction.deferReply({ flags: [64] });

  const applications = await applicationResponses
    .find({
      guildId: interaction.guild.id,
      userId: targetUser.id
    })
    .sort({ submittedAt: -1 })
    .toArray();

  const embed = formatHistoryEmbed(applications, targetUser);

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { handleApplicationHistory };