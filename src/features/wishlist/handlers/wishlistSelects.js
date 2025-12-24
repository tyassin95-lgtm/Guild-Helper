// Select menu handlers for wishlist system
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { WISHLIST_ITEMS, getItemsByCategory } = require('../utils/items');
const { LIMITS } = require('../utils/wishlistValidator');
const { buildUserWishlistEmbed } = require('../utils/panelBuilder');
const { createWishlistButtons } = require('../commands/mywishlist');
const { draftWishlists } = require('../utils/wishlistStorage');

/**
 * Create a category select menu with pagination support
 * @param {string} categoryKey - Category key (archbossWeapons, etc)
 * @param {Array} currentSelections - Currently selected items
 * @param {number} page - Current page (0-indexed)
 * @param {Array} receivedItemIds - Array of item IDs the user has already received (locked)
 * @returns {Object} { row: ActionRowBuilder, totalPages: number, hasMultiplePages: boolean }
 */
function createCategorySelect(categoryKey, currentSelections = [], page = 0, receivedItemIds = []) {
  const items = getItemsByCategory(categoryKey);

  // Determine max selections based on category
  let maxValues = 1;
  let minValues = 0;

  if (categoryKey === 't3Weapons') maxValues = 1; // Changed from 2 to 1
  if (categoryKey === 't3Armors') maxValues = LIMITS.t3Armors;
  if (categoryKey === 't3Accessories') maxValues = LIMITS.t3Accessories;

  // Filter out received items from available options (but keep them in the list to show as locked)
  const availableItems = items.filter(item => !receivedItemIds.includes(item.id));

  // Pagination - 25 items per page
  const itemsPerPage = 25;
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageItems = items.slice(startIdx, endIdx);

  // Build options - show all items but disable received ones
  const options = pageItems.map(item => {
    const isReceived = receivedItemIds.includes(item.id);
    const isSelected = currentSelections.includes(item.id) && !isReceived;

    let description = item.category || item.type;
    if (isReceived) {
      description = '🔒 Already received (locked)';
    } else if (isSelected) {
      description = '✅ Selected';
    }

    return new StringSelectMenuOptionBuilder()
      .setLabel(isReceived ? `${item.name} 🔒` : item.name)
      .setValue(item.id)
      .setDescription(description)
      .setDefault(isSelected);
  });

  // Calculate how many slots are available (excluding received items)
  const receivedCount = pageItems.filter(item => receivedItemIds.includes(item.id)).length;
  const availableSlots = Math.min(maxValues, options.length - receivedCount);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`wishlist_item_select:${categoryKey}:${page}`)
    .setPlaceholder(`Choose items... (Page ${page + 1}/${totalPages})`)
    .setMinValues(minValues)
    .setMaxValues(Math.max(1, availableSlots)) // At least 1 for Discord requirement
    .addOptions(options);

  return {
    row: new ActionRowBuilder().addComponents(selectMenu),
    totalPages,
    hasMultiplePages: totalPages > 1,
    currentPage: page
  };
}

/**
 * Handle wishlist select menu interactions
 */
async function handleWishlistSelects({ interaction, collections }) {
  const { wishlistSubmissions, wishlistSettings, wishlistGivenItems } = collections;

  if (!interaction.customId.startsWith('wishlist_item_select:')) {
    return;
  }

  // Check if wishlists are frozen
  const wishlistConfig = await wishlistSettings.findOne({ guildId: interaction.guildId });
  const frozen = wishlistConfig?.frozen || false;

  if (frozen) {
    return interaction.reply({
      content: '🔒 Wishlists are currently frozen and cannot be modified.',
      flags: [64]
    });
  }

  // Check if user already submitted
  const existingSubmission = await wishlistSubmissions.findOne({
    userId: interaction.user.id,
    guildId: interaction.guildId
  });

  if (existingSubmission) {
    return interaction.reply({
      content: '❌ Your wishlist has already been submitted and cannot be edited.',
      flags: [64]
    });
  }

  // Get user's received items
  const receivedItems = await wishlistGivenItems.find({
    userId: interaction.user.id,
    guildId: interaction.guildId
  }).toArray();

  const receivedItemIds = receivedItems.map(item => item.itemId);

  // Parse category and page from customId
  const parts = interaction.customId.split(':');
  const categoryKey = parts[1];
  const page = parseInt(parts[2]) || 0;
  const selectedValues = interaction.values;

  // Filter out any received items from selection (in case of manipulation)
  const validSelectedValues = selectedValues.filter(itemId => !receivedItemIds.includes(itemId));

  if (validSelectedValues.length !== selectedValues.length) {
    return interaction.reply({
      content: '❌ You cannot select items you have already received.',
      flags: [64]
    });
  }

  // Get or create draft
  const draftKey = `${interaction.guildId}_${interaction.user.id}`;
  let draft = draftWishlists.get(draftKey);

  if (!draft) {
    draft = {
      archbossWeapon: [],
      archbossArmor: [],
      t3Weapons: [],
      t3Armors: [],
      t3Accessories: []
    };
    draftWishlists.set(draftKey, draft);
  }

  // Update draft based on category
  if (categoryKey === 'archbossWeapons') {
    draft.archbossWeapon = validSelectedValues.slice(0, 1); // Only first selection
  } else if (categoryKey === 'archbossArmors') {
    draft.archbossArmor = validSelectedValues.slice(0, 1); // Only first selection
  } else if (categoryKey === 't3Weapons') {
    draft.t3Weapons = validSelectedValues.slice(0, 1); // Only 1 weapon allowed
  } else if (categoryKey === 't3Armors') {
    draft.t3Armors = validSelectedValues.slice(0, LIMITS.t3Armors);
  } else if (categoryKey === 't3Accessories') {
    draft.t3Accessories = validSelectedValues.slice(0, LIMITS.t3Accessories);
  }

  // Build updated embed and buttons
  const embed = buildUserWishlistEmbed({
    wishlist: draft,
    user: interaction.user,
    frozen: false,
    receivedItemIds: receivedItemIds,
    receivedItems: receivedItems
  });

  const buttons = createWishlistButtons(draft, receivedItemIds);

  // Determine category name for feedback
  const selectedCount = validSelectedValues.length;
  let categoryName = '';

  if (categoryKey === 'archbossWeapons') categoryName = 'Archboss Weapon';
  else if (categoryKey === 'archbossArmors') categoryName = 'Archboss Armor';
  else if (categoryKey === 't3Weapons') categoryName = 'Weapons';
  else if (categoryKey === 't3Armors') categoryName = 'Armor';
  else if (categoryKey === 't3Accessories') categoryName = 'Accessories';

  // Update the interaction message
  await interaction.update({
    content: `✅ **${categoryName}** updated! ${selectedCount} item${selectedCount !== 1 ? 's' : ''} selected.\n\nYou can continue selecting other categories or submit when ready.`,
    embeds: [embed],
    components: buttons
  });
}

module.exports = {
  handleWishlistSelects,
  createCategorySelect
};