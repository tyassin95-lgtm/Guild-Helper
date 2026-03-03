const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getRoleEmoji } = require('../roleDetection');
const { RESERVE_PARTY_SIZE } = require('../constants');

async function handlePartiesPanel({ interaction, collections }) {
  const { partyPanels, parties } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    // Get all parties - sort with reserve last
    const allParties = await parties.find({ 
      guildId: interaction.guildId
    }).sort({ isReserve: 1, partyNumber: 1 }).toArray();

    if (allParties.length === 0) {
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
            messageIds: [message.id],
            createdAt: new Date()
          },
          $unset: { messageId: '' }
        },
        { upsert: true }
      );

      return interaction.editReply({
        content: '✅ Parties panel created!'
      });
    }

    // Build embeds for each party
    const embeds = [];

    for (const party of allParties) {
      const members = party.members || [];

      // Special handling for reserve party
      if (party.isReserve) {
        const embed = new EmbedBuilder()
          .setColor('#FFA500') // Orange for reserve
          .setTitle('📦 Reserve Party')
          .setTimestamp();

        if (members.length === 0) {
          embed.setDescription('```\n🔓 EMPTY - No reserve members yet\n```');
          embed.addFields({ name: 'Status', value: `\`0/${RESERVE_PARTY_SIZE} slots filled\``, inline: true });
        } else {
          // Calculate total CP
          const totalCP = party.totalCP || 0;
          const avgCP = Math.round(totalCP / members.length);

          // Build member list with role icons (sorted by CP descending)
          const sortedMembers = [...members].sort((a, b) => (b.cp || 0) - (a.cp || 0));

          const memberList = await Promise.all(sortedMembers.map(async (m, index) => {
            const roleIcon = getRoleEmoji(m.role);
            const cp = (m.cp || 0).toLocaleString();
            const position = index + 1;

            // Add crown for party leader
            const leaderCrown = m.isLeader ? '👑 ' : '';
            const playerTagSuffix = m.playerTag ? ` • 🎯 \`${m.playerTag}\`` : '';

            return `${position}. ${leaderCrown}<@${m.userId}>\n   ${roleIcon} ${m.weapon1} / ${m.weapon2} • \`${cp} CP\`${playerTagSuffix}`;
          }));

          embed.setDescription(memberList.join('\n\n'));

          // Stats fields
          const statusEmoji = members.length >= RESERVE_PARTY_SIZE ? '⚠️' : '✅';
          embed.addFields(
            { 
              name: 'Reserve Status', 
              value: `${statusEmoji} \`${members.length}/${RESERVE_PARTY_SIZE} slots filled\``, 
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

          embed.setFooter({ text: 'Reserve members are standby for active parties' });
        }

        embeds.push(embed);
        continue;
      }

      // Regular party handling
      const partyTitles = party.titles || [];
      const titleSuffix = partyTitles.length > 0 ? ` — ${partyTitles.join(' · ')}` : '';
      const embed = new EmbedBuilder()
        .setColor(members.length >= 6 ? '#10B981' : members.length >= 4 ? '#F59E0B' : '#EF4444')
        .setTitle(`⚔️ Party ${party.partyNumber}${titleSuffix}`)
        .setTimestamp();

      if (members.length === 0) {
        embed.setDescription('```\n🔓 OPEN - No members assigned yet\n```');
        embed.addFields({ name: 'Status', value: '`0/6 slots filled`', inline: true });
      } else {
        // Calculate total CP
        const totalCP = party.totalCP || 0;
        const avgCP = Math.round(totalCP / members.length);

        // Build member list with role icons and leader crown
        const memberList = await Promise.all(members.map(async (m, index) => {
          const roleIcon = getRoleEmoji(m.role);
          const cp = (m.cp || 0).toLocaleString();
          const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺'][index] || `${index + 1}.`;

          // Add crown for party leader
          const leaderCrown = m.isLeader ? '👑 ' : '';
          const playerTagSuffix = m.playerTag ? ` • 🎯 \`${m.playerTag}\`` : '';

          return `${position} ${leaderCrown}<@${m.userId}>\n   ${roleIcon} ${m.weapon1} / ${m.weapon2} • \`${cp} CP\`${playerTagSuffix}`;
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

    // Discord allows up to 10 embeds per message, split into chunks
    const messageIds = [];
    for (let i = 0; i < embeds.length; i += 10) {
      const chunk = embeds.slice(i, i + 10);
      const message = await interaction.channel.send({ embeds: chunk });
      messageIds.push(message.id);
    }

    // Store panel info
    await partyPanels.updateOne(
      { guildId: interaction.guildId },
      {
        $set: {
          channelId: interaction.channelId,
          messageIds: messageIds,
          createdAt: new Date()
        },
        $unset: { messageId: '' }
      },
      { upsert: true }
    );

    return interaction.editReply({
      content: '✅ Parties panel created!'
    });
  } catch (err) {
    console.error('Error creating parties panel:', err);
    return interaction.editReply({
      content: '❌ Failed to create parties panel. Please try again.'
    });
  }
}

module.exports = { handlePartiesPanel };