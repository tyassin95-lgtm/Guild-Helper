// Wishlist validation utilities

const LIMITS = {
  archbossWeapon: 1,
  archbossArmor: 1,
  t3Weapons: 2,
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

module.exports = {
  LIMITS,
  validateWishlist,
  isWishlistEmpty,
  getWishlistCounts
};