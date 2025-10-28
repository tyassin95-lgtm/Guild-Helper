const { EmbedBuilder } = require('discord.js');
const { formatStatsEmbed } = require('../utils/applicationFormatter');

async function handleApplicationStats({ interaction, collections }) {
  const { applicationResponses, applicationPanels } = collections;

  await interaction.deferReply({ flags: [64] });

  const guildId = interaction.guild.id;

  // Get all responses for this guild
  const allResponses = await applicationResponses.find({ guildId }).toArray();

  // Calculate statistics
  const stats = {
    total: allResponses.length,
    pending: allResponses.filter(r => r.status === 'pending').length,
    accepted: allResponses.filter(r => r.status === 'accepted').length,
    rejected: allResponses.filter(r => r.status === 'rejected').length,
    closed: allResponses.filter(r => r.status === 'closed').length
  };

  // Calculate average response time (for reviewed applications)
  const reviewedApps = allResponses.filter(r => r.reviewedAt && r.submittedAt);
  if (reviewedApps.length > 0) {
    const totalTime = reviewedApps.reduce((sum, app) => {
      return sum + (app.reviewedAt.getTime() - app.submittedAt.getTime());
    }, 0);
    stats.avgResponseTime = totalTime / reviewedApps.length;
  }

  // Get breakdown by panel
  const panels = await applicationPanels.find({ guildId }).toArray();
  stats.panelBreakdown = [];

  for (const panel of panels) {
    const count = allResponses.filter(r => r.panelId === panel._id.toString()).length;
    if (count > 0) {
      stats.panelBreakdown.push({
        title: panel.title,
        count
      });
    }
  }

  const embed = formatStatsEmbed(stats, interaction.guild);

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { handleApplicationStats };