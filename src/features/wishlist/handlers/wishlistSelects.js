// Select menu handlers for wishlist system
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { WISHLIST_ITEMS, getItemsByCategory } = require('../utils/items');
const { LIMITS } = require('../utils/wishlistValidator');
const { buildUserWishlistEmbed } = require('../utils/panelBuilder');
const { createWishlistButtons } = require('../commands/mywishlist');
const { draftWishlists } = require('./wishlistButtons');

/**
 * Create a category select menu
 * @param {string} categoryKey - Category key (archbossWeapons, etc)
 * @param {Array} currentSelections - Currently selected items
 * @returns {ActionRowBuilder}
 */
function createCategorySelect(categoryKey, currentSelections = []) {
  const items = getItemsByCategory(categoryKey);

  // Determine max selections based on category
  let maxValues = 1;
  let minValues = 0;

  if (categoryKey === 't3Weapons') maxValues = LIMITS.t3Weapons;
  if (categoryKey === 't3Armors') maxValues = LIMITS.t3Armors;
  if (categoryKey === 't3Accessories') maxValues = LIMITS.t3Accessories;

  // Build options
  const options = items.map(item => {
    const isSelected = currentSelections.includes(item.id);

    return new StringSelectMenuOptionBuilder()
      .setLabel(item.name)
      .setValue(item.id)
      .setDescription(item.category || item.type)
      .setDefault(isSelected);
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`wishlist_item_select:${categoryKey}`)
    .setPlaceholder('Choose items...')
    .setMinValues(minValues)
    .setMaxValues(Math.min(maxValues, options.length))
    .addOptions(options);

  return new ActionRowBuilder().addComponents(selectMenu);
}

/**
 * Handle wishlist select menu interactions
 */
async function handleWishlistSelects({ interaction, collections }) {
  const { wishlistSubmissions, wishlistSettings } = collections;

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

  // Parse category from customId
  const categoryKey = interaction.customId.split(':')[1];
  const selectedValues = interaction.values;

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
    draft.archbossWeapon = selectedValues.slice(0, 1); // Only first selection
  } else if (categoryKey === 'archbossArmors') {
    draft.archbossArmor = selectedValues.slice(0, 1); // Only first selection
  } else if (categoryKey === 't3Weapons') {
    draft.t3Weapons = selectedValues.slice(0, LIMITS.t3Weapons);
  } else if (categoryKey === 't3Armors') {
    draft.t3Armors = selectedValues.slice(0, LIMITS.t3Armors);
  } else if (categoryKey === 't3Accessories') {
    draft.t3Accessories = selectedValues.slice(0, LIMITS.t3Accessories);
  }

  // Find original message and update it
  try {
    // Fetch the original message (the one with the main wishlist embed)
    const channel = interaction.channel;
    const messages = await channel.messages.fetch({ limit: 10 });

    // Find the message from the bot to the user
    const originalMessage = messages.find(msg => 
      msg.author.id === interaction.client.user.id &&
      msg.embeds.length > 0 &&
      msg.embeds[0].data.title?.includes('Wishlist Configuration')
    );

    if (originalMessage) {
      // Update the original message
      const embed = buildUserWishlistEmbed({
        wishlist: draft,
        user: interaction.user,
        frozen: false
      });

      const buttons = createWishlistButtons(draft);

      await originalMessage.edit({
        embeds: [embed],
        components: buttons
      });
    }

    // Acknowledge the selection
    const selectedCount = selectedValues.length;
    let categoryName = '';

    if (categoryKey === 'archbossWeapons') categoryName = 'Archboss Weapon';
    else if (categoryKey === 'archbossArmors') categoryName = 'Archboss Armor';
    else if (categoryKey === 't3Weapons') categoryName = 'T3 Weapons';
    else if (categoryKey === 't3Armors') categoryName = 'T3 Armor';
    else if (categoryKey === 't3Accessories') categoryName = 'T3 Accessories';

    await interaction.update({
      content: `✅ **${categoryName}** updated! ${selectedCount} item${selectedCount !== 1 ? 's' : ''} selected.\n\nYour main wishlist has been updated. You can continue selecting other categories or submit when ready.`,
      components: []
    });

  } catch (error) {
    console.error('Error updating wishlist:', error);
    await interaction.reply({
      content: '❌ An error occurred while updating your wishlist. Please try again.',
      flags: [64]
    });
  }
}

module.exports = {
  handleWishlistSelects,
  createCategorySelect
};