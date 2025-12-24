// Shared storage for draft wishlists
// This prevents circular dependency issues between wishlistButtons and wishlistSelects

const draftWishlists = new Map();

module.exports = { draftWishlists };