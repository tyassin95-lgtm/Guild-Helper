// Handler for /giveitem command
const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { WISHLIST_ITEMS, getItemById } = require('../utils/items');
const { updateWishlistPanels } = require('./wishlists');

// Store pending distributions (in memory for this session)
const pendingDistributions = new Map();

async function handleGiveItem({ interaction, collections, client }) {
  const { wishlistSubmissions } = collections;

  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to use this command.',
      flags: [64]
    });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    // Get all wishlist submissions in this guild
    const submissions = await wishlistSubmissions.find({ guildId: interaction.guildId }).toArray();

    if (submissions.length === 0) {
      return interaction.editReply({
        content: '❌ No wishlists have been submitted yet.'
      });
    }

    // Collect all wishlisted items with user counts
    const itemUserMap = new Map();

    for (const submission of submissions) {
      const processItems = (itemIds) => {
        if (!itemIds) return;
        for (const itemId of itemIds) {
          if (!itemUserMap.has(itemId)) {
            itemUserMap.set(itemId, []);
          }
          itemUserMap.get(itemId).push(submission.userId);
        }
      };

      processItems(submission.archbossWeapon);
      processItems(submission.archbossArmor);
      processItems(submission.t3Weapons);
      processItems(submission.t3Armors);
      processItems(submission.t3Accessories);
    }

    if (itemUserMap.size === 0) {
      return interaction.editReply({
        content: '❌ No items are currently wishlisted.'
      });
    }

    // Sort items by category
    const sortedItems = Array.from(itemUserMap.keys())
      .map(id => {
        const item = getItemById(id);
        return item ? { ...item, userCount: itemUserMap.get(id).length } : null;
      })
      .filter(item => item !== null)
      .sort((a, b) => {
        // Sort by category/type, then by name
        const catA = a.category || a.type || '';
        const catB = b.category || b.type || '';
        if (catA !== catB) return catA.localeCompare(catB);
        return a.name.localeCompare(b.name);
      });

    // Initialize pending distribution
    const sessionKey = `${interaction.guildId}_${interaction.user.id}`;
    pendingDistributions.set(sessionKey, {
      itemUserMap,
      selectedDistributions: new Map() // itemId -> [userIds]
    });

    // Show first page of items
    await showItemSelectionPage(interaction, sortedItems, 0, sessionKey, collections);

  } catch (error) {
    console.error('Error in /giveitem:', error);
    await interaction.editReply({
      content: '❌ An error occurred while loading wishlisted items.'
    });
  }
}

/**
 * Show a page of items to select from
 */
async function showItemSelectionPage(interaction, allItems, page, sessionKey, collections) {
  const itemsPerPage = 25;
  const totalPages = Math.ceil(allItems.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageItems = allItems.slice(startIdx, endIdx);

  // Build select menu options
  const options = pageItems.map(item => {
    return new StringSelectMenuOptionBuilder()
      .setLabel(item.name)
      .setValue(item.id)
      .setDescription(`${item.category || item.type} - ${item.userCount} user(s)`);
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`giveitem_select_item:${page}:${sessionKey}`)
    .setPlaceholder(`Select an item to see who wishlisted it... (Page ${page + 1}/${totalPages})`)
    .setMinValues(1)
    .setMaxValues(1) // Select one item at a time
    .addOptions(options);

  const components = [new ActionRowBuilder().addComponents(selectMenu)];

  // Add pagination buttons if multiple pages
  if (totalPages > 1) {
    const paginationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveitem_page_items:prev:${page}:${sessionKey}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`giveitem_page_items:next:${page}:${sessionKey}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );
    components.push(paginationRow);
  }

  // Add action buttons
  const session = pendingDistributions.get(sessionKey);
  const totalSelected = Array.from(session.selectedDistributions.values())
    .reduce((sum, users) => sum + users.length, 0);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveitem_view_pending:${sessionKey}`)
      .setLabel(`📋 Review (${totalSelected} selections)`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(totalSelected === 0),
    new ButtonBuilder()
      .setCustomId(`giveitem_finalize:${sessionKey}`)
      .setLabel('✅ Give Items')
      .setStyle(ButtonStyle.Success)
      .setDisabled(totalSelected === 0),
    new ButtonBuilder()
      .setCustomId(`giveitem_cancel:${sessionKey}`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Danger)
  );
  components.push(actionRow);

  const content = `**📦 Give Items to Users**\n\n**Step 1:** Select an item to see who wishlisted it\n**Step 2:** Select user(s) to give the item to\n**Step 3:** Click "Review" to see all selections or "Give Items" when ready\n\n**Page ${page + 1} of ${totalPages}** • **Total items:** ${allItems.length}`;

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content, components, embeds: [] });
  } else {
    await interaction.reply({ content, components, flags: [64] });
  }
}

/**
 * Handle item selection - show users who wishlisted it
 */
async function handleItemSelection({ interaction, collections, client }) {
  const parts = interaction.customId.split(':');
  const page = parseInt(parts[1]);
  const sessionKey = parts[2];

  const session = pendingDistributions.get(sessionKey);
  if (!session) {
    return interaction.reply({
      content: '❌ Session expired. Please run `/giveitem` again.',
      flags: [64]
    });
  }

  const selectedItemId = interaction.values[0];
  const item = getItemById(selectedItemId);
  const userIds = session.itemUserMap.get(selectedItemId) || [];

  await interaction.deferUpdate();

  // Show user selection for this item
  await showUserSelection(interaction, item, userIds, sessionKey, collections, client);
}

/**
 * Show users who wishlisted an item
 */
async function showUserSelection(interaction, item, userIds, sessionKey, collections, client) {
  const session = pendingDistributions.get(sessionKey);

  // Get already selected users for this item
  const alreadySelected = session.selectedDistributions.get(item.id) || [];

  // Fetch user display names
  const userOptions = [];
  for (const userId of userIds) {
    try {
      const member = await interaction.guild.members.fetch(userId);
      userOptions.push({
        userId,
        displayName: member.displayName,
        tag: member.user.tag
      });
    } catch (err) {
      userOptions.push({
        userId,
        displayName: `Unknown User`,
        tag: userId
      });
    }
  }

  // Sort by display name
  userOptions.sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Create select menu for users (max 25)
  const options = userOptions.slice(0, 25).map(user => {
    const isSelected = alreadySelected.includes(user.userId);
    return new StringSelectMenuOptionBuilder()
      .setLabel(user.displayName)
      .setValue(user.userId)
      .setDescription(isSelected ? '✅ Selected' : 'Not selected')
      .setDefault(isSelected);
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`giveitem_select_users:${item.id}:${sessionKey}`)
    .setPlaceholder('Select user(s) to give this item to...')
    .setMinValues(0)
    .setMaxValues(options.length)
    .addOptions(options);

  const components = [new ActionRowBuilder().addComponents(selectMenu)];

  // Action buttons
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveitem_back_to_items:${sessionKey}`)
      .setLabel('◀ Back to Items')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`giveitem_clear_item:${item.id}:${sessionKey}`)
      .setLabel('Clear Item')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(alreadySelected.length === 0)
  );
  components.push(actionRow);

  const totalSelected = Array.from(session.selectedDistributions.values())
    .reduce((sum, users) => sum + users.length, 0);

  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle(`🎁 ${item.name}`)
    .setDescription(`**Category:** ${item.category || item.type}\n**Total users who want this:** ${userIds.length}\n\nSelect the users who should receive this item.`)
    .setFooter({ text: `Total selections across all items: ${totalSelected}` })
    .setTimestamp();

  await interaction.editReply({
    content: null,
    embeds: [embed],
    components
  });
}

/**
 * Handle user selection for an item
 */
async function handleUserSelection({ interaction, collections, client }) {
  const parts = interaction.customId.split(':');
  const itemId = parts[1];
  const sessionKey = parts[2];

  const session = pendingDistributions.get(sessionKey);
  if (!session) {
    return interaction.reply({
      content: '❌ Session expired. Please run `/giveitem` again.',
      flags: [64]
    });
  }

  const selectedUserIds = interaction.values;

  // Update session
  if (selectedUserIds.length > 0) {
    session.selectedDistributions.set(itemId, selectedUserIds);
  } else {
    session.selectedDistributions.delete(itemId);
  }

  await interaction.deferUpdate();

  // Show updated user selection
  const item = getItemById(itemId);
  const userIds = session.itemUserMap.get(itemId) || [];
  await showUserSelection(interaction, item, userIds, sessionKey, collections, client);
}

/**
 * Handle back to items button
 */
async function handleBackToItems({ interaction, collections }) {
  const sessionKey = interaction.customId.split(':')[1];
  const session = pendingDistributions.get(sessionKey);

  if (!session) {
    return interaction.reply({
      content: '❌ Session expired. Please run `/giveitem` again.',
      flags: [64]
    });
  }

  await interaction.deferUpdate();

  // Rebuild item list
  const sortedItems = Array.from(session.itemUserMap.keys())
    .map(id => {
      const item = getItemById(id);
      return item ? { ...item, userCount: session.itemUserMap.get(id).length } : null;
    })
    .filter(item => item !== null)
    .sort((a, b) => {
      const catA = a.category || a.type || '';
      const catB = b.category || b.type || '';
      if (catA !== catB) return catA.localeCompare(catB);
      return a.name.localeCompare(b.name);
    });

  await showItemSelectionPage(interaction, sortedItems, 0, sessionKey, collections);
}

/**
 * Handle view pending - show review of all selections
 */
async function handleViewPending({ interaction, collections, client }) {
  const sessionKey = interaction.customId.split(':')[1];
  const session = pendingDistributions.get(sessionKey);

  if (!session) {
    return interaction.reply({
      content: '❌ Session expired. Please run `/giveitem` again.',
      flags: [64]
    });
  }

  await interaction.deferUpdate();

  // Build review embed
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('📋 Review Item Distributions')
    .setTimestamp();

  let description = '**Selected distributions:**\n\n';
  let totalSelections = 0;

  // Sort by item name for consistent display
  const sortedEntries = Array.from(session.selectedDistributions.entries())
    .sort((a, b) => {
      const itemA = getItemById(a[0]);
      const itemB = getItemById(b[0]);
      return itemA.name.localeCompare(itemB.name);
    });

  for (const [itemId, userIds] of sortedEntries) {
    const item = getItemById(itemId);
    if (!item) continue;

    description += `**${item.name}**\n`;

    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      const name = member ? member.displayName : userId;
      description += `  • ${name}\n`;
      totalSelections++;
    }
    description += '\n';
  }

  embed.setDescription(description);
  embed.setFooter({ text: `Total: ${totalSelections} distribution${totalSelections !== 1 ? 's' : ''}` });

  // Create action buttons with edit/remove options
  const components = [];

  // Build select menu to choose which item to edit/remove
  if (sortedEntries.length > 0) {
    const options = sortedEntries.slice(0, 25).map(([itemId, userIds]) => {
      const item = getItemById(itemId);
      return new StringSelectMenuOptionBuilder()
        .setLabel(item.name)
        .setValue(itemId)
        .setDescription(`${userIds.length} user${userIds.length !== 1 ? 's' : ''} selected`);
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`giveitem_review_select:${sessionKey}`)
      .setPlaceholder('Select an item to edit or remove...')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options);

    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  // Action buttons
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveitem_back_to_items:${sessionKey}`)
      .setLabel('◀ Back to Items')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`giveitem_finalize:${sessionKey}`)
      .setLabel('✅ Confirm & Give Items')
      .setStyle(ButtonStyle.Success)
      .setDisabled(totalSelections === 0),
    new ButtonBuilder()
      .setCustomId(`giveitem_cancel:${sessionKey}`)
      .setLabel('❌ Cancel All')
      .setStyle(ButtonStyle.Danger)
  );
  components.push(actionRow);

  await interaction.editReply({
    content: null,
    embeds: [embed],
    components
  });
}

/**
 * Handle review select - when user picks an item to edit from review
 */
async function handleReviewSelect({ interaction, collections, client }) {
  const parts = interaction.customId.split(':');
  const sessionKey = parts[1];

  const session = pendingDistributions.get(sessionKey);
  if (!session) {
    return interaction.reply({
      content: '❌ Session expired. Please run `/giveitem` again.',
      flags: [64]
    });
  }

  const selectedItemId = interaction.values[0];
  const item = getItemById(selectedItemId);
  const userIds = session.itemUserMap.get(selectedItemId) || [];

  await interaction.deferUpdate();

  // Show user selection for this item (same as normal flow)
  await showUserSelection(interaction, item, userIds, sessionKey, collections, client);
}

/**
 * Handle finalize - actually give the items
 */
async function handleFinalize({ interaction, collections, client }) {
  const sessionKey = interaction.customId.split(':')[1];
  const session = pendingDistributions.get(sessionKey);

  if (!session) {
    return interaction.reply({
      content: '❌ Session expired. Please run `/giveitem` again.',
      flags: [64]
    });
  }

  if (session.selectedDistributions.size === 0) {
    return interaction.reply({
      content: '❌ No items selected.',
      flags: [64]
    });
  }

  await interaction.deferUpdate();

  const { wishlistGivenItems } = collections;
  const now = new Date();

  // Save all distributions to database
  for (const [itemId, userIds] of session.selectedDistributions.entries()) {
    for (const userId of userIds) {
      await wishlistGivenItems.updateOne(
        {
          guildId: interaction.guildId,
          userId: userId,
          itemId: itemId
        },
        {
          $set: {
            givenAt: now,
            givenBy: interaction.user.id
          }
        },
        { upsert: true }
      );
    }
  }

  // Update wishlist panels
  await updateWishlistPanels({
    client,
    guildId: interaction.guildId,
    collections
  });

  // Build summary
  let summary = '✅ **Items successfully distributed!**\n\n';
  for (const [itemId, userIds] of session.selectedDistributions.entries()) {
    const item = getItemById(itemId);
    summary += `**${item.name}**\n`;
    for (const userId of userIds) {
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      const name = member ? member.displayName : userId;
      summary += `  • ${name}\n`;
    }
    summary += '\n';
  }

  // Clear session
  pendingDistributions.delete(sessionKey);

  await interaction.editReply({
    content: summary,
    embeds: [],
    components: []
  });
}

/**
 * Handle cancel
 */
async function handleCancel({ interaction }) {
  const sessionKey = interaction.customId.split(':')[1];
  pendingDistributions.delete(sessionKey);

  await interaction.update({
    content: '❌ Item distribution cancelled.',
    embeds: [],
    components: []
  });
}

/**
 * Handle clear item selections
 */
async function handleClearItem({ interaction, collections, client }) {
  const parts = interaction.customId.split(':');
  const itemId = parts[1];
  const sessionKey = parts[2];

  const session = pendingDistributions.get(sessionKey);
  if (!session) {
    return interaction.reply({
      content: '❌ Session expired.',
      flags: [64]
    });
  }

  session.selectedDistributions.delete(itemId);

  await interaction.deferUpdate();

  const item = getItemById(itemId);
  const userIds = session.itemUserMap.get(itemId) || [];
  await showUserSelection(interaction, item, userIds, sessionKey, collections, client);
}

/**
 * Handle pagination for items
 */
async function handleItemPagination({ interaction, collections }) {
  const parts = interaction.customId.split(':');
  const direction = parts[1];
  const currentPage = parseInt(parts[2]);
  const sessionKey = parts[3];

  const session = pendingDistributions.get(sessionKey);
  if (!session) {
    return interaction.reply({
      content: '❌ Session expired.',
      flags: [64]
    });
  }

  const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

  await interaction.deferUpdate();

  const sortedItems = Array.from(session.itemUserMap.keys())
    .map(id => {
      const item = getItemById(id);
      return item ? { ...item, userCount: session.itemUserMap.get(id).length } : null;
    })
    .filter(item => item !== null)
    .sort((a, b) => {
      const catA = a.category || a.type || '';
      const catB = b.category || b.type || '';
      if (catA !== catB) return catA.localeCompare(catB);
      return a.name.localeCompare(b.name);
    });

  await showItemSelectionPage(interaction, sortedItems, newPage, sessionKey, collections);
}

module.exports = {
  handleGiveItem,
  handleItemSelection,
  handleUserSelection,
  handleBackToItems,
  handleViewPending,
  handleReviewSelect,
  handleFinalize,
  handleCancel,
  handleClearItem,
  handleItemPagination
};