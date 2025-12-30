const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setKillBias, removeKillBias, getAllKillBiases, getKillBias } = require('../utils/killBiasManager');

async function handleKillBias({ interaction, collections }) {
  // Admin check
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to use this command.',
      flags: [64]
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const action = interaction.options.getString('action');
  const guildId = interaction.guildId;

  try {
    if (action === 'set') {
      const targetUser = interaction.options.getUser('user');
      const successRate = interaction.options.getInteger('success_rate');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!targetUser) {
        return interaction.editReply({
          content: '❌ You must specify a user to set kill bias for.'
        });
      }

      if (successRate === null) {
        return interaction.editReply({
          content: '❌ You must specify a success rate (0-100).'
        });
      }

      // Set the bias
      await setKillBias({
        userId: targetUser.id,
        guildId,
        successRate,
        setBy: interaction.user.id,
        reason,
        collections
      });

      // Create response embed
      const embed = new EmbedBuilder()
        .setColor(successRate > 50 ? 0x00FF00 : successRate < 50 ? 0xFF0000 : 0xFFFF00)
        .setTitle('🎯 Kill Bias Set')
        .setDescription(
          `Successfully set kill bias for ${targetUser}.\n\n` +
          `**Success Rate:** ${successRate}% (Default: 50%)\n` +
          `**Reason:** ${reason}\n\n` +
          `⚠️ **This is SECRET** - The user will NOT be notified.`
        )
        .setFooter({ text: `Set by ${interaction.user.tag}` })
        .setTimestamp();

      if (successRate > 50) {
        embed.addFields({
          name: '📈 Effect',
          value: `${targetUser.username} has a **${successRate - 50}% higher** chance to succeed in kills.`,
          inline: false
        });
      } else if (successRate < 50) {
        embed.addFields({
          name: '📉 Effect',
          value: `${targetUser.username} has a **${50 - successRate}% lower** chance to succeed in kills.`,
          inline: false
        });
      } else {
        embed.addFields({
          name: '⚖️ Effect',
          value: 'Success rate is at the default 50% (no bias).',
          inline: false
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (action === 'remove') {
      const targetUser = interaction.options.getUser('user');

      if (!targetUser) {
        return interaction.editReply({
          content: '❌ You must specify a user to remove kill bias from.'
        });
      }

      const removed = await removeKillBias({
        userId: targetUser.id,
        guildId,
        collections
      });

      if (!removed) {
        return interaction.editReply({
          content: `ℹ️ ${targetUser} doesn't have any kill bias set.`
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Kill Bias Removed')
        .setDescription(
          `Successfully removed kill bias for ${targetUser}.\n\n` +
          `They now have the default **50%** success rate.`
        )
        .setFooter({ text: `Removed by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (action === 'list') {
      const biases = await getAllKillBiases({ guildId, collections });

      if (biases.length === 0) {
        return interaction.editReply({
          content: 'ℹ️ No kill biases are currently set in this server.'
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎯 Kill Bias List')
        .setDescription('Users with modified kill success rates:')
        .setFooter({ text: `${biases.length} bias(es) active` })
        .setTimestamp();

      // Sort by success rate (highest first)
      biases.sort((a, b) => b.successRate - a.successRate);

      for (const bias of biases) {
        let user;
        try {
          user = await interaction.client.users.fetch(bias.userId);
        } catch (err) {
          user = { username: 'Unknown User', tag: `Unknown (${bias.userId})` };
        }

        const diff = bias.successRate - 50;
        const emoji = diff > 0 ? '📈' : diff < 0 ? '📉' : '⚖️';
        const diffText = diff > 0 ? `+${diff}%` : diff < 0 ? `${diff}%` : 'Default';

        const fieldValue = 
          `**Success Rate:** ${bias.successRate}% (${emoji} ${diffText})\n` +
          `**Set by:** <@${bias.setBy}>\n` +
          `**Reason:** ${bias.reason || 'None'}\n` +
          `**Last Updated:** <t:${Math.floor(bias.lastUpdated.getTime() / 1000)}:R>`;

        embed.addFields({
          name: `${user.username}`,
          value: fieldValue,
          inline: false
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (action === 'check') {
      const targetUser = interaction.options.getUser('user');

      if (!targetUser) {
        return interaction.editReply({
          content: '❌ You must specify a user to check.'
        });
      }

      const successRate = await getKillBias({
        userId: targetUser.id,
        guildId,
        collections
      });

      const embed = new EmbedBuilder()
        .setColor(successRate > 50 ? 0x00FF00 : successRate < 50 ? 0xFF0000 : 0xFFFF00)
        .setTitle('🎯 Kill Bias Check')
        .setDescription(`Current kill success rate for ${targetUser}:`)
        .addFields({
          name: 'Success Rate',
          value: `**${successRate}%**`,
          inline: true
        })
        .setTimestamp();

      if (successRate !== 50) {
        const diff = successRate - 50;
        const emoji = diff > 0 ? '📈' : '📉';
        const diffText = diff > 0 ? `+${diff}%` : `${diff}%`;

        embed.addFields({
          name: 'Difference from Default',
          value: `${emoji} ${diffText}`,
          inline: true
        });

        // Get full bias data
        const biasData = await collections.killBiases.findOne({
          userId: targetUser.id,
          guildId
        });

        if (biasData) {
          embed.addFields({
            name: 'Details',
            value: 
              `**Set by:** <@${biasData.setBy}>\n` +
              `**Reason:** ${biasData.reason || 'None'}\n` +
              `**Last Updated:** <t:${Math.floor(biasData.lastUpdated.getTime() / 1000)}:R>`,
            inline: false
          });
        }
      } else {
        embed.addFields({
          name: 'Status',
          value: '⚖️ Default rate (no bias)',
          inline: true
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Kill bias command error:', error);
    return interaction.editReply({
      content: '❌ An error occurred while managing kill bias. Please try again.'
    });
  }
}

module.exports = { handleKillBias };