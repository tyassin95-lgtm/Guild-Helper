const { EmbedBuilder } = require('discord.js');

/**
 * Build the poll embed with current vote results
 * @param {Object} pollDoc - Poll document from database
 * @param {Guild} guild - Discord guild object
 * @returns {EmbedBuilder}
 */
function buildPollEmbed(pollDoc, guild) {
  const embed = new EmbedBuilder()
    .setColor(pollDoc.closed ? '#95a5a6' : '#3498db')
    .setTitle(pollDoc.closed ? '🔒 Poll Closed' : '📊 Guild Poll')
    .setDescription(pollDoc.description)
    .setTimestamp(pollDoc.createdAt);

  // Add image if provided
  if (pollDoc.imageUrl) {
    embed.setImage(pollDoc.imageUrl);
  }

  // Add creator info
  embed.setFooter({ 
    text: `Created by ${guild ? 'User ID: ' : ''}${pollDoc.creatorId}` 
  });

  // Add poll type info
  const pollType = pollDoc.allowMultipleVotes 
    ? '🗳️ Multiple choices allowed' 
    : '☑️ Single choice only';

  // Add time info
  const timeInfo = pollDoc.closed
    ? `⏰ Closed <t:${Math.floor(pollDoc.endsAt.getTime() / 1000)}:R>`
    : `⏰ Ends <t:${Math.floor(pollDoc.endsAt.getTime() / 1000)}:R>`;

  embed.addFields({
    name: 'ℹ️ Poll Information',
    value: `${pollType}\n${timeInfo}`,
    inline: false
  });

  // Calculate total participants (unique voters)
  const allVoters = new Set();
  pollDoc.options.forEach(option => {
    option.voters.forEach(voter => allVoters.add(voter.userId));
  });
  const totalParticipants = allVoters.size;

  // Build results section
  let resultsText = '';

  if (totalParticipants === 0) {
    resultsText = '_No votes yet. Be the first to vote!_';
  } else {
    pollDoc.options.forEach((option, index) => {
      const voteCount = option.voters.length;
      const percentage = totalParticipants > 0 
        ? Math.round((voteCount / totalParticipants) * 100) 
        : 0;

      // Build voter names list (limit to first 10, then show +X more)
      let votersList = '';
      if (voteCount > 0) {
        const voterNames = option.voters.slice(0, 10).map(v => v.username);
        votersList = '\n  └ ' + voterNames.join(', ');

        if (voteCount > 10) {
          votersList += ` _(+${voteCount - 10} more)_`;
        }
      }

      resultsText += `\n**${index + 1}. ${option.text}**\n`;
      resultsText += `📊 ${voteCount} vote${voteCount !== 1 ? 's' : ''} (${percentage}%)${votersList}\n`;
    });
  }

  embed.addFields({
    name: '🗳️ Results',
    value: resultsText.trim(),
    inline: false
  });

  embed.addFields({
    name: '👥 Total Participants',
    value: `${totalParticipants} voter${totalParticipants !== 1 ? 's' : ''}`,
    inline: false
  });

  return embed;
}

module.exports = { buildPollEmbed };