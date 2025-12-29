const { buildPollEmbed } = require('../utils/pollEmbed');

async function handlePollButtons({ interaction, collections }) {
  const { guildPolls, guildSettings } = collections;

  // Parse button customId (format: poll_vote:option_X)
  if (!interaction.customId.startsWith('poll_vote:')) {
    return;
  }

  const optionId = interaction.customId.split(':')[1];

  await interaction.deferReply({ flags: [64] });

  try {
    // Find the poll by message ID
    const poll = await guildPolls.findOne({
      guildId: interaction.guildId,
      messageId: interaction.message.id
    });

    if (!poll) {
      return interaction.editReply({
        content: '❌ Poll not found. It may have been deleted.',
        flags: [64]
      });
    }

    // Check if poll is closed
    if (poll.closed || !poll.active) {
      return interaction.editReply({
        content: '❌ This poll is closed. You cannot vote anymore.',
        flags: [64]
      });
    }

    // Check if poll has expired (but not yet marked as closed)
    if (new Date() > poll.endsAt) {
      return interaction.editReply({
        content: '❌ This poll has expired. You cannot vote anymore.',
        flags: [64]
      });
    }

    // Check if user has an excluded role
    const settings = await guildSettings.findOne({ guildId: interaction.guildId });
    const excludedRoles = settings?.excludedRoles || [];

    if (excludedRoles.length > 0) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const hasExcludedRole = member.roles.cache.some(role => excludedRoles.includes(role.id));

      if (hasExcludedRole) {
        return interaction.editReply({
          content: '❌ You have an excluded role and cannot participate in this poll.',
          flags: [64]
        });
      }
    }

    // Find the option being voted for
    const optionIndex = poll.options.findIndex(opt => opt.id === optionId);
    if (optionIndex === -1) {
      return interaction.editReply({
        content: '❌ Invalid option selected.',
        flags: [64]
      });
    }

    const userId = interaction.user.id;
    // Get server nickname (falls back to global username if no nickname set)
    const member = await interaction.guild.members.fetch(userId);
    const username = member.displayName || interaction.user.username;

    // Check if user has already voted
    let hasVotedBefore = false;
    let previousVotes = [];

    poll.options.forEach((option, idx) => {
      const voterIndex = option.voters.findIndex(v => v.userId === userId);
      if (voterIndex !== -1) {
        hasVotedBefore = true;
        previousVotes.push(idx);
      }
    });

    // Handle voting logic based on poll type
    if (poll.allowMultipleVotes) {
      // Multiple choice poll
      const alreadyVotedForThisOption = poll.options[optionIndex].voters.some(v => v.userId === userId);

      if (alreadyVotedForThisOption) {
        // Remove vote from this option (toggle off)
        await guildPolls.updateOne(
          { _id: poll._id },
          { 
            $pull: { 
              [`options.${optionIndex}.voters`]: { userId } 
            } 
          }
        );

        await interaction.editReply({
          content: `✅ Removed your vote for **${poll.options[optionIndex].text}**.`,
          flags: [64]
        });
      } else {
        // Add vote to this option
        await guildPolls.updateOne(
          { _id: poll._id },
          { 
            $push: { 
              [`options.${optionIndex}.voters`]: { 
                userId, 
                username, 
                timestamp: new Date() 
              } 
            } 
          }
        );

        await interaction.editReply({
          content: `✅ You voted for **${poll.options[optionIndex].text}**.`,
          flags: [64]
        });
      }
    } else {
      // Single choice poll
      if (hasVotedBefore && previousVotes.includes(optionIndex)) {
        // User clicked the same option they already voted for
        return interaction.editReply({
          content: `ℹ️ You have already voted for **${poll.options[optionIndex].text}**.`,
          flags: [64]
        });
      }

      // Remove all previous votes
      for (const prevIdx of previousVotes) {
        await guildPolls.updateOne(
          { _id: poll._id },
          { 
            $pull: { 
              [`options.${prevIdx}.voters`]: { userId } 
            } 
          }
        );
      }

      // Add new vote
      await guildPolls.updateOne(
        { _id: poll._id },
        { 
          $push: { 
            [`options.${optionIndex}.voters`]: { 
              userId, 
              username, 
              timestamp: new Date() 
            } 
          } 
        }
      );

      if (hasVotedBefore) {
        await interaction.editReply({
          content: `✅ Changed your vote to **${poll.options[optionIndex].text}**.`,
          flags: [64]
        });
      } else {
        await interaction.editReply({
          content: `✅ You voted for **${poll.options[optionIndex].text}**.`,
          flags: [64]
        });
      }
    }

    // Fetch updated poll data
    const updatedPoll = await guildPolls.findOne({ _id: poll._id });

    // Update the poll message embed
    const updatedEmbed = buildPollEmbed(updatedPoll, interaction.guild);

    await interaction.message.edit({
      embeds: [updatedEmbed]
    });

  } catch (error) {
    console.error('Error handling poll vote:', error);
    await interaction.editReply({
      content: '❌ An error occurred while processing your vote. Please try again.',
      flags: [64]
    });
  }
}

module.exports = { handlePollButtons };