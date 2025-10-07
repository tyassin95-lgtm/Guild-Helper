const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Category icons - you can replace these URLs with your own
const CATEGORY_ICONS = {
  weapon: 'https://i.imgur.com/1m9Zhz5.png',
  armor: 'https://i.imgur.com/e29fB3S.png',
  accessory: 'https://i.imgur.com/5rLVn2f.png'
};

async function buildSummaryEmbedsAndControls(interaction, collections) {
  const { wishlists, handedOut } = collections;

  const allWishlists = await wishlists.find({ guildId: interaction.guildId, finalized: true }).toArray();

  // handedOut now distinguished by boss too: key = `${userId}:${boss}:${name}`
  const handed = await handedOut.find({ guildId: interaction.guildId }).toArray();
  const handedOutSet = new Set(handed.map(h => `${h.userId}:${h.boss || ''}:${h.item}`));

  // Organize by category -> item name -> array of users
  const categorySummary = {
    weapons: {},
    armor: {},
    accessories: {}
  };

  // Aggregate items
  for (const wl of allWishlists) {
    const member = await interaction.guild.members.fetch(wl.userId).catch(() => null);
    const displayName = member ? member.displayName : 'Unknown User';

    const packs = [
      ...(wl.weapons || []).map(v => ({ type: 'weapon', v, categoryKey: 'weapons' })),
      ...(wl.armor || []).map(v => ({ type: 'armor', v, categoryKey: 'armor' })),
      ...(wl.accessories || []).map(v => ({ type: 'accessory', v, categoryKey: 'accessories' }))
    ];

    for (const { v, categoryKey } of packs) {
      const name = typeof v === 'string' ? v : v.name;
      const boss = typeof v === 'string' ? null : v.boss;
      const addedAt = typeof v === 'string' ? wl.timestamps?.[name] : v.addedAt;

      if (!categorySummary[categoryKey][name]) {
        categorySummary[categoryKey][name] = [];
      }

      const isHandedOut = handedOutSet.has(`${wl.userId}:${boss || ''}:${name}`);

      categorySummary[categoryKey][name].push({
        name: displayName,
        userId: wl.userId,
        boss,
        timestamp: addedAt,
        handedOut: isHandedOut
      });
    }
  }

  // Build embeds by category
  const embeds = [];
  let anyData = false;

  const categoryInfo = [
    { key: 'weapons', title: '⚔️ WEAPONS', color: '#e74c3c', icon: CATEGORY_ICONS.weapon },
    { key: 'armor', title: '🛡️ ARMOR', color: '#3498db', icon: CATEGORY_ICONS.armor },
    { key: 'accessories', title: '💍 ACCESSORIES', color: '#9b59b6', icon: CATEGORY_ICONS.accessory }
  ];

  for (const { key, title, color, icon } of categoryInfo) {
    const items = categorySummary[key];
    const itemNames = Object.keys(items);

    if (itemNames.length === 0) continue;

    anyData = true;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setThumbnail(icon)
      .setTimestamp();

    // Sort items alphabetically
    itemNames.sort((a, b) => a.localeCompare(b));

    for (const itemName of itemNames) {
      const users = items[itemName];

      // Sort users by timestamp (oldest first)
      users.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });

      const userList = users.map(u => {
        const dateStr = u.timestamp ? ` - ${new Date(u.timestamp).toLocaleDateString()}` : '';
        const bossStr = u.boss ? ` (${u.boss})` : '';
        const crossedOut = u.handedOut ? '~~' : '';
        return `${crossedOut}• ${u.name}${dateStr}${bossStr}${crossedOut}`;
      }).join('\n');

      // Handle long field values (Discord limit is 1024 chars)
      const fieldValue = userList.length > 1024 ? userList.substring(0, 1021) + '...' : userList;

      embed.addFields({
        name: `${itemName} (${users.length})`,
        value: fieldValue,
        inline: false
      });
    }

    embeds.push(embed);
  }

  if (!anyData) {
    embeds.push(
      new EmbedBuilder()
        .setColor('#e67e22')
        .setTitle('No items wishlisted yet.')
        .setTimestamp()
    );
  }

  // Admin-only controls
  const components = [];
  const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

  if (isAdmin) {
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
    components.push(row);
  }

  // NEW: Items Handed Out History
  if (handed.length > 0) {
    const handedOutEmbed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('📦 Items Handed Out')
      .setDescription(`Total items distributed: **${handed.length}**`)
      .setTimestamp();

    // Group by user
    const userGroups = {};
    for (const h of handed) {
      if (!userGroups[h.userId]) {
        userGroups[h.userId] = [];
      }
      userGroups[h.userId].push(h);
    }

    // Build fields for each user (sorted by most items first)
    const sortedUsers = Object.entries(userGroups).sort((a, b) => b[1].length - a[1].length);

    for (const [userId, items] of sortedUsers) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown User';

      // Sort items by timestamp (most recent first)
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const itemList = items.map(h => {
        const dateStr = h.timestamp ? ` - ${new Date(h.timestamp).toLocaleDateString()}` : '';
        const bossStr = h.boss ? ` from **${h.boss}**` : '';
        return `• ${h.item}${bossStr}${dateStr}`;
      }).join('\n');

      // Handle Discord's 1024 character limit per field
      const truncated = itemList.length > 1024 ? itemList.substring(0, 1021) + '...' : itemList;

      handedOutEmbed.addFields({
        name: `${displayName} (${items.length} item${items.length !== 1 ? 's' : ''})`,
        value: truncated,
        inline: false
      });

      // Discord has a 25 field limit per embed
      if (handedOutEmbed.data.fields?.length >= 25) {
        break;
      }
    }

    embeds.push(handedOutEmbed);
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
    const chunks = [];
    let cur = '';
    for (const line of lines) {
      if ((cur + '\n' + line).trim().length > 1024) {
        chunks.push(cur.trim());
        cur = line;
      } else {
        cur = cur ? cur + '\n' + line : line;
      }
    }
    if (cur) chunks.push(cur.trim());
    return chunks;
  };

  const submittedChunks = linesToChunks(submitted);
  const notSubmittedChunks = linesToChunks(notSubmitted);

  const footerEmbed = new EmbedBuilder()
    .setColor('#2ecc71')
    .setTitle('📝 Submission Status')
    .setTimestamp();

  if (submittedChunks.length === 1) {
    footerEmbed.addFields({
      name: `Submitted (${submitted.length})`,
      value: submittedChunks[0]
    });
  } else {
    submittedChunks.forEach((chunk, i) => {
      footerEmbed.addFields({
        name: `Submitted (${submitted.length}) — Part ${i + 1}`,
        value: chunk
      });
    });
  }

  if (notSubmittedChunks.length === 1) {
    footerEmbed.addFields({
      name: `Not Submitted (${notSubmitted.length})`,
      value: notSubmittedChunks[0]
    });
  } else {
    notSubmittedChunks.forEach((chunk, i) => {
      footerEmbed.addFields({
        name: `Not Submitted (${notSubmitted.length}) — Part ${i + 1}`,
        value: chunk
      });
    });
  }

  embeds.push(footerEmbed);

  return { embeds, components };
}

module.exports = { buildSummaryEmbedsAndControls };