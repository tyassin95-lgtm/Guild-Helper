const { canClaimFund, claimFund, getNextMilestone } = require('../utils/fundManager');
const { createFundClaimEmbed } = require('../embeds/gameEmbeds');

async function handleGamblingFund({ interaction, collections }) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Check if user can claim
  const checkResult = await canClaimFund({ userId, guildId, collections });

  if (!checkResult.canClaim) {
    const hours = checkResult.hoursRemaining;
    const minutes = checkResult.minutesRemaining;

    let timeText = '';
    if (hours > 0) {
      timeText = `${hours} hour${hours !== 1 ? 's' : ''}`;
      if (minutes > 0) {
        timeText += ` and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
    } else {
      timeText = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    const milestone = getNextMilestone(checkResult.currentUses);

    return interaction.reply({
      content: `⏰ You've already claimed your gambling fund!\n\n` +
               `Come back in **${timeText}** to claim again.\n\n` +
               `🎯 Current Uses: **${checkResult.currentUses}**\n` +
               `🎁 Next Milestone: **${milestone.next}** uses (${milestone.usesUntil} uses away) - **+${milestone.bonus.toLocaleString()}** bonus coins!`,
      flags: [64] // MessageFlags.Ephemeral
    });
  }

  // Claim the fund
  const claimResult = await claimFund({ userId, guildId, collections });

  const embed = createFundClaimEmbed(interaction.user, claimResult);

  await interaction.reply({ embeds: [embed] });
}

module.exports = { handleGamblingFund };