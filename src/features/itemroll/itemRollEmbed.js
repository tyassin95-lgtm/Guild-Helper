const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function createItemRollEmbed(itemRoll, client, collections) {
  const { pvpBonuses } = collections;

  const isTiebreaker = itemRoll.isTiebreaker || false;
  const tieDetected = itemRoll.tieDetected || false;
  const earlyClose = itemRoll.earlyClose || false;

  const embed = new EmbedBuilder()
    .setColor(itemRoll.closed ? '#95a5a6' : (isTiebreaker ? '#e74c3c' : '#f39c12'))
    .setTitle(`${isTiebreaker ? '⚔️ TIEBREAKER - ' : '🎲 '}Item Roll: ${itemRoll.itemName}`)
    .setDescription(`**Trait:** ${itemRoll.trait}`)
    .setTimestamp();

  // Add tiebreaker notice if applicable
  if (isTiebreaker) {
    embed.addFields({
      name: '⚔️ Tiebreaker Round',
      value: 'This is a tiebreaker roll to determine the final winner!',
      inline: false
    });
  }

  // Add image if provided
  if (itemRoll.imageUrl && itemRoll.imageUrl.trim().length > 0) {
    embed.setImage(itemRoll.imageUrl);
  }

  // Add end time field
  const endTimestamp = Math.floor(itemRoll.endsAt.getTime() / 1000);
  embed.addFields({
    name: '⏰ Roll Ends',
    value: `<t:${endTimestamp}:F>\n<t:${endTimestamp}:R>`,
    inline: true
  });

  // Add eligible participants field
  let eligibleText;
  if (itemRoll.eligibleUsers.length === 0 && !isTiebreaker) {
    eligibleText = '@everyone';
  } else {
    const eligibleNames = await fetchUserNames(client, itemRoll.guildId, itemRoll.eligibleUsers);
    eligibleText = eligibleNames.slice(0, 10).join(', ');
    if (eligibleNames.length > 10) {
      eligibleText += ` and ${eligibleNames.length - 10} more...`;
    }
  }

  embed.addFields({
    name: isTiebreaker ? '👥 Tied Participants' : '👥 Eligible Participants',
    value: eligibleText,
    inline: true
  });

  // Show rolls and passes combined
  const rolls = itemRoll.rolls || [];
  const passes = itemRoll.passes || [];
  const totalParticipants = rolls.length + passes.length;

  if (totalParticipants > 0) {
    // Combine rolls and passes into a single sorted list
    const rollEntries = await Promise.all(
      rolls.map(async (roll) => {
        const member = await client.guilds.cache.get(itemRoll.guildId)?.members.fetch(roll.userId).catch(() => null);
        const displayName = member ? member.displayName : 'Unknown User';
        return {
          userId: roll.userId,
          displayName,
          total: roll.total,
          baseRoll: roll.baseRoll,
          bonus: roll.bonus,
          isPassed: false,
          timestamp: roll.timestamp
        };
      })
    );

    const passEntries = await Promise.all(
      passes.map(async (pass) => {
        const member = await client.guilds.cache.get(itemRoll.guildId)?.members.fetch(pass.userId).catch(() => null);
        const displayName = member ? member.displayName : 'Unknown User';
        return {
          userId: pass.userId,
          displayName,
          total: -1, // Passes go to bottom
          isPassed: true,
          timestamp: pass.timestamp
        };
      })
    );

    // Combine and sort (rolls by total descending, passes at bottom)
    const allEntries = [...rollEntries, ...passEntries].sort((a, b) => {
      if (a.isPassed && !b.isPassed) return 1;
      if (!a.isPassed && b.isPassed) return -1;
      return b.total - a.total;
    });

    // Format display (show top 10)
    const displayEntries = allEntries.slice(0, 10);
    const participantsList = displayEntries.map((entry, index) => {
      if (entry.isPassed) {
        return `❌ **${entry.displayName}**: Passed`;
      } else {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${entry.displayName}**: ${entry.total} (${entry.baseRoll} + ${entry.bonus} bonus)`;
      }
    });

    const participantsText = participantsList.join('\n');
    embed.addFields({
      name: `🎯 Participants (${totalParticipants})`,
      value: participantsText || '*No activity yet*',
      inline: false
    });

    if (totalParticipants > 10) {
      embed.addFields({
        name: '\u200b',
        value: `*...and ${totalParticipants - 10} more participants*`,
        inline: false
      });
    }
  } else {
    embed.addFields({
      name: '🎯 Participants',
      value: '*No one has rolled or passed yet*',
      inline: false
    });
  }

  // Show winner if closed (and not a tie)
  if (itemRoll.closed && itemRoll.winnerId) {
    const winner = await client.guilds.cache.get(itemRoll.guildId)?.members.fetch(itemRoll.winnerId).catch(() => null);
    const winnerName = winner ? winner.displayName : 'Unknown User';
    const winningRoll = itemRoll.rolls.find(r => r.userId === itemRoll.winnerId);

    embed.addFields({
      name: '🏆 Winner',
      value: `**${winnerName}** with a roll of **${winningRoll.total}**!`,
      inline: false
    });
  }

  // Show tie detection if closed with a tie
  if (itemRoll.closed && tieDetected && !itemRoll.winnerId) {
    const sortedRolls = itemRoll.rolls.sort((a, b) => b.total - a.total);
    const highestScore = sortedRolls[0].total;
    const tiedUsers = sortedRolls.filter(r => r.total === highestScore);

    const tiedNames = await Promise.all(
      tiedUsers.map(async (roll) => {
        const member = await client.guilds.cache.get(itemRoll.guildId)?.members.fetch(roll.userId).catch(() => null);
        return member ? member.displayName : 'Unknown User';
      })
    );

    embed.addFields({
      name: '⚔️ Tie Detected',
      value: `**${tiedNames.join(', ')}** tied with **${highestScore}**!\nA tiebreaker has been created below.`,
      inline: false
    });
  }

  // Add status field
  let statusText;
  if (itemRoll.closed) {
    if (tieDetected && !itemRoll.winnerId) {
      statusText = '⚔️ **Tie - Tiebreaker Created**';
    } else if (earlyClose) {
      statusText = '🔒 **Closed Early - All Eligible Players Acted**';
    } else {
      statusText = '🔒 **Rolling Closed**';
    }
  } else {
    statusText = '✅ **Rolling Open**';
  }

  embed.addFields({
    name: '📊 Status',
    value: statusText,
    inline: false
  });

  // Create buttons
  const components = [];

  if (!itemRoll.closed) {
    const rollButton = new ButtonBuilder()
      .setCustomId(`itemroll_roll:${itemRoll._id}`)
      .setLabel(isTiebreaker ? 'Roll Again' : 'Roll')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎲');

    const passButton = new ButtonBuilder()
      .setCustomId(`itemroll_pass:${itemRoll._id}`)
      .setLabel('Pass')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👋');

    const row = new ActionRowBuilder().addComponents(rollButton, passButton);
    components.push(row);
  }

  return { embed, components };
}

/**
 * Helper function to fetch user display names
 */
async function fetchUserNames(client, guildId, userIds) {
  const names = [];

  try {
    const guild = await client.guilds.fetch(guildId);

    for (const userId of userIds) {
      try {
        const member = await guild.members.fetch(userId);
        if (member) {
          names.push(member.displayName);
        }
      } catch (err) {
        names.push('Unknown User');
      }
    }
  } catch (err) {
    console.error('Failed to fetch guild for user names:', err);
  }

  return names;
}

async function updateItemRollEmbed(interaction, itemRoll, collections) {
  try {
    const channel = await interaction.client.channels.fetch(itemRoll.channelId);
    if (!channel) return;

    const message = await channel.messages.fetch(itemRoll.messageId);
    if (!message) return;

    const { embed, components } = await createItemRollEmbed(itemRoll, interaction.client, collections);

    await message.edit({
      embeds: [embed],
      components
    });
  } catch (err) {
    console.error('Failed to update item roll embed:', err);
  }
}

module.exports = { createItemRollEmbed, updateItemRollEmbed };