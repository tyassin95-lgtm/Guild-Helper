const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { BOSS_DATA } = require('../../../data/bossData');

async function handleSummary({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to view summaries.', ephemeral: true });
  }

  await interaction.deferReply();

  const allWishlists = await wishlists.find({ guildId: interaction.guildId, finalized: true }).toArray();
  if (allWishlists.length === 0) {
    return interaction.editReply('No finalized wishlists found.');
  }

  const handedOutItems = await handedOut.find({ guildId: interaction.guildId }).toArray();
  const handedOutSet = new Set(handedOutItems.map(h => `${h.userId}:${h.item}`));

  const bossSummary = {};
  for (const tier of ['tier2', 'tier3']) {
    for (const boss of Object.keys(BOSS_DATA[tier])) bossSummary[boss] = {};
  }

  for (const wl of allWishlists) {
    const member = await interaction.guild.members.fetch(wl.userId).catch(() => null);
    const displayName = member ? member.displayName : 'Unknown User';
    const allItems = [...wl.weapons, ...wl.armor, ...wl.accessories];

    for (const item of allItems) {
      let itemBoss = null;
      for (const tier of ['tier2', 'tier3']) {
        for (const boss of Object.keys(BOSS_DATA[tier])) {
          const b = BOSS_DATA[tier][boss];
          if ([...b.weapons, ...b.armor, ...b.accessories].includes(item)) {
            itemBoss = boss; break;
          }
        }
        if (itemBoss) break;
      }
      if (itemBoss) {
        if (!bossSummary[itemBoss][item]) bossSummary[itemBoss][item] = [];
        const timestamp = wl.timestamps?.[item];
        const isHandedOut = handedOutSet.has(`${wl.userId}:${item}`);
        bossSummary[itemBoss][item].push({ name: displayName, userId: wl.userId, timestamp, handedOut: isHandedOut });
      }
    }
  }

  const embeds = [];
  for (const boss of Object.keys(bossSummary)) {
    const items = bossSummary[boss];
    if (Object.keys(items).length === 0) continue;

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle(`💀 ${boss.toUpperCase()}`)
      .setTimestamp();

    const bossImg = (BOSS_DATA.tier2[boss]?.image) || (BOSS_DATA.tier3[boss]?.image);
    if (bossImg) embed.setImage(bossImg);

    for (const [item, users] of Object.entries(items)) {
      const userList = users.map(u => {
        const dateStr = u.timestamp ? ` - ${new Date(u.timestamp).toLocaleDateString()}` : '';
        const crossedOut = u.handedOut ? '~~' : '';
        return `${crossedOut}• ${u.name}${dateStr}${crossedOut}`;
      }).join('\n');

      embed.addFields({
        name: `${item} (${users.length})`,
        value: userList.length > 1024 ? userList.substring(0, 1021) + '...' : userList,
        inline: false
      });
    }
    embeds.push(embed);
  }

  if (embeds.length === 0) return interaction.editReply('No items wishlisted yet.');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mark_handed_out').setLabel('Mark Item as Handed Out').setStyle(ButtonStyle.Secondary).setEmoji('✅'),
    new ButtonBuilder().setCustomId('unmark_handed_out').setLabel('Unmark Handed Out').setStyle(ButtonStyle.Secondary).setEmoji('↩️'),
    new ButtonBuilder().setCustomId('clear_handed_out_all').setLabel('Clear All Handed Out').setStyle(ButtonStyle.Danger).setEmoji('🧹')
  );

  return interaction.editReply({ embeds, components: [row] });
}

module.exports = { handleSummary };
