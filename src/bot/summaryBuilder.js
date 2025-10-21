const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { createPvPBonusEmbed } = require('../features/pvp/bonusDisplay');
const { createPvPActivityRankingEmbed } = require('../features/pvp/activityRanking');

// Category icons - you can replace these URLs with your own
const CATEGORY_ICONS = {
  weapon: 'https://i.imgur.com/1m9Zhz5.png',
  armor: 'https://i.imgur.com/e29fB3S.png',
  accessory: 'https://i.imgur.com/5rLVn2f.png'
};

async function buildSummaryEmbedsAndControls(interaction, collections) {
  const { wishlists, handedOut, guildSettings } = collections;

  // Get excluded roles
  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const excludedRoles = settings?.excludedRoles || [];

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

  // Build embeds by category - return as separate messages
  const messages = []; // Array of { embeds: [], components: [] }
  let anyData = false;

  const categoryInfo = [
    { key: 'weapons', title: '⚔️ WEAPONS', color: '#e74c3c', icon: CATEGORY_ICONS.weapon },
    { key: 'armor', title: '🛡️ ARMOR', color: '#3498db', icon: CATEGORY_ICONS.armor },
    { key: 'accessories', title: '💍 ACCESSORIES', color: '#9b59b6', icon: CATEGORY_ICONS.accessory }
  ];

  const MAX_EMBEDS_PER_MESSAGE = 10;
  const MAX_TOTAL_SIZE = 5800; // Safe threshold below 6000

  for (const { key, title, color, icon } of categoryInfo) {
    const items = categorySummary[key];
    const itemNames = Object.keys(items);

    if (itemNames.length === 0) continue;

    anyData = true;

    // Sort items alphabetically
    itemNames.sort((a, b) => a.localeCompare(b));

    let currentMessageEmbeds = [];
    let currentMessageSize = 0;

    let currentEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setThumbnail(icon)
      .setTimestamp();

    let currentEmbedSize = title.length + 100;
    let currentFieldCount = 0;

    for (const itemName of itemNames) {
      const users = items[itemName];

      // Sort users by timestamp (oldest first)
      users.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });

      const userList = users.map(u => {
        return `• ${u.name}`;
      }).join('\n');

      const fieldValue = userList.length > 1024 ? userList.substring(0, 1021) + '...' : userList;
      const fieldName = `${itemName} (${users.length})`;
      const fieldSize = fieldName.length + fieldValue.length;

      // Check if we need to start a new embed
      if (currentFieldCount >= 25 || currentEmbedSize + fieldSize > 5500) {
        currentMessageEmbeds.push(currentEmbed);
        currentMessageSize += currentEmbedSize;

        // Check if we need to start a new message
        if (currentMessageEmbeds.length >= MAX_EMBEDS_PER_MESSAGE || currentMessageSize > MAX_TOTAL_SIZE) {
          messages.push({ embeds: currentMessageEmbeds, components: [] });
          currentMessageEmbeds = [];
          currentMessageSize = 0;
        }

        currentEmbed = new EmbedBuilder()
          .setColor(color)
          .setTitle(`${title} (continued)`)
          .setTimestamp();

        currentEmbedSize = title.length + 100;
        currentFieldCount = 0;
      }

      currentEmbed.addFields({
        name: fieldName,
        value: fieldValue,
        inline: false
      });

      currentEmbedSize += fieldSize;
      currentFieldCount++;
    }

    // Push the last embed for this category
    if (currentFieldCount > 0) {
      currentMessageEmbeds.push(currentEmbed);
      currentMessageSize += currentEmbedSize;
    }

    // Push remaining embeds as a message
    if (currentMessageEmbeds.length > 0) {
      messages.push({ embeds: currentMessageEmbeds, components: [] });
    }
  }

  if (!anyData) {
    messages.push({
      embeds: [
        new EmbedBuilder()
          .setColor('#e67e22')
          .setTitle('No items wishlisted yet.')
          .setTimestamp()
      ],
      components: []
    });
  }

  // Items Handed Out History
  if (handed.length > 0) {
    const handedOutEmbeds = [];
    let currentEmbed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('📦 Items Handed Out')
      .setDescription(`Total items distributed: **${handed.length}**`)
      .setTimestamp();

    let currentEmbedSize = 100;
    let fieldCount = 0;

    // Group by user
    const userGroups = {};
    for (const h of handed) {
      if (!userGroups[h.userId]) {
        userGroups[h.userId] = [];
      }
      userGroups[h.userId].push(h);
    }

    const sortedUsers = Object.entries(userGroups).sort((a, b) => b[1].length - a[1].length);

    for (const [userId, items] of sortedUsers) {
      if (fieldCount >= 25) {
        handedOutEmbeds.push(currentEmbed);
        currentEmbed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('📦 Items Handed Out (continued)')
          .setTimestamp();
        currentEmbedSize = 100;
        fieldCount = 0;
      }

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown User';

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const itemList = items.map(h => {
        const dateStr = h.timestamp ? ` - ${new Date(h.timestamp).toLocaleDateString()}` : '';
        return `• ${h.item}${dateStr}`;
      }).join('\n');

      const truncated = itemList.length > 1024 ? itemList.substring(0, 1021) + '...' : itemList;
      const fieldName = `${displayName} (${items.length} item${items.length !== 1 ? 's' : ''})`;
      const fieldSize = fieldName.length + truncated.length;

      if (currentEmbedSize + fieldSize > 5500 && fieldCount > 0) {
        handedOutEmbeds.push(currentEmbed);
        currentEmbed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('📦 Items Handed Out (continued)')
          .setTimestamp();
        currentEmbedSize = 100;
        fieldCount = 0;
      }

      currentEmbed.addFields({
        name: fieldName,
        value: truncated,
        inline: false
      });

      currentEmbedSize += fieldSize;
      fieldCount++;
    }

    if (fieldCount > 0) {
      handedOutEmbeds.push(currentEmbed);
    }

    // Add handed out embeds to messages
    if (handedOutEmbeds.length > 0) {
      messages.push({ embeds: handedOutEmbeds, components: [] });
    }
  }

  // NEW: Add PvP Bonus embed
  const pvpBonusEmbed = await createPvPBonusEmbed(interaction.guildId, interaction.guild, collections);
  messages.push({ embeds: [pvpBonusEmbed], components: [] });

  // NEW: Add PvP Activity Ranking embed
  const pvpActivityEmbed = await createPvPActivityRankingEmbed(interaction.guildId, interaction.guild, collections);
  messages.push({ embeds: [pvpActivityEmbed], components: [] });

  // Submission footer
  await interaction.guild.members.fetch();

  const humans = interaction.guild.members.cache.filter(m => {
    if (m.user.bot) return false;
    if (excludedRoles.length > 0) {
      const hasExcludedRole = m.roles.cache.some(role => excludedRoles.includes(role.id));
      if (hasExcludedRole) return false;
    }
    return true;
  });

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

  if (excludedRoles.length > 0) {
    const roleNames = [];
    for (const roleId of excludedRoles) {
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (role) roleNames.push(role.name);
    }
    if (roleNames.length > 0) {
      footerEmbed.setDescription(`*Excluding members with: ${roleNames.join(', ')}*`);
    }
  }

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

  // Admin controls go on the LAST message
  const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
  const adminControls = [];

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
    adminControls.push(row);
  }

  messages.push({ embeds: [footerEmbed], components: adminControls });

  return { messages };
}

module.exports = { buildSummaryEmbedsAndControls };