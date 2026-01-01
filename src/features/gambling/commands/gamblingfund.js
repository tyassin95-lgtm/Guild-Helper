const { canClaimDaily, claimDaily, getNextMilestone } = require('../utils/dailyManager');
const { createDailyClaimEmbed } = require('../embeds/gameEmbeds');

async function handleGamblingDaily({ interaction, collections }) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Check if user can claim
  const checkResult = await canClaimDaily({ userId, guildId, collections });

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

    const milestone = getNextMilestone(checkResult.currentStreak);

    return interaction.reply({
      content: `⏰ You've already claimed your daily reward!\n\n` +
               `Come back in **${timeText}** to claim again.\n\n` +
               `🔥 Current Streak: **${checkResult.currentStreak}** days\n` +
               `📅 Next Milestone: **${milestone.next}** days (${milestone.daysUntil} days away) - **+${milestone.bonus.toLocaleString()}** bonus coins!`,
      flags: [64] // MessageFlags.Ephemeral
    });
  }

  // Claim the daily reward
  const claimResult = await claimDaily({ userId, guildId, collections });

  const embed = createDailyClaimEmbed(interaction.user, claimResult);

  await interaction.reply({ embeds: [embed] });
}

module.exports = { handleGamblingDaily };