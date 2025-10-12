const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkAndRebalanceParties } = require('../rebalancing');

async function handleAutoAssign({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const action = interaction.options.getString('action');

  if (action === 'enable') {
    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $set: { autoAssignmentEnabled: true } },
      { upsert: true }
    );

    return interaction.reply({
      content: '✅ **Auto-assignment enabled!**\n\n' +
               '• Players will be automatically assigned to parties when they complete `/myinfo`\n' +
               '• **Strength-based system**: Lower party numbers = stronger parties\n' +
               '• **Tanks/Healers**: Fill parties sequentially (1→2→3), higher CP can substitute into lower parties\n' +
               '• **DPS**: Assigned by strength (highest CP → Party 1)\n' +
               '• **Viability first**: All parties maintain 1T + 1H minimum\n' +
               '• Users will receive DM notifications about their assignments',
      flags: [64]
    });
  }

  if (action === 'disable') {
    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $set: { autoAssignmentEnabled: false } },
      { upsert: true }
    );

    return interaction.reply({
      content: '❌ **Auto-assignment disabled!**\n\n' +
               '• New players will NOT be automatically assigned\n' +
               '• Existing party assignments remain unchanged\n' +
               '• Admins must manually assign players using `/viewparties`',
      flags: [64]
    });
  }

  if (action === 'rebalance') {
    await interaction.deferReply({ flags: [64] });

    try {
      const result = await checkAndRebalanceParties(
        interaction.guildId,
        interaction.client,
        collections,
        true // force rebalance
      );

      if (!result.rebalanced) {
        return interaction.editReply({
          content: `ℹ️ **No rebalancing needed**\n\nReason: ${result.reason}`
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('✅ Strength-Based Rebalancing Complete!')
        .setDescription(
          `Successfully rebalanced parties using the **strength-based system**.\n\n` +
          `**${result.moves.length}** player(s) were moved to optimize party strength.`
        )
        .addFields(
          {
            name: '📊 Rebalancing Strategy',
            value: 
              '• **Viability First**: All parties have 1 Tank + 1 Healer\n' +
              '• **Role Optimization**: Highest CP tanks/healers → lower party numbers\n' +
              '• **DPS Distribution**: Highest CP DPS → Party 1, descending order\n' +
              '• **Result**: Party 1 > Party 2 > Party 3 in strength',
            inline: false
          }
        )
        .setTimestamp();

      if (result.moves.length > 0) {
        const moveList = result.moves
          .slice(0, 10)
          .map(m => `• <@${m.userId}> (${m.role.toUpperCase()}) moved from Party ${m.from} → Party ${m.to}`)
          .join('\n');

        const truncated = result.moves.length > 10 ? `\n*... and ${result.moves.length - 10} more move(s)*` : '';

        embed.addFields({
          name: `Moves (${result.moves.length})`,
          value: moveList + truncated,
          inline: false
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Manual rebalance error:', err);
      return interaction.editReply({
        content: '❌ Failed to rebalance parties. Please try again.'
      });
    }
  }

  if (action === 'status') {
    const settings = await guildSettings.findOne({ guildId: interaction.guildId });
    const enabled = settings?.autoAssignmentEnabled !== false; // default to true
    const lastRebalance = settings?.lastPeriodicRebalance
      ? new Date(settings.lastPeriodicRebalance).toLocaleString()
      : 'Never';

    const embed = new EmbedBuilder()
      .setColor(enabled ? '#2ecc71' : '#e74c3c')
      .setTitle('⚙️ Auto-Assignment Status')
      .addFields(
        {
          name: 'Status',
          value: enabled ? '✅ Enabled' : '❌ Disabled',
          inline: true
        },
        {
          name: 'System Type',
          value: '🏆 Strength-Based',
          inline: true
        },
        {
          name: 'Last Rebalance',
          value: lastRebalance,
          inline: true
        },
        {
          name: '📋 How It Works',
          value:
            '**Tanks/Healers**: Fill parties sequentially (1→2→3)\n' +
            '• Higher CP can substitute into lower parties\n\n' +
            '**DPS**: Assigned by strength\n' +
            '• Highest CP DPS → Party 1\n' +
            '• Lower CP DPS → higher party numbers\n\n' +
            '**Rebalancing**: Every 72 hours automatically\n' +
            '• Ensures Party 1 > Party 2 > Party 3 in strength\n' +
            '• Viability maintained (1T + 1H per party)',
          inline: false
        }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  return interaction.reply({ content: 'Unknown action.', flags: [64] });
}

module.exports = { handleAutoAssign };