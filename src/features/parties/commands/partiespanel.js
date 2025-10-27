const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getRoleEmoji } = require('../roleDetection');
const { getReservePlayers } = require('../reserve');

async function handlePartiesPanel({ interaction, collections }) {
  const { partyPanels, parties, guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // CRITICAL: Defer immediately before any async operations
  await interaction.deferReply({ flags: [64] });

  try {
    const settings = await guildSettings.findOne({ guildId: interaction.guildId });
    const maxParties = settings?.maxParties || 10;

    // Get all parties (only up to maxParties)
    const allParties = await parties.find({ 
      guildId: interaction.guildId,
      partyNumber: { $lte: maxParties }
    }).sort({ partyNumber: 1 }).toArray();

    // Get reserve players
    const reservePlayers = await getReservePlayers(interaction.guildId, collections);

    if (allParties.length === 0 && reservePlayers.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle('⚔️ Static Parties')
        .setDescription('No parties have been created yet.')
        .setTimestamp();

      const message = await interaction.channel.send({ embeds: [embed] });

      // Store panel info
      await partyPanels.updateOne(
        { guildId: interaction.guildId },
        {
          $set: {
            channelId: interaction.channelId,
            messageId: message.id,
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      return interaction.editReply({
        content: '✅ Parties panel created! It will auto-update every 60 seconds.'
      });
    }

    // Build embeds for each party
    const embeds = [];

    for (const party of allParties) {
      const members = party.members || [];
      const embed = new EmbedBuilder()
        .setColor(members.length >= 6 ? '#10B981' : members.length >= 4 ? '#F59E0B' : '#EF4444')
        .setTitle(`⚔️ Party ${party.partyNumber}`)
        .setTimestamp();

      if (members.length === 0) {
        embed.setDescription('```\n🔓 OPEN - No members assigned yet\n```');
        embed.addFields({ name: 'Status', value: '`0/6 slots filled`', inline: true });
      } else {
        // Calculate total CP
        const totalCP = party.totalCP || 0;
        const avgCP = Math.round(totalCP / members.length);

        // Build member list with role icons
        const memberList = await Promise.all(members.map(async (m, index) => {
          const roleIcon = getRoleEmoji(m.role);
          const cp = (m.cp || 0).toLocaleString();
          const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺'][index] || `${index + 1}.`;

          return `${position} <@${m.userId}>\n   ${roleIcon} ${m.weapon1} / ${m.weapon2} • \`${cp} CP\``;
        }));

        embed.setDescription(memberList.join('\n\n'));

        // Stats fields
        const statusEmoji = members.length >= 6 ? '✅' : members.length >= 4 ? '⚠️' : '❌';
        embed.addFields(
          { 
            name: 'Party Status', 
            value: `${statusEmoji} \`${members.length}/6 slots filled\``, 
            inline: true 
          },
          { 
            name: 'Total CP', 
            value: `\`${totalCP.toLocaleString()}\``, 
            inline: true 
          },
          { 
            name: 'Average CP', 
            value: `\`${avgCP.toLocaleString()}\``, 
            inline: true 
          }
        );

        // Role composition
        const roleComposition = party.roleComposition || { tank: 0, healer: 0, dps: 0 };
        const roleText = [
          `🛡️ Tanks: ${roleComposition.tank}`,
          `💚 Healers: ${roleComposition.healer}`,
          `⚔️ DPS: ${roleComposition.dps}`
        ].join('\n');

        embed.addFields({
          name: '📊 Role Composition',
          value: roleText,
          inline: false
        });
      }

      embeds.push(embed);
    }

    // Always add reserve pool embed (even if empty) to prevent flickering
    const reserveEmbed = new EmbedBuilder()
      .setColor(reservePlayers.length > 0 ? '#e67e22' : '#95a5a6')
      .setTitle('📋 Reserve Pool')
      .setTimestamp();

    if (reservePlayers.length === 0) {
      // Empty reserve pool
      reserveEmbed.setDescription('```\n✅ Reserve pool is empty - all players assigned!\n```');
      reserveEmbed.addFields({
        name: 'ℹ️ About Reserve',
        value: 
          '• When max parties is reached, new players go to reserve\n' +
          '• Reserve players are promoted during rebalancing (every 72 hours)\n' +
          '• Update CP with `/myinfo` to improve reserve position',
        inline: false
      });
    } else {
      // Group by role
      const tanks = reservePlayers.filter(p => p.role === 'tank');
      const healers = reservePlayers.filter(p => p.role === 'healer');
      const dpsPlayers = reservePlayers.filter(p => p.role === 'dps');

      // Build description with all reserve players
      const reserveList = [];

      // Add tanks
      if (tanks.length > 0) {
        reserveList.push('**🛡️ TANKS**');
        for (let i = 0; i < tanks.length; i++) {
          const p = tanks[i];
          const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺', '⓻', '⓼', '⓽', '⓾'][i] || `${i + 1}.`;
          const roleIcon = getRoleEmoji(p.role);
          const cp = (p.cp || 0).toLocaleString();
          reserveList.push(`${position} <@${p.userId}>\n   ${roleIcon} ${p.weapon1} / ${p.weapon2} • \`${cp} CP\``);
        }
        reserveList.push(''); // Spacing
      }

      // Add healers
      if (healers.length > 0) {
        reserveList.push('**💚 HEALERS**');
        for (let i = 0; i < healers.length; i++) {
          const p = healers[i];
          const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺', '⓻', '⓼', '⓽', '⓾'][i] || `${i + 1}.`;
          const roleIcon = getRoleEmoji(p.role);
          const cp = (p.cp || 0).toLocaleString();
          reserveList.push(`${position} <@${p.userId}>\n   ${roleIcon} ${p.weapon1} / ${p.weapon2} • \`${cp} CP\``);
        }
        reserveList.push(''); // Spacing
      }

      // Add DPS
      if (dpsPlayers.length > 0) {
        reserveList.push('**⚔️ DPS**');
        for (let i = 0; i < dpsPlayers.length; i++) {
          const p = dpsPlayers[i];
          const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺', '⓻', '⓼', '⓽', '⓾'][i] || `${i + 1}.`;
          const roleIcon = getRoleEmoji(p.role);
          const cp = (p.cp || 0).toLocaleString();
          reserveList.push(`${position} <@${p.userId}>\n   ${roleIcon} ${p.weapon1} / ${p.weapon2} • \`${cp} CP\``);
        }
      }

      reserveEmbed.setDescription(reserveList.join('\n'));

      // Add stats fields
      const totalReserveCP = reservePlayers.reduce((sum, p) => sum + (p.cp || 0), 0);
      const avgReserveCP = reservePlayers.length > 0 ? Math.round(totalReserveCP / reservePlayers.length) : 0;

      reserveEmbed.addFields(
        { 
          name: 'Reserve Status', 
          value: `\`${reservePlayers.length} players in reserve\``, 
          inline: true 
        },
        { 
          name: 'Total CP', 
          value: `\`${totalReserveCP.toLocaleString()}\``, 
          inline: true 
        },
        { 
          name: 'Average CP', 
          value: `\`${avgReserveCP.toLocaleString()}\``, 
          inline: true 
        }
      );

      // Add role breakdown
      const roleText = [
        `🛡️ Tanks: ${tanks.length}`,
        `💚 Healers: ${healers.length}`,
        `⚔️ DPS: ${dpsPlayers.length}`
      ].join('\n');

      reserveEmbed.addFields({
        name: '📊 Role Breakdown',
        value: roleText,
        inline: false
      });

      reserveEmbed.addFields({
        name: 'ℹ️ About Reserve',
        value: 
          '• Players prioritized by: Role → CP → Time in reserve\n' +
          '• Automatically promoted during rebalancing (every 72 hours)\n' +
          '• Update CP with `/myinfo` to improve reserve position',
        inline: false
      });
    }

    embeds.push(reserveEmbed);

    // Discord allows up to 10 embeds per message
    if (embeds.length > 10) {
      console.warn(`Guild ${interaction.guildId} has ${embeds.length} embeds, truncating to 10`);
      embeds.splice(10);
    }

    // Send the panel message
    const message = await interaction.channel.send({ embeds });

    // Store panel info
    await partyPanels.updateOne(
      { guildId: interaction.guildId },
      {
        $set: {
          channelId: interaction.channelId,
          messageId: message.id,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    return interaction.editReply({
      content: '✅ Parties panel created! It will auto-update every 60 seconds.'
    });
  } catch (err) {
    console.error('Error creating parties panel:', err);
    return interaction.editReply({
      content: '❌ Failed to create parties panel. Please try again.'
    });
  }
}

module.exports = { handlePartiesPanel };