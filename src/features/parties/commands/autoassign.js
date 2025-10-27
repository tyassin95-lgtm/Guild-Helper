const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkAndRebalanceParties } = require('../rebalancing');
const { handleMaxPartiesChange } = require('../reserve');
const { MAX_PARTIES } = require('../constants');

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
               '• **Tanks**: Max 1 per party - Fill sequentially, higher CP can substitute\n' +
               '• **Healers**: Max 3 per party - Fill sequentially, higher CP can substitute\n' +
               '• **DPS**: Assigned by strength (highest CP → Party 1)\n' +
               '• **Viability first**: All parties maintain 1T + 1H minimum\n' +
               '• **Reserve system**: When max parties reached, excess players go to reserve\n' +
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
               '• Reserve players remain in reserve\n' +
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
              '• **Role Caps**: 1 Tank, up to 3 Healers per party\n' +
              '• **Result**: Party 1 > Party 2 > Party 3 in strength',
            inline: false
          }
        );

      if (result.reservePromoted > 0) {
        embed.addFields({
          name: '🎯 Reserve Pool Processing',
          value: `**${result.reservePromoted}** player(s) promoted from reserve to active parties`,
          inline: false
        });
      }

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

      embed.setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Manual rebalance error:', err);
      return interaction.editReply({
        content: '❌ Failed to rebalance parties. Please try again.'
      });
    }
  }

  if (action === 'max-parties') {
    const newMax = interaction.options.getInteger('value');

    if (newMax < 1 || newMax > MAX_PARTIES) {
      return interaction.reply({
        content: `❌ Invalid value. Maximum parties must be between 1 and ${MAX_PARTIES}.`,
        flags: [64]
      });
    }

    // CRITICAL: Defer immediately before any async operations
    await interaction.deferReply({ flags: [64] });

    try {
      const settings = await guildSettings.findOne({ guildId: interaction.guildId });
      const oldMax = settings?.maxParties || MAX_PARTIES;

      if (oldMax === newMax) {
        return interaction.editReply({
          content: `ℹ️ Maximum parties is already set to ${newMax}.`
        });
      }

      // Update setting
      await guildSettings.updateOne(
        { guildId: interaction.guildId },
        { $set: { maxParties: newMax } },
        { upsert: true }
      );

      // Handle the change
      const result = await handleMaxPartiesChange(
        oldMax,
        newMax,
        interaction.guildId,
        interaction.client,
        collections
      );

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('✅ Maximum Parties Updated')
        .setDescription(`Maximum parties changed from **${oldMax}** to **${newMax}**`)
        .setTimestamp();

      if (result.action === 'increased') {
        embed.addFields({
          name: '📈 Parties Increased',
          value: 
            `New party slots are now available.\n\n` +
            `• **Promoted from reserve:** ${result.promoted || 0} player(s)\n` +
            `• Reserve players were automatically assigned to fill new parties`,
          inline: false
        });
      } else if (result.action === 'decreased') {
        embed.setColor('#e67e22'); // Orange for decreased
        embed.addFields({
          name: '📉 Parties Decreased',
          value:
            `Excess parties have been disbanded.\n\n` +
            `• **Parties disbanded:** ${result.disbanded}\n` +
            `• **Players moved to reserve:** ${result.movedToReserve}\n` +
            `• **Pulled back from reserve:** ${result.pulledBack}\n` +
            `• **Rebalance optimization moves:** ${result.rebalanceMoves || 0}\n\n` +
            `All affected players have been notified via DM.\n` +
            `Parties have been rebalanced for optimal CP distribution.`,
          inline: false
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Max parties change error:', err);
      return interaction.editReply({
        content: '❌ Failed to update maximum parties. Please try again.'
      });
    }
  }

  if (action === 'status') {
    const settings = await guildSettings.findOne({ guildId: interaction.guildId });
    const enabled = settings?.autoAssignmentEnabled !== false;
    const maxParties = settings?.maxParties || MAX_PARTIES;
    const lastRebalance = settings?.lastPeriodicRebalance
      ? new Date(settings.lastPeriodicRebalance).toLocaleString()
      : 'Never';

    // Get current party count
    const { parties, partyPlayers } = collections;
    const currentParties = await parties.countDocuments({ 
      guildId: interaction.guildId,
      partyNumber: { $lte: maxParties }
    });

    const reserveCount = await partyPlayers.countDocuments({
      guildId: interaction.guildId,
      inReserve: true
    });

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
          name: 'Max Parties',
          value: `${maxParties}`,
          inline: true
        },
        {
          name: 'Active Parties',
          value: `${currentParties}`,
          inline: true
        },
        {
          name: 'Reserve Pool',
          value: `${reserveCount} player(s)`,
          inline: true
        },
        {
          name: '📋 How It Works',
          value:
            '**Tanks** (Max 1/party): Fill sequentially (1→2→3)\n' +
            '• Higher CP can substitute into lower parties\n\n' +
            '**Healers** (Max 3/party): Fill sequentially\n' +
            '• Higher CP can substitute into lower parties\n\n' +
            '**DPS**: Assigned by strength\n' +
            '• Highest CP DPS → Party 1\n' +
            '• Lower CP DPS → higher party numbers\n\n' +
            '**Reserve System**: When max parties reached\n' +
            '• Excess players go to reserve pool\n' +
            '• Automatically considered during rebalancing',
          inline: false
        },
        {
          name: '🔄 Rebalancing',
          value:
            '• **Automatic**: Every 72 hours\n' +
            '• **Manual**: Use `/autoassign rebalance`\n' +
            '• Ensures Party 1 > Party 2 > Party 3 in strength\n' +
            '• Viability maintained (1T + 1H per party)\n' +
            '• Reserve players automatically promoted when possible',
          inline: false
        }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  return interaction.reply({ content: 'Unknown action.', flags: [64] });
}

module.exports = { handleAutoAssign };