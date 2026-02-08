// Wishlist validation utilities

const LIMITS = {
  archbossWeapon: 1,
  archbossArmor: 1,
  t3Weapons: 1, // Changed from 2 to 1
  t3Armors: 4,
  t3Accessories: 2
};

/**
 * Validate a wishlist submission
 * @param {Object} wishlist - The wishlist object to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateWishlist(wishlist) {
  const errors = [];

  // Check archboss weapon limit
  if (wishlist.archbossWeapon && Array.isArray(wishlist.archbossWeapon)) {
    if (wishlist.archbossWeapon.length > LIMITS.archbossWeapon) {
      errors.push(`Too many Archboss Weapons selected (max: ${LIMITS.archbossWeapon})`);
    }
  }

  // Check archboss armor limit
  if (wishlist.archbossArmor && Array.isArray(wishlist.archbossArmor)) {
    if (wishlist.archbossArmor.length > LIMITS.archbossArmor) {
      errors.push(`Too many Archboss Armors selected (max: ${LIMITS.archbossArmor})`);
    }
  }

  // Check T3 weapons limit
  if (wishlist.t3Weapons && wishlist.t3Weapons.length > LIMITS.t3Weapons) {
    errors.push(`Too many T3 Weapons selected (max: ${LIMITS.t3Weapons})`);
  }

  // Check T3 armors limit
  if (wishlist.t3Armors && wishlist.t3Armors.length > LIMITS.t3Armors) {
    errors.push(`Too many T3 Armors selected (max: ${LIMITS.t3Armors})`);
  }

  // Check T3 accessories limit
  if (wishlist.t3Accessories && wishlist.t3Accessories.length > LIMITS.t3Accessories) {
    errors.push(`Too many T3 Accessories selected (max: ${LIMITS.t3Accessories})`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if wishlist is empty
 * @param {Object} wishlist - The wishlist object
 * @returns {boolean}
 */
function isWishlistEmpty(wishlist) {
  if (!wishlist) return true;

  const hasArchbossWeapon = wishlist.archbossWeapon && wishlist.archbossWeapon.length > 0;
  const hasArchbossArmor = wishlist.archbossArmor && wishlist.archbossArmor.length > 0;
  const hasT3Weapons = wishlist.t3Weapons && wishlist.t3Weapons.length > 0;
  const hasT3Armors = wishlist.t3Armors && wishlist.t3Armors.length > 0;
  const hasT3Accessories = wishlist.t3Accessories && wishlist.t3Accessories.length > 0;

  return !hasArchbossWeapon && !hasArchbossArmor && !hasT3Weapons && !hasT3Armors && !hasT3Accessories;
}

/**
 * Get count of items in each category
 * @param {Object} wishlist - The wishlist object
 * @returns {Object} Counts for each category
 */
function getWishlistCounts(wishlist) {
  if (!wishlist) {
    return {
      archbossWeapon: 0,
      archbossArmor: 0,
      t3Weapons: 0,
      t3Armors: 0,
      t3Accessories: 0
    };
  }

  return {
    archbossWeapon: (wishlist.archbossWeapon && wishlist.archbossWeapon.length) || 0,
    archbossArmor: (wishlist.archbossArmor && wishlist.archbossArmor.length) || 0,
    t3Weapons: (wishlist.t3Weapons && wishlist.t3Weapons.length) || 0,
    t3Armors: (wishlist.t3Armors && wishlist.t3Armors.length) || 0,
    t3Accessories: (wishlist.t3Accessories && wishlist.t3Accessories.length) || 0
  };
}

/**
 * Check if all wishlist picks are exhausted (submitted + received items >= limits for all categories)
 * @param {Object} submission - The submitted wishlist
 * @param {Array} receivedItemIds - Array of received item IDs
 * @param {Object} WISHLIST_ITEMS - The wishlist items catalog
 * @returns {boolean} True if all categories are at their limit
 */
function areAllPicksExhausted(submission, receivedItemIds, WISHLIST_ITEMS) {
  // Count received items per category
  const receivedCounts = {
    archbossWeapon: 0,
    archbossArmor: 0,
    t3Weapons: 0,
    t3Armors: 0,
    t3Accessories: 0
  };

  for (const itemId of receivedItemIds) {
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

  // Check if all categories are at their limit
  const archbossWeaponAtLimit = receivedCounts.archbossWeapon >= LIMITS.archbossWeapon;
  const archbossArmorAtLimit = receivedCounts.archbossArmor >= LIMITS.archbossArmor;
  const t3WeaponsAtLimit = receivedCounts.t3Weapons >= LIMITS.t3Weapons;
  const t3ArmorsAtLimit = receivedCounts.t3Armors >= LIMITS.t3Armors;
  const t3AccessoriesAtLimit = receivedCounts.t3Accessories >= LIMITS.t3Accessories;

  return archbossWeaponAtLimit && archbossArmorAtLimit && t3WeaponsAtLimit && 
         t3ArmorsAtLimit && t3AccessoriesAtLimit;
}

module.exports = {
  LIMITS,
  validateWishlist,
  isWishlistEmpty,
  getWishlistCounts,
  areAllPicksExhausted
};