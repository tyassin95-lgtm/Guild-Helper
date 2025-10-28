const { EmbedBuilder } = require('discord.js');

/**
 * Format the application panel embed
 */
function formatPanelEmbed(panel) {
  const embed = new EmbedBuilder()
    .setTitle(panel.title)
    .setDescription(panel.description)
    .setColor(panel.embedColor || 0x5865F2)
    .setFooter({ text: `${panel.questions.length} questions • Click below to apply` });

  if (panel.thumbnailUrl) {
    embed.setThumbnail(panel.thumbnailUrl);
  }

  if (panel.imageUrl) {
    embed.setImage(panel.imageUrl);
  }

  return embed;
}

/**
 * Format application response embed for staff review
 */
function formatResponseEmbed(response, user, panel) {
  const embed = new EmbedBuilder()
    .setTitle(`📋 ${panel.title} - Application`)
    .setColor(0x5865F2)
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp(response.submittedAt);

  embed.addFields({
    name: '👤 Applicant',
    value: `${user.tag} (${user.id})`,
    inline: false
  });

  // Add each question and answer
  for (let i = 0; i < panel.questions.length; i++) {
    const question = panel.questions[i];
    const answer = response.answers[i];

    let answerText = answer.value || '*No answer provided*';

    // Truncate long answers
    if (answerText.length > 1024) {
      answerText = answerText.substring(0, 1021) + '...';
    }

    embed.addFields({
      name: `${i + 1}. ${question.text}`,
      value: answerText,
      inline: false
    });
  }

  embed.addFields({
    name: '📊 Status',
    value: getStatusText(response.status),
    inline: true
  });

  if (response.reviewedBy) {
    embed.addFields({
      name: '👨‍💼 Reviewed By',
      value: `<@${response.reviewedBy}>`,
      inline: true
    });
  }

  if (response.reviewedAt) {
    embed.addFields({
      name: '🕐 Reviewed At',
      value: `<t:${Math.floor(response.reviewedAt.getTime() / 1000)}:R>`,
      inline: true
    });
  }

  return embed;
}

/**
 * Format application statistics embed
 */
function formatStatsEmbed(stats, guild) {
  const embed = new EmbedBuilder()
    .setTitle('📊 Application Statistics')
    .setColor(0x5865F2)
    .setTimestamp();

  if (guild.iconURL()) {
    embed.setThumbnail(guild.iconURL());
  }

  embed.addFields(
    {
      name: '📝 Total Applications',
      value: stats.total.toString(),
      inline: true
    },
    {
      name: '⏳ Pending',
      value: stats.pending.toString(),
      inline: true
    },
    {
      name: '✅ Accepted',
      value: stats.accepted.toString(),
      inline: true
    },
    {
      name: '❌ Rejected',
      value: stats.rejected.toString(),
      inline: true
    },
    {
      name: '🔒 Closed',
      value: stats.closed.toString(),
      inline: true
    },
    {
      name: '📈 Acceptance Rate',
      value: stats.total > 0 
        ? `${((stats.accepted / stats.total) * 100).toFixed(1)}%`
        : 'N/A',
      inline: true
    }
  );

  if (stats.avgResponseTime) {
    const hours = Math.floor(stats.avgResponseTime / (1000 * 60 * 60));
    const minutes = Math.floor((stats.avgResponseTime % (1000 * 60 * 60)) / (1000 * 60));

    embed.addFields({
      name: '⏱️ Avg Response Time',
      value: `${hours}h ${minutes}m`,
      inline: true
    });
  }

  if (stats.panelBreakdown && stats.panelBreakdown.length > 0) {
    let breakdownText = '';
    for (const panel of stats.panelBreakdown) {
      breakdownText += `**${panel.title}**: ${panel.count} applications\n`;
    }

    embed.addFields({
      name: '📋 By Panel',
      value: breakdownText || 'None',
      inline: false
    });
  }

  return embed;
}

/**
 * Format application history for a user
 */
function formatHistoryEmbed(applications, user) {
  const embed = new EmbedBuilder()
    .setTitle(`📜 Application History for ${user.tag}`)
    .setColor(0x5865F2)
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  if (applications.length === 0) {
    embed.setDescription('*No applications found for this user.*');
    return embed;
  }

  for (const app of applications.slice(0, 10)) { // Show last 10
    const statusEmoji = getStatusEmoji(app.status);
    const timestamp = `<t:${Math.floor(app.submittedAt.getTime() / 1000)}:R>`;

    embed.addFields({
      name: `${statusEmoji} ${app.panelTitle || 'Unknown Position'}`,
      value: `**Status:** ${getStatusText(app.status)}\n**Submitted:** ${timestamp}`,
      inline: false
    });
  }

  if (applications.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${applications.length} applications` });
  }

  return embed;
}

/**
 * Format welcome message for new ticket
 */
function formatWelcomeEmbed(panel, user) {
  const embed = new EmbedBuilder()
    .setTitle(`Welcome to your ${panel.title} Application!`)
    .setDescription(
      `Hello ${user}, thank you for your interest!\n\n` +
      `Please click the **Start Application** button below to begin.\n\n` +
      `**What to expect:**\n` +
      `• You'll be asked ${panel.questions.length} question${panel.questions.length !== 1 ? 's' : ''}\n` +
      `• Take your time - you can review before submitting\n` +
      `• Staff will review your application and respond soon\n\n` +
      `*If you have any questions, feel free to ask staff in this ticket.*`
    )
    .setColor(panel.embedColor || 0x5865F2)
    .setTimestamp();

  if (panel.thumbnailUrl) {
    embed.setThumbnail(panel.thumbnailUrl);
  }

  return embed;
}

/**
 * Format notes embed
 */
function formatNotesEmbed(notes, guild) {
  const embed = new EmbedBuilder()
    .setTitle('📝 Staff Notes')
    .setColor(0xFEE75C)
    .setTimestamp();

  if (notes.length === 0) {
    embed.setDescription('*No notes yet.*');
    return embed;
  }

  for (const note of notes.slice(-5)) { // Show last 5 notes
    const timestamp = `<t:${Math.floor(note.createdAt.getTime() / 1000)}:f>`;
    const staff = guild.members.cache.get(note.staffId);
    const staffName = staff ? staff.user.tag : 'Unknown Staff';

    embed.addFields({
      name: `${staffName} - ${timestamp}`,
      value: note.noteText.length > 200 
        ? note.noteText.substring(0, 197) + '...'
        : note.noteText,
      inline: false
    });
  }

  if (notes.length > 5) {
    embed.setFooter({ text: `Showing 5 of ${notes.length} notes` });
  }

  return embed;
}

/**
 * Get status text with formatting
 */
function getStatusText(status) {
  const statusMap = {
    'pending': '⏳ Pending Review',
    'accepted': '✅ Accepted',
    'rejected': '❌ Rejected',
    'closed': '🔒 Closed',
    'open': '📝 In Progress'
  };

  return statusMap[status] || status;
}

/**
 * Get status emoji
 */
function getStatusEmoji(status) {
  const emojiMap = {
    'pending': '⏳',
    'accepted': '✅',
    'rejected': '❌',
    'closed': '🔒',
    'open': '📝'
  };

  return emojiMap[status] || '❓';
}

module.exports = {
  formatPanelEmbed,
  formatResponseEmbed,
  formatStatsEmbed,
  formatHistoryEmbed,
  formatWelcomeEmbed,
  formatNotesEmbed,
  getStatusText,
  getStatusEmoji
};