const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function createItemRollEmbed(itemRoll, client, collections) {
  const { pvpBonuses } = collections;

  const embed = new EmbedBuilder()
    .setColor(itemRoll.closed ? '#95a5a6' : '#f39c12')
    .setTitle(`🎲 Item Roll: ${itemRoll.itemName}`)
    .setDescription(`**Trait:** ${itemRoll.trait}`)
    .setTimestamp();

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
  if (itemRoll.eligibleUsers.length === 0) {
    eligibleText = '@everyone';
  } else {
    const eligibleNames = await fetchUserNames(client, itemRoll.guildId, itemRoll.eligibleUsers);
    eligibleText = eligibleNames.slice(0, 10).join(', ');
    if (eligibleNames.length > 10) {
      eligibleText += ` and ${eligibleNames.length - 10} more...`;
    }
  }

  embed.addFields({
    name: '👥 Eligible Participants',
    value: eligibleText,
    inline: true
  });

  // Show rolls
  if (itemRoll.rolls && itemRoll.rolls.length > 0) {
    const rollsList = await Promise.all(
      itemRoll.rolls
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(async (roll, index) => {
          const member = await client.guilds.cache.get(itemRoll.guildId)?.members.fetch(roll.userId).catch(() => null);
          const displayName = member ? member.displayName : 'Unknown User';
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          return `${medal} **${displayName}**: ${roll.total} (${roll.baseRoll} + ${roll.bonus} bonus)`;
        })
    );

    const rollsText = rollsList.join('\n');
    embed.addFields({
      name: `🎯 Current Rolls (${itemRoll.rolls.length})`,
      value: rollsText || '*No rolls yet*',
      inline: false
    });

    if (itemRoll.rolls.length > 10) {
      embed.addFields({
        name: '\u200b',
        value: `*...and ${itemRoll.rolls.length - 10} more rolls*`,
        inline: false
      });
    }
  } else {
    embed.addFields({
      name: '🎯 Current Rolls',
      value: '*No one has rolled yet*',
      inline: false
    });
  }

  // Show winner if closed
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

  // Add status field
  embed.addFields({
    name: '📊 Status',
    value: itemRoll.closed ? '🔒 **Rolling Closed**' : '✅ **Rolling Open**',
    inline: false
  });

  // Create buttons
  const components = [];

  if (!itemRoll.closed) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`itemroll_roll:${itemRoll._id}`)
        .setLabel('Roll')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎲')
    );

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