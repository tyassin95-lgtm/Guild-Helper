// Handler for /mywishlist command
const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildUserWishlistEmbed } = require('../utils/panelBuilder');
const { isWishlistEmpty } = require('../utils/wishlistValidator');

async function handleMyWishlist({ interaction, collections }) {
  const { guildSettings, wishlistSubmissions, wishlistSettings, wishlistGivenItems } = collections;

  // Check if user has excluded role
  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const excludedRoles = settings?.excludedRoles || [];

  const memberRoles = interaction.member.roles.cache.map(r => r.id);
  const hasExcludedRole = memberRoles.some(roleId => excludedRoles.includes(roleId));

  if (hasExcludedRole) {
    return interaction.reply({
      content: '❌ You are not eligible to submit a wishlist.',
      flags: [64]
    });
  }

  // Check if wishlists are frozen
  const wishlistConfig = await wishlistSettings.findOne({ guildId: interaction.guildId });
  const frozen = wishlistConfig?.frozen || false;

  if (frozen) {
    return interaction.reply({
      content: '🔒 **Wishlists are currently frozen.**\n\nWishlist submissions are temporarily disabled. Please try again later when wishlists are reopened.',
      flags: [64]
    });
  }

  // Get user's received items
  const receivedItems = await wishlistGivenItems.find({
    userId: interaction.user.id,
    guildId: interaction.guildId
  }).toArray();

  const receivedItemIds = receivedItems.map(item => item.itemId);

  // Check if user already has a submitted wishlist
  const existingSubmission = await wishlistSubmissions.findOne({
    userId: interaction.user.id,
    guildId: interaction.guildId
  });

  if (existingSubmission) {
    // User already submitted - show wishlist with received items marked

    // Create display wishlist that merges submission with received items
    const displayWishlist = {
      archbossWeapon: [...(existingSubmission.archbossWeapon || [])],
      archbossArmor: [...(existingSubmission.archbossArmor || [])],
      t3Weapons: [...(existingSubmission.t3Weapons || [])],
      t3Armors: [...(existingSubmission.t3Armors || [])],
      t3Accessories: [...(existingSubmission.t3Accessories || [])]
    };

    // Add received items that aren't already in the submission
    if (receivedItemIds.length > 0) {
      const { WISHLIST_ITEMS } = require('../utils/items');

      for (const itemId of receivedItemIds) {
        if (WISHLIST_ITEMS.archbossWeapons.find(i => i.id === itemId)) {
          if (!displayWishlist.archbossWeapon.includes(itemId)) {
            displayWishlist.archbossWeapon.push(itemId);
          }
        } else if (WISHLIST_ITEMS.archbossArmors.find(i => i.id === itemId)) {
          if (!displayWishlist.archbossArmor.includes(itemId)) {
            displayWishlist.archbossArmor.push(itemId);
          }
        } else if (WISHLIST_ITEMS.t3Weapons.find(i => i.id === itemId)) {
          if (!displayWishlist.t3Weapons.includes(itemId)) {
            displayWishlist.t3Weapons.push(itemId);
          }
        } else if (WISHLIST_ITEMS.t3Armors.find(i => i.id === itemId)) {
          if (!displayWishlist.t3Armors.includes(itemId)) {
            displayWishlist.t3Armors.push(itemId);
          }
        } else if (WISHLIST_ITEMS.t3Accessories.find(i => i.id === itemId)) {
          if (!displayWishlist.t3Accessories.includes(itemId)) {
            displayWishlist.t3Accessories.push(itemId);
          }
        }
      }
    }

    const embed = buildUserWishlistEmbed({
      wishlist: displayWishlist,
      user: interaction.user,
      frozen: false,
      receivedItemIds: receivedItemIds,
      receivedItems: receivedItems
    });

    embed.setColor('#e74c3c');
    embed.setTitle('🎯 Your Submitted Wishlist');

    let description = '**Your wishlist has already been submitted.**\n\n';

    if (receivedItemIds.length > 0) {
      description += `✅ **You have received ${receivedItemIds.length} item${receivedItemIds.length !== 1 ? 's' : ''}!**\n\n`;
    }

    description += 'If you need to make changes, contact an administrator to reset your wishlist.\n\n';
    description += embed.data.description;

    embed.setDescription(description);

    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  // No submission exists - show draft form
  // Create wishlist object that shows received items
  const draftWishlist = {
    archbossWeapon: [],
    archbossArmor: [],
    t3Weapons: [],
    t3Armors: [],
    t3Accessories: []
  };

  // If user has received items but no submission, we need to show those received items
  // in the wishlist display even though they're not "selected"
  if (receivedItemIds.length > 0) {
    const { WISHLIST_ITEMS } = require('../utils/items');

    // Add received items to the appropriate categories for display purposes
    for (const itemId of receivedItemIds) {
      if (WISHLIST_ITEMS.archbossWeapons.find(i => i.id === itemId)) {
        draftWishlist.archbossWeapon.push(itemId);
      } else if (WISHLIST_ITEMS.archbossArmors.find(i => i.id === itemId)) {
        draftWishlist.archbossArmor.push(itemId);
      } else if (WISHLIST_ITEMS.t3Weapons.find(i => i.id === itemId)) {
        draftWishlist.t3Weapons.push(itemId);
      } else if (WISHLIST_ITEMS.t3Armors.find(i => i.id === itemId)) {
        draftWishlist.t3Armors.push(itemId);
      } else if (WISHLIST_ITEMS.t3Accessories.find(i => i.id === itemId)) {
        draftWishlist.t3Accessories.push(itemId);
      }
    }
  }

  // Build initial embed
  const embed = buildUserWishlistEmbed({
    wishlist: draftWishlist,
    user: interaction.user,
    frozen: false,
    receivedItemIds: receivedItemIds,
    receivedItems: receivedItems
  });

  // Create action buttons (some may be disabled if categories are fully received)
  const buttons = createWishlistButtons(draftWishlist, receivedItemIds);

  await interaction.reply({
    embeds: [embed],
    components: buttons,
    flags: [64]
  });
}

/**
 * Create wishlist action buttons
 * @param {Object} wishlist - Current wishlist state
 * @param {Array} receivedItemIds - Array of item IDs the user has already received
 * @returns {Array<ActionRowBuilder>}
 */
function createWishlistButtons(wishlist, receivedItemIds = []) {
  const { LIMITS } = require('../utils/wishlistValidator');
  const { WISHLIST_ITEMS } = require('../utils/items');

  const rows = [];

  // Count how many items in each category have been received
  const receivedCounts = {
    archbossWeapon: 0,
    archbossArmor: 0,
    t3Weapons: 0,
    t3Armors: 0,
    t3Accessories: 0
  };

  // Count received items per category
  for (const itemId of receivedItemIds) {
    // Check which category this item belongs to
    if (WISHLIST_ITEMS.archbossWeapons.find(i => i.id === itemId)) {
      receivedCounts.archbossWeapon++;
    } else if (WISHLIST_ITEMS.archbossArmors.find(i => i.id === itemId)) {
      receivedCounts.archbossArmor++;
    } else if (WISHLIST_ITEMS.t3Weapons.find(i => i.id === itemId)) {
      receivedCounts.t3Weapons++;
    } else if (WISHLIST_ITEMS.t3Armors.find(i => i.id === itemId)) {
      receivedCounts.t3Armors++;
    } else if (WISHLIST_ITEMS.t3Accessories.find(i => i.id === itemId)) {
      receivedCounts.t3Accessories++;
    }
  }

  // Check if categories are fully locked (all items received)
  const archbossWeaponLocked = receivedCounts.archbossWeapon >= LIMITS.archbossWeapon;
  const archbossArmorLocked = receivedCounts.archbossArmor >= LIMITS.archbossArmor;
  const t3WeaponsLocked = receivedCounts.t3Weapons >= LIMITS.t3Weapons;
  const t3ArmorsLocked = receivedCounts.t3Armors >= LIMITS.t3Armors;
  const t3AccessoriesLocked = receivedCounts.t3Accessories >= LIMITS.t3Accessories;

  // Row 1: Category selection buttons
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('wishlist_select_archboss_weapon')
      .setLabel(archbossWeaponLocked ? '⚔️ Archboss Weapons 🔒' : '⚔️ Archboss Weapons')
      .setStyle(archbossWeaponLocked ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(archbossWeaponLocked),
    new ButtonBuilder()
      .setCustomId('wishlist_select_archboss_armor')
      .setLabel(archbossArmorLocked ? '🛡️ Archboss Armor 🔒' : '🛡️ Archboss Armor')
      .setStyle(archbossArmorLocked ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(archbossArmorLocked)
  );

  // Row 2: More category buttons
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('wishlist_select_t3_weapons')
      .setLabel(t3WeaponsLocked ? '⚔️ Weapons 🔒' : '⚔️ Weapons')
      .setStyle(t3WeaponsLocked ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(t3WeaponsLocked),
    new ButtonBuilder()
      .setCustomId('wishlist_select_t3_armors')
      .setLabel(t3ArmorsLocked ? '🛡️ Armor 🔒' : '🛡️ Armor')
      .setStyle(t3ArmorsLocked ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(t3ArmorsLocked),
    new ButtonBuilder()
      .setCustomId('wishlist_select_t3_accessories')
      .setLabel(t3AccessoriesLocked ? '💍 Accessories 🔒' : '💍 Accessories')
      .setStyle(t3AccessoriesLocked ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(t3AccessoriesLocked)
  );

  // Row 3: Action buttons
  const isEmpty = isWishlistEmpty(wishlist);

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('wishlist_clear_all')
      .setLabel('🗑️ Clear All')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(isEmpty),
    new ButtonBuilder()
      .setCustomId('wishlist_submit')
      .setLabel('✅ Submit Wishlist')
      .setStyle(ButtonStyle.Success)
      .setDisabled(isEmpty)
  );

  rows.push(row1, row2, row3);

  return rows;
}

module.exports = {
  handleMyWishlist,
  createWishlistButtons
};