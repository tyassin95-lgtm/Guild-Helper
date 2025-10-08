const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

async function handlePartiesPanel({ interaction, collections }) {
  const { parties, partyPanels } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  try {
    await interaction.deferReply();

    const allParties = await parties.find({ guildId: interaction.guildId })
      .sort({ partyNumber: 1 })
      .toArray();

    if (allParties.length === 0) {
      return interaction.editReply({ content: '❌ No parties exist yet. Create some first using `/viewparties`!' });
    }

    // Create embeds for each party
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
        const totalCP = members.reduce((sum, m) => sum + (m.cp || 0), 0);
        const avgCP = Math.round(totalCP / members.length);

        // Build member list with role icons
        const memberList = members.map((m, index) => {
          const roleEmojis = getRoleEmojis(m.weapon1, m.weapon2);
          const cp = (m.cp || 0).toLocaleString();
          const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺'][index] || `${index + 1}.`;
          return `${position} <@${m.userId}>\n   ${roleEmojis} ${m.weapon1} / ${m.weapon2} • \`${cp} CP\``;
        }).join('\n\n');

        embed.setDescription(memberList);

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
        const roleCount = {};
        members.forEach(m => {
          const role = `${m.weapon1}/${m.weapon2}`;
          roleCount[role] = (roleCount[role] || 0) + 1;
        });

        const roleComposition = Object.entries(roleCount)
          .map(([role, count]) => `• ${role} (${count})`)
          .join('\n') || '*No roles yet*';

        embed.addFields({
          name: '📊 Role Composition',
          value: roleComposition,
          inline: false
        });
      }

      embeds.push(embed);
    }

    // Create the panel message
    const panelMessage = await interaction.channel.send({ embeds });

    // Save panel info for future updates
    await partyPanels.updateOne(
      { guildId: interaction.guildId },
      { 
        $set: { 
          channelId: interaction.channel.id, 
          messageId: panelMessage.id,
          createdAt: new Date()
        } 
      },
      { upsert: true }
    );

    return interaction.editReply({ 
      content: `✅ Parties panel created in this channel!\n\n[Jump to panel](${panelMessage.url})` 
    });
  } catch (err) {
    console.error('Error creating parties panel:', err);
    if (interaction.deferred) {
      return interaction.editReply({ content: `❌ Failed to create panel: ${err.message}` });
    } else {
      return interaction.reply({ content: `❌ Failed to create panel: ${err.message}`, flags: [64] });
    }
  }
}

// Helper function to get emojis for weapons
function getRoleEmojis(weapon1, weapon2) {
  const weaponEmojis = {
    'Orb': '🔮',
    'Wand': '🪄',
    'Sword & Shield': '🛡️',
    'Greatsword': '⚔️',
    'Staff': '🪶',
    'Bow': '🏹',
    'Crossbows': '🎯',
    'Daggers': '🗡️',
    'Spear': '🔱'
  };

  const emoji1 = weaponEmojis[weapon1] || '❓';
  const emoji2 = weaponEmojis[weapon2] || '❓';

  return `${emoji1} ${emoji2}`;
}

module.exports = { handlePartiesPanel };