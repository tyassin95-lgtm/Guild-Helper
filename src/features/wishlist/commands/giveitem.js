// Handler for /giveitem command
const { PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { WISHLIST_ITEMS, getItemById } = require('../utils/items');
const { updateWishlistPanels } = require('./wishlists');

async function handleGiveItem({ interaction, collections, client }) {
  const { wishlistSubmissions, wishlistGivenItems } = collections;

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

    // Collect all wishlisted items
    const wishlistedItems = new Set();

    for (const submission of submissions) {
      if (submission.archbossWeapon) submission.archbossWeapon.forEach(id => wishlistedItems.add(id));
      if (submission.archbossArmor) submission.archbossArmor.forEach(id => wishlistedItems.add(id));
      if (submission.t3Weapons) submission.t3Weapons.forEach(id => wishlistedItems.add(id));
      if (submission.t3Armors) submission.t3Armors.forEach(id => wishlistedItems.add(id));
      if (submission.t3Accessories) submission.t3Accessories.forEach(id => wishlistedItems.add(id));
    }

    if (wishlistedItems.size === 0) {
      return interaction.editReply({
        content: '❌ No items are currently wishlisted.'
      });
    }

    // Sort items by category
    const sortedItems = Array.from(wishlistedItems)
      .map(id => getItemById(id))
      .filter(item => item !== null)
      .sort((a, b) => {
        // Sort by category/type, then by name
        const catA = a.category || a.type || '';
        const catB = b.category || b.type || '';
        if (catA !== catB) return catA.localeCompare(catB);
        return a.name.localeCompare(b.name);
      });

    // Create paginated select menus (25 items per page)
    const itemsPerPage = 25;
    const totalPages = Math.ceil(sortedItems.length / itemsPerPage);

    // Show first page
    await showGiveItemPage(interaction, sortedItems, 0, totalPages, collections);

  } catch (error) {
    console.error('Error in /giveitem:', error);
    await interaction.editReply({
      content: '❌ An error occurred while loading wishlisted items.'
    });
  }
}

/**
 * Show a page of items to give
 */
async function showGiveItemPage(interaction, allItems, page, totalPages, collections) {
  const itemsPerPage = 25;
  const startIdx = page * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageItems = allItems.slice(startIdx, endIdx);

  // Build select menu options
  const options = pageItems.map(item => {
    return new StringSelectMenuOptionBuilder()
      .setLabel(item.name)
      .setValue(item.id)
      .setDescription(`${item.category || item.type}`);
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`giveitem_select:${page}`)
    .setPlaceholder(`Select items to mark as given... (Page ${page + 1}/${totalPages})`)
    .setMinValues(1)
    .setMaxValues(options.length)
    .addOptions(options);

  const components = [new ActionRowBuilder().addComponents(selectMenu)];

  // Add pagination buttons if multiple pages
  if (totalPages > 1) {
    const paginationRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveitem_page:prev:${page}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`giveitem_page:next:${page}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );
    components.push(paginationRow);
  }

  const content = `**📦 Mark Items as Given**\n\nSelect one or more items that have been distributed to players.\nSelected items will be marked as "Given" on the wishlist panel.\n\n**Page ${page + 1} of ${totalPages}** • **Total wishlisted items:** ${allItems.length}`;

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content, components });
  } else {
    await interaction.reply({ content, components, flags: [64] });
  }
}

/**
 * Handle giveitem select menu
 */
async function handleGiveItemSelect({ interaction, collections, client }) {
  const { wishlistGivenItems } = collections;

  await interaction.deferUpdate();

  try {
    const selectedItems = interaction.values;
    const now = new Date();

    // Mark items as given
    for (const itemId of selectedItems) {
      await wishlistGivenItems.updateOne(
        {
          guildId: interaction.guildId,
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

    // Update wishlist panels
    await updateWishlistPanels({
      client,
      guildId: interaction.guildId,
      collections
    });

    const itemNames = selectedItems.map(id => {
      const item = getItemById(id);
      return item ? item.name : id;
    });

    await interaction.followUp({
      content: `✅ **Items marked as given!**\n\n${itemNames.map(name => `• ${name}`).join('\n')}\n\nThe wishlist panels have been updated.`,
      flags: [64]
    });

  } catch (error) {
    console.error('Error marking items as given:', error);
    await interaction.followUp({
      content: '❌ An error occurred while marking items as given.',
      flags: [64]
    });
  }
}

/**
 * Handle pagination for giveitem
 */
async function handleGiveItemPagination({ interaction, collections }) {
  const { wishlistSubmissions } = collections;

  const parts = interaction.customId.split(':');
  const direction = parts[1];
  const currentPage = parseInt(parts[2]);

  const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

  // Get all wishlisted items again
  const submissions = await wishlistSubmissions.find({ guildId: interaction.guildId }).toArray();
  const wishlistedItems = new Set();

  for (const submission of submissions) {
    if (submission.archbossWeapon) submission.archbossWeapon.forEach(id => wishlistedItems.add(id));
    if (submission.archbossArmor) submission.archbossArmor.forEach(id => wishlistedItems.add(id));
    if (submission.t3Weapons) submission.t3Weapons.forEach(id => wishlistedItems.add(id));
    if (submission.t3Armors) submission.t3Armors.forEach(id => wishlistedItems.add(id));
    if (submission.t3Accessories) submission.t3Accessories.forEach(id => wishlistedItems.add(id));
  }

  const sortedItems = Array.from(wishlistedItems)
    .map(id => getItemById(id))
    .filter(item => item !== null)
    .sort((a, b) => {
      const catA = a.category || a.type || '';
      const catB = b.category || b.type || '';
      if (catA !== catB) return catA.localeCompare(catB);
      return a.name.localeCompare(b.name);
    });

  const totalPages = Math.ceil(sortedItems.length / 25);

  await showGiveItemPage(interaction, sortedItems, newPage, totalPages, collections);
}

module.exports = {
  handleGiveItem,
  handleGiveItemSelect,
  handleGiveItemPagination
};