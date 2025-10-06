const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const { BOSS_DATA } = require('../../../data/bossData');

function chunkLinesTo1024(arr) {
  if (!arr || arr.length === 0) return ['—'];
  // sort for consistency
  const lines = arr.sort((a, b) => a.localeCompare(b)).map(n => `• ${n}`);
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const candidate = cur ? `${cur}\n${line}` : line;
    if (candidate.length > 1024) {
      chunks.push(cur);
      cur = line;
    } else {
      cur = candidate;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function handleSummary({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to view summaries.', ephemeral: true });
  }

  await interaction.deferReply();

  // Load all FINALIZED wishlists for the boss summary
  const allWishlists = await wishlists.find({
    guildId: interaction.guildId,
    finalized: true
  }).toArray();

  if (allWishlists.length === 0) {
    // Still show submission footer below by continuing; but if you prefer, early-return here.
    // For parity with earlier behavior, keep current message:
    // return interaction.editReply('No finalized wishlists found.');
  }

  // Handed-out records
  const handedOutItems = await handedOut.find({ guildId: interaction.guildId }).toArray();
  const handedOutSet = new Set(handedOutItems.map(h => `${h.userId}:${h.item}`));

  // Build per-boss lists
  const bossSummary = {};
  for (const tier of ['tier2', 'tier3']) {
    for (const boss of Object.keys(BOSS_DATA[tier])) bossSummary[boss] = {};
  }

  for (const wl of allWishlists) {
    const member = await interaction.guild.members.fetch(wl.userId).catch(() => null);
    const displayName = member ? member.displayName : 'Unknown User';
    const allItems = [...wl.weapons, ...wl.armor, ...wl.accessories];

    for (const item of allItems) {
      // determine which boss this item is from
      let itemBoss = null;
      for (const tier of ['tier2', 'tier3']) {
        for (const boss of Object.keys(BOSS_DATA[tier])) {
          const b = BOSS_DATA[tier][boss];
          if ([...b.weapons, ...b.armor, ...b.accessories].includes(item)) {
            itemBoss = boss;
            break;
          }
        }
        if (itemBoss) break;
      }

      if (itemBoss) {
        if (!bossSummary[itemBoss][item]) bossSummary[itemBoss][item] = [];
        const timestamp = wl.timestamps?.[item];
        const isHandedOut = handedOutSet.has(`${wl.userId}:${item}`);
        bossSummary[itemBoss][item].push({
          name: displayName,
          userId: wl.userId,
          timestamp,
          handedOut: isHandedOut
        });
      }
    }
  }

  // Compose embeds for each boss
  const embeds = [];
  let anyBossData = false;

  for (const boss of Object.keys(bossSummary)) {
    const items = bossSummary[boss];
    if (Object.keys(items).length === 0) continue;

    anyBossData = true;
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

  if (!anyBossData) {
    // Keep at least one informational embed if there are no boss items yet
    embeds.push(
      new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle('No items wishlisted yet.')
        .setTimestamp()
    );
  }

  // Controls (handout management)
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mark_handed_out')
      .setLabel('Mark Item as Handed Out')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId('unmark_handed_out')
      .setLabel('Unmark Handed Out')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️'),
    new ButtonBuilder()
      .setCustomId('clear_handed_out_all')
      .setLabel('Clear All Handed Out')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🧹')
  );

  // ===== NEW: Append member submission status at the bottom =====
  // Make sure we have the full member list (requires GuildMembers intent +
  // Server Members Intent enabled in the Developer Portal)
  await interaction.guild.members.fetch();

  const humans = interaction.guild.members.cache.filter(m => !m.user.bot);
  const finalizedIds = new Set(allWishlists.map(w => w.userId));
  const submitted = [];
  const notSubmitted = [];

  for (const m of humans.values()) {
    if (finalizedIds.has(m.id)) submitted.push(m.displayName);
    else notSubmitted.push(m.displayName);
  }

  const submittedChunks = chunkLinesTo1024(submitted);
  const notSubmittedChunks = chunkLinesTo1024(notSubmitted);

  const footerEmbed = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle('📝 Submission Status')
    .setTimestamp();

  if (submittedChunks.length === 1) {
    footerEmbed.addFields({ name: `Submitted (${submitted.length})`, value: submittedChunks[0] });
  } else {
    submittedChunks.forEach((chunk, i) => {
      footerEmbed.addFields({ name: `Submitted (${submitted.length}) — Part ${i + 1}`, value: chunk });
    });
  }

  if (notSubmittedChunks.length === 1) {
    footerEmbed.addFields({ name: `Not Submitted (${notSubmitted.length})`, value: notSubmittedChunks[0] });
  } else {
    notSubmittedChunks.forEach((chunk, i) => {
      footerEmbed.addFields({ name: `Not Submitted (${notSubmitted.length}) — Part ${i + 1}`, value: chunk });
    });
  }

  // Add this as the LAST embed so it appears at the bottom
  embeds.push(footerEmbed);

  return interaction.editReply({ embeds, components: [row] });
}

module.exports = { handleSummary };