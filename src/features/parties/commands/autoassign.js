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
               '• Parties will be balanced based on roles and CP\n' +
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
        .setTitle('✅ Rebalancing Complete!')
        .setDescription(`Successfully rebalanced parties. **${result.moves.length}** player(s) were moved.`)
        .setTimestamp();

      if (result.moves.length > 0) {
        const moveList = result.moves.map(m => 
          `• <@${m.userId}> moved from Party ${m.from} to Party ${m.to}`
        ).join('\n');

        embed.addFields({
          name: 'Moves',
          value: moveList,
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
    const threshold = settings?.rebalanceThreshold || 0.20;
    const lastRebalance = settings?.lastAutoRebalance 
      ? new Date(settings.lastAutoRebalance).toLocaleString() 
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
          name: 'Rebalance Threshold', 
          value: `${(threshold * 100).toFixed(0)}%`, 
          inline: true 
        },
        { 
          name: 'Last Rebalance', 
          value: lastRebalance, 
          inline: true 
        }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  return interaction.reply({ content: 'Unknown action.', flags: [64] });
}

module.exports = { handleAutoAssign };