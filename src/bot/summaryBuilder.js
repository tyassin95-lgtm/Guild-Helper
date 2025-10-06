const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { BOSS_DATA } = require('../data/bossData'); // static file

function chunkLinesTo1024(arr) {
  if (!arr || arr.length === 0) return ['—'];
  const lines = arr.sort((a, b) => a.localeCompare(b)).map(n => `• ${n}`);
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    const candidate = cur ? `${cur}\n${line}` : line;
    if (candidate.length > 1024) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = candidate;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// legacy helper: when we only have a string item and no stored boss
function bestGuessBossForItem(itemName) {
  for (const tier of ['tier2','tier3']) {
    for (const boss of Object.keys(BOSS_DATA[tier])) {
      const b = BOSS_DATA[tier][boss];
      if ([...b.weapons, ...b.armor, ...b.accessories].includes(itemName)) {
        return boss;
      }
    }
  }
  return null;
}

async function buildSummaryEmbedsAndControls(interaction, collections) {
  const { wishlists, handedOut } = collections;

  const allWishlists = await wishlists.find({ guildId: interaction.guildId, finalized: true }).toArray();

  // handedOut now distinguished by boss too: key = `${userId}:${boss}:${name}`
  const handed = await handedOut.find({ guildId: interaction.guildId }).toArray();
  const handedOutSet = new Set(handed.map(h => `${h.userId}:${h.boss || ''}:${h.item}`));

  // Prepare boss buckets
  const bossSummary = {};
  for (const tier of ['tier2','tier3']) for (const boss of Object.keys(BOSS_DATA[tier])) bossSummary[boss] = {};

  // Aggregate items under their stored boss (object form) or best-guess for legacy strings
  for (const wl of allWishlists) {
    const member = await interaction.guild.members.fetch(wl.userId).catch(() => null);
    const displayName = member ? member.displayName : 'Unknown User';

    const packs = [
      ...(wl.weapons || []).map(v => ({ type: 'weapon', v })),
      ...(wl.armor || []).map(v => ({ type: 'armor', v })),
      ...(wl.accessories || []).map(v => ({ type: 'accessory', v }))
    ];

    for (const { v } of packs) {
      const name = typeof v === 'string' ? v : v.name;
      const boss = typeof v === 'string' ? bestGuessBossForItem(name) : v.boss;
      const addedAt = typeof v === 'string' ? wl.timestamps?.[name] : v.addedAt;

      if (!boss) continue; // unknown legacy string with no match

      if (!bossSummary[boss][name]) bossSummary[boss][name] = [];
      const isHandedOut = handedOutSet.has(`${wl.userId}:${boss}:${name}`);

      bossSummary[boss][name].push({
        name: displayName,
        userId: wl.userId,
        timestamp: addedAt,
        handedOut: isHandedOut
      });
    }
  }

  // Compose embeds
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

    for (const [itemName, users] of Object.entries(items)) {
      const userList = users.map(u => {
        const dateStr = u.timestamp ? ` - ${new Date(u.timestamp).toLocaleDateString()}` : '';
        const crossedOut = u.handedOut ? '~~' : '';
        return `${crossedOut}• ${u.name}${dateStr}${crossedOut}`;
      }).join('\n');

      embed.addFields({
        name: `${itemName} (${users.length})`,
        value: userList.length > 1024 ? userList.substring(0, 1021) + '...' : userList,
        inline: false
      });
    }

    embeds.push(embed);
  }

  if (!anyBossData) {
    embeds.push(new EmbedBuilder().setColor('#e67e22').setTitle('No items wishlisted yet.').setTimestamp());
  }

  // Admin-only controls (hidden from regular members)
  const components = [];
  const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

  if (isAdmin) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mark_handed_out').setLabel('Mark Item as Handed Out').setStyle(ButtonStyle.Secondary).setEmoji('✅'),
      new ButtonBuilder().setCustomId('unmark_handed_out').setLabel('Unmark Handed Out').setStyle(ButtonStyle.Secondary).setEmoji('↩️'),
      new ButtonBuilder().setCustomId('clear_handed_out_all').setLabel('Clear All Handed Out').setStyle(ButtonStyle.Danger).setEmoji('🧹')
    );
    components.push(row);
  }

  // Submission footer
  await interaction.guild.members.fetch();
  const humans = interaction.guild.members.cache.filter(m => !m.user.bot);
  const finalizedIds = new Set(allWishlists.map(w => w.userId));
  const submitted = [];
  const notSubmitted = [];

  for (const m of humans.values()) {
    if (finalizedIds.has(m.id)) submitted.push(m.displayName);
    else notSubmitted.push(m.displayName);
  }

  const linesToChunks = (arr) => {
    if (!arr.length) return ['—'];
    const lines = arr.sort((a, b) => a.localeCompare(b)).map(n => `• ${n}`);
    const chunks = []; let cur = '';
    for (const line of lines) {
      if ((cur + '\n' + line).trim().length > 1024) { chunks.push(cur.trim()); cur = line; }
      else cur = cur ? cur + '\n' + line : line;
    }
    if (cur) chunks.push(cur.trim());
    return chunks;
  };

  const submittedChunks = linesToChunks(submitted);
  const notSubmittedChunks = linesToChunks(notSubmitted);

  const footerEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('📝 Submission Status').setTimestamp();
  (submittedChunks.length === 1)
    ? footerEmbed.addFields({ name: `Submitted (${submitted.length})`, value: submittedChunks[0] })
    : submittedChunks.forEach((chunk, i) => footerEmbed.addFields({ name: `Submitted (${submitted.length}) — Part ${i + 1}`, value: chunk }));

  (notSubmittedChunks.length === 1)
    ? footerEmbed.addFields({ name: `Not Submitted (${notSubmitted.length})`, value: notSubmittedChunks[0] })
    : notSubmittedChunks.forEach((chunk, i) => footerEmbed.addFields({ name: `Not Submitted (${notSubmitted.length}) — Part ${i + 1}`, value: chunk }));

  embeds.push(footerEmbed);

  return { embeds, components };
}

module.exports = { buildSummaryEmbedsAndControls };
