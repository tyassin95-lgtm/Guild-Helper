const { createWishlistEmbed } = require('../../../features/wishlist/embed');
const { buildWishlistControls } = require('../../../features/wishlist/controls');

async function getUserWishlist(wishlists, userId, guildId) {
  let wishlist = await wishlists.findOne({ userId, guildId });
  if (!wishlist) {
    wishlist = {
      userId,
      guildId,
      weapons: [],
      armor: [],
      accessories: [],
      tokensUsed: { weapon: 0, armor: 0, accessory: 0 },
      tokenGrants: { weapon: 0, armor: 0, accessory: 0 },
      timestamps: {},
      finalized: false
    };
    await wishlists.insertOne(wishlist);
  }
  return wishlist;
}

async function handleMyWishlist({ interaction, collections }) {
  const { wishlists } = collections;
  const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
  const embed = createWishlistEmbed(wl, interaction.member);
  if (!wl.finalized) {
    return interaction.reply({ embeds: [embed], components: buildWishlistControls(wl), ephemeral: true });
  }
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { handleMyWishlist, getUserWishlist };
