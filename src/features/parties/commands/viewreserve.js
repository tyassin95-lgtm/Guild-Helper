const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getReservePlayers } = require('../reserve');

async function handleViewReserve({ interaction, collections }) {
  const { guildSettings, parties } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    const settings = await guildSettings.findOne({ guildId: interaction.guildId });
    const maxParties = settings?.maxParties || 10;

    // Get reserve players
    const reservePlayers = await getReservePlayers(interaction.guildId, collections);

    if (reservePlayers.length === 0) {
      return interaction.editReply({
        content: '✅ **Reserve pool is empty!**\n\nAll players are currently assigned to active parties.'
      });
    }

    // Get active party stats
    const activeParties = await parties.find({ 
      guildId: interaction.guildId,
      partyNumber: { $lte: maxParties }
    }).toArray();

    const totalSlots = activeParties.reduce((sum, p) => {
      const members = p.members?.length || 0;
      return sum + (6 - members);
    }, 0);

    // Group by role
    const tanks = reservePlayers.filter(p => p.role === 'tank');
    const healers = reservePlayers.filter(p => p.role === 'healer');
    const dps = reservePlayers.filter(p => p.role === 'dps');

    const embed = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle('📋 Reserve Pool Status')
      .setDescription(`**${reservePlayers.length}** player(s) currently in reserve`)
      .addFields(
        {
          name: '⚙️ Guild Settings',
          value:
            `• **Max Parties:** ${maxParties}\n` +
            `• **Active Parties:** ${activeParties.length}\n` +
            `• **Open Slots:** ${totalSlots}`,
          inline: false
        }
      )
      .setTimestamp();

    // Add tanks
    if (tanks.length > 0) {
      const tankList = tanks.slice(0, 5).map((p, index) => {
        const timeSinceReserve = Date.now() - new Date(p.reservedAt).getTime();
        const hours = Math.floor(timeSinceReserve / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        let timeString;
        if (days > 0) {
          timeString = `${days}d`;
        } else if (hours > 0) {
          timeString = `${hours}h`;
        } else {
          timeString = 'recent';
        }

        return `${index + 1}. <@${p.userId}> - ${(p.cp || 0).toLocaleString()} CP - *${timeString}*`;
      }).join('\n');

      const truncated = tanks.length > 5 ? `\n*... and ${tanks.length - 5} more tank(s)*` : '';

      embed.addFields({
        name: `🛡️ Tanks in Reserve (${tanks.length})`,
        value: tankList + truncated,
        inline: false
      });
    }

    // Add healers
    if (healers.length > 0) {
      const healerList = healers.slice(0, 5).map((p, index) => {
        const timeSinceReserve = Date.now() - new Date(p.reservedAt).getTime();
        const hours = Math.floor(timeSinceReserve / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        let timeString;
        if (days > 0) {
          timeString = `${days}d`;
        } else if (hours > 0) {
          timeString = `${hours}h`;
        } else {
          timeString = 'recent';
        }

        return `${index + 1}. <@${p.userId}> - ${(p.cp || 0).toLocaleString()} CP - *${timeString}*`;
      }).join('\n');

      const truncated = healers.length > 5 ? `\n*... and ${healers.length - 5} more healer(s)*` : '';

      embed.addFields({
        name: `💚 Healers in Reserve (${healers.length})`,
        value: healerList + truncated,
        inline: false
      });
    }

    // Add DPS
    if (dps.length > 0) {
      const dpsList = dps.slice(0, 10).map((p, index) => {
        const timeSinceReserve = Date.now() - new Date(p.reservedAt).getTime();
        const hours = Math.floor(timeSinceReserve / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        let timeString;
        if (days > 0) {
          timeString = `${days}d`;
        } else if (hours > 0) {
          timeString = `${hours}h`;
        } else {
          timeString = 'recent';
        }

        return `${index + 1}. <@${p.userId}> - ${(p.cp || 0).toLocaleString()} CP - *${timeString}*`;
      }).join('\n');

      const truncated = dps.length > 10 ? `\n*... and ${dps.length - 10} more DPS*` : '';

      embed.addFields({
        name: `⚔️ DPS in Reserve (${dps.length})`,
        value: dpsList + truncated,
        inline: false
      });
    }

    embed.setFooter({ 
      text: 'Reserve players are automatically considered during rebalancing every 72 hours' 
    });

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('View reserve error:', err);
    return interaction.editReply({
      content: '❌ Failed to load reserve pool. Please try again.'
    });
  }
}

module.exports = { handleViewReserve };