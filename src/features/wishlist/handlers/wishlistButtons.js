// Button handlers for wishlist system
const { buildUserWishlistEmbed } = require('../utils/panelBuilder');
const { createWishlistButtons } = require('../commands/mywishlist');
const { validateWishlist, isWishlistEmpty } = require('../utils/wishlistValidator');
const { updateWishlistPanels } = require('../commands/wishlists');
const { createCategorySelect } = require('./wishlistSelects');
const { draftWishlists } = require('../utils/wishlistStorage');

async function handleWishlistButtons({ interaction, collections, client }) {
  const customId = interaction.customId;

  // Handle pagination buttons
  if (customId.startsWith('wishlist_page:')) {
    return handlePaginationButtons({ interaction, collections });
  }

  // Handle category selection buttons
  if (customId.startsWith('wishlist_select_')) {
    return handleCategorySelection({ interaction, collections });
  }

  // Handle clear all button
  if (customId === 'wishlist_clear_all') {
    return handleClearAll({ interaction, collections });
  }

  // Handle submit button
  if (customId === 'wishlist_submit') {
    return handleSubmit({ interaction, collections, client });
  }
}

/**
 * Handle category selection buttons
 */
async function handleCategorySelection({ interaction, collections }) {
  const { wishlistSubmissions, wishlistSettings, wishlistGivenItems } = collections;

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

  // Get or create draft wishlist
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

  // Determine which category was clicked
  const customId = interaction.customId;
  const { createCategorySelect } = require('./wishlistSelects');

  if (customId === 'wishlist_select_archboss_weapon') {
    const selectData = createCategorySelect('archbossWeapons', draft.archbossWeapon, 0, receivedItemIds);
    const components = [selectData.row];

    // Add pagination buttons if needed
    if (selectData.hasMultiplePages) {
      const paginationRow = createPaginationButtons('archbossWeapons', 0, selectData.totalPages);
      components.push(paginationRow);
    }

    return interaction.reply({
      content: '⚔️ **Select Archboss Weapon** (max 1)\n\nChoose an item from the list below:\n\n🔒 = Already received (locked)',
      components,
      flags: [64]
    });
  }

  if (customId === 'wishlist_select_archboss_armor') {
    const selectData = createCategorySelect('archbossArmors', draft.archbossArmor, 0, receivedItemIds);
    const components = [selectData.row];

    if (selectData.hasMultiplePages) {
      const paginationRow = createPaginationButtons('archbossArmors', 0, selectData.totalPages);
      components.push(paginationRow);
    }

    return interaction.reply({
      content: '🛡️ **Select Archboss Armor** (max 1)\n\nChoose an item from the list below:\n\n🔒 = Already received (locked)',
      components,
      flags: [64]
    });
  }

  if (customId === 'wishlist_select_t3_weapons') {
    const selectData = createCategorySelect('t3Weapons', draft.t3Weapons, 0, receivedItemIds);
    const components = [selectData.row];

    if (selectData.hasMultiplePages) {
      const paginationRow = createPaginationButtons('t3Weapons', 0, selectData.totalPages);
      components.push(paginationRow);
    }

    return interaction.reply({
      content: '⚔️ **Select Weapons** (max 1)\n\nChoose items from the list below:\n\n🔒 = Already received (locked)',
      components,
      flags: [64]
    });
  }

  if (customId === 'wishlist_select_t3_armors') {
    const selectData = createCategorySelect('t3Armors', draft.t3Armors, 0, receivedItemIds);
    const components = [selectData.row];

    if (selectData.hasMultiplePages) {
      const paginationRow = createPaginationButtons('t3Armors', 0, selectData.totalPages);
      components.push(paginationRow);
    }

    return interaction.reply({
      content: '🛡️ **Select Armor** (max 4)\n\nChoose items from the list below:\n\n🔒 = Already received (locked)',
      components,
      flags: [64]
    });
  }

  if (customId === 'wishlist_select_t3_accessories') {
    const selectData = createCategorySelect('t3Accessories', draft.t3Accessories, 0, receivedItemIds);
    const components = [selectData.row];

    if (selectData.hasMultiplePages) {
      const paginationRow = createPaginationButtons('t3Accessories', 0, selectData.totalPages);
      components.push(paginationRow);
    }

    return interaction.reply({
      content: '💍 **Select Accessories** (max 2)\n\nChoose items from the list below:\n\n🔒 = Already received (locked)',
      components,
      flags: [64]
    });
  }
}

/**
 * Create pagination buttons for category selection
 */
function createPaginationButtons(categoryKey, currentPage, totalPages) {
  const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wishlist_page:${categoryKey}:prev:${currentPage}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`wishlist_page:${categoryKey}:next:${currentPage}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1)
  );

  return row;
}

/**
 * Handle pagination button clicks
 */
async function handlePaginationButtons({ interaction, collections }) {
  const { wishlistGivenItems } = collections;
  const parts = interaction.customId.split(':');
  const categoryKey = parts[1];
  const direction = parts[2];
  const currentPage = parseInt(parts[3]);

  const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

  // Get user's received items
  const receivedItems = await wishlistGivenItems.find({
    userId: interaction.user.id,
    guildId: interaction.guildId
  }).toArray();

  const receivedItemIds = receivedItems.map(item => item.itemId);

  // Get draft
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

  // Get current selections for this category
  let currentSelections = [];
  if (categoryKey === 'archbossWeapons') currentSelections = draft.archbossWeapon;
  else if (categoryKey === 'archbossArmors') currentSelections = draft.archbossArmor;
  else if (categoryKey === 't3Weapons') currentSelections = draft.t3Weapons;
  else if (categoryKey === 't3Armors') currentSelections = draft.t3Armors;
  else if (categoryKey === 't3Accessories') currentSelections = draft.t3Accessories;

  // Create new select menu for the page
  const selectData = createCategorySelect(categoryKey, currentSelections, newPage, receivedItemIds);
  const components = [selectData.row];

  if (selectData.hasMultiplePages) {
    const paginationRow = createPaginationButtons(categoryKey, newPage, selectData.totalPages);
    components.push(paginationRow);
  }

  await interaction.update({ components });
}

/**
 * Handle clear all button
 */
async function handleClearAll({ interaction, collections }) {
  const { wishlistSubmissions, wishlistSettings, wishlistGivenItems } = collections;

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

  // Clear draft
  const draftKey = `${interaction.guildId}_${interaction.user.id}`;
  const clearedDraft = {
    archbossWeapon: [],
    archbossArmor: [],
    t3Weapons: [],
    t3Armors: [],
    t3Accessories: []
  };
  draftWishlists.set(draftKey, clearedDraft);

  // Update embed
  const embed = buildUserWishlistEmbed({
    wishlist: clearedDraft,
    user: interaction.user,
    frozen: false,
    receivedItemIds: receivedItemIds,
    receivedItems: receivedItems
  });

  const buttons = createWishlistButtons(clearedDraft, receivedItemIds);

  await interaction.update({
    embeds: [embed],
    components: buttons
  });

  await interaction.followUp({
    content: '🗑️ All selections cleared!',
    flags: [64]
  });
}

/**
 * Handle submit button
 */
async function handleSubmit({ interaction, collections, client }) {
  const { wishlistSubmissions, wishlistSettings, wishlistGivenItems } = collections;

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

  // Get draft
  const draftKey = `${interaction.guildId}_${interaction.user.id}`;
  const draft = draftWishlists.get(draftKey);

  if (!draft || isWishlistEmpty(draft)) {
    return interaction.reply({
      content: '❌ Your wishlist is empty. Please select at least one item before submitting.',
      flags: [64]
    });
  }

  // Validate wishlist
  const validation = validateWishlist(draft);
  if (!validation.valid) {
    return interaction.reply({
      content: `❌ **Validation Error**\n\n${validation.errors.join('\n')}`,
      flags: [64]
    });
  }

  await interaction.deferUpdate();

  try {
    // Save to database
    await wishlistSubmissions.insertOne({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      archbossWeapon: draft.archbossWeapon,
      archbossArmor: draft.archbossArmor,
      t3Weapons: draft.t3Weapons,
      t3Armors: draft.t3Armors,
      t3Accessories: draft.t3Accessories,
      submittedAt: new Date(),
      lastModified: new Date()
    });

    // Clear draft from memory
    draftWishlists.delete(draftKey);

    // Update wishlist panels
    await updateWishlistPanels({
      client,
      guildId: interaction.guildId,
      collections
    });

    // Get user's received items for display
    const receivedItems = await wishlistGivenItems.find({
      userId: interaction.user.id,
      guildId: interaction.guildId
    }).toArray();

    const receivedItemIds = receivedItems.map(item => item.itemId);

    // Update message to show success
    const embed = buildUserWishlistEmbed({
      wishlist: draft,
      user: interaction.user,
      frozen: false,
      receivedItemIds: receivedItemIds,
      receivedItems: receivedItems
    });

    embed.setColor('#2ecc71');
    embed.setTitle('✅ Wishlist Submitted Successfully!');
    embed.setDescription(
      '**Your wishlist has been submitted!**\n\n' +
      'Your selections are now visible to guild leadership. If you need to make changes, contact an administrator.\n\n' +
      embed.data.description
    );

    await interaction.editReply({
      embeds: [embed],
      components: []
    });

  } catch (error) {
    console.error('Error submitting wishlist:', error);
    await interaction.followUp({
      content: '❌ An error occurred while submitting your wishlist. Please try again.',
      flags: [64]
    });
  }
}

module.exports = {
  handleWishlistButtons,
  handlePaginationButtons,
  createPaginationButtons
};