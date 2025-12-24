// Button handlers for wishlist system
const { buildUserWishlistEmbed } = require('../utils/panelBuilder');
const { createWishlistButtons } = require('../commands/mywishlist');
const { validateWishlist, isWishlistEmpty } = require('../utils/wishlistValidator');
const { updateWishlistPanels } = require('../commands/wishlists');

// Store temporary wishlist states (in memory for this session)
const draftWishlists = new Map();

async function handleWishlistButtons({ interaction, collections, client }) {
  const customId = interaction.customId;

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
  const { wishlistSubmissions, wishlistSettings } = collections;

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
    const selectMenu = createCategorySelect('archbossWeapons', draft.archbossWeapon);
    return interaction.reply({
      content: '⚔️ **Select Archboss Weapon** (max 1)\n\nChoose an item from the list below:',
      components: [selectMenu],
      flags: [64]
    });
  }

  if (customId === 'wishlist_select_archboss_armor') {
    const selectMenu = createCategorySelect('archbossArmors', draft.archbossArmor);
    return interaction.reply({
      content: '🛡️ **Select Archboss Armor** (max 1)\n\nChoose an item from the list below:',
      components: [selectMenu],
      flags: [64]
    });
  }

  if (customId === 'wishlist_select_t3_weapons') {
    const selectMenu = createCategorySelect('t3Weapons', draft.t3Weapons);
    return interaction.reply({
      content: '⚔️ **Select Weapons** (max 2)\n\nChoose items from the list below:',
      components: [selectMenu],
      flags: [64]
    });
  }

  if (customId === 'wishlist_select_t3_armors') {
    const selectMenu = createCategorySelect('t3Armors', draft.t3Armors);
    return interaction.reply({
      content: '🛡️ **Select Armor** (max 4)\n\nChoose items from the list below:',
      components: [selectMenu],
      flags: [64]
    });
  }

  if (customId === 'wishlist_select_t3_accessories') {
    const selectMenu = createCategorySelect('t3Accessories', draft.t3Accessories);
    return interaction.reply({
      content: '💍 **Select Accessories** (max 2)\n\nChoose items from the list below:',
      components: [selectMenu],
      flags: [64]
    });
  }
}

/**
 * Handle clear all button
 */
async function handleClearAll({ interaction, collections }) {
  const { wishlistSubmissions, wishlistSettings } = collections;

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
    frozen: false
  });

  const buttons = createWishlistButtons(clearedDraft);

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
  const { wishlistSubmissions, wishlistSettings } = collections;

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

    // Update message to show success
    const embed = buildUserWishlistEmbed({
      wishlist: draft,
      user: interaction.user,
      frozen: false
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
  draftWishlists
};