const { createWishlistEmbed } = require('../../../features/wishlist/embed');
const { buildWishlistControls } = require('../../../features/wishlist/controls');
const { getUserPendingRegenerations, validateAndFixTokenCounts } = require('../../tokenRegeneration');

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
      itemsReceived: [], // NEW
      finalized: false
    };
    await wishlists.insertOne(wishlist);
  }
  return wishlist;
}

async function handleMyWishlist({ interaction, collections }) {
  const { wishlists } = collections;
  const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);

  // Validate and fix token counts if needed
  await validateAndFixTokenCounts(interaction.user.id, interaction.guildId, collections);

  // Get pending regenerations
  const pendingRegens = await getUserPendingRegenerations(
    interaction.user.id, 
    interaction.guildId, 
    collections
  );

  const embed = createWishlistEmbed(wl, interaction.member, pendingRegens);

  // Check if user has available tokens (including regenerated ones)
  const weaponTokens = Math.max(0, (1 + (wl.tokenGrants?.weapon || 0)) - (wl.tokensUsed?.weapon || 0));
  const armorTokens = Math.max(0, (4 + (wl.tokenGrants?.armor || 0)) - (wl.tokensUsed?.armor || 0));
  const accessoryTokens = Math.max(0, (1 + (wl.tokenGrants?.accessory || 0)) - (wl.tokensUsed?.accessory || 0));

  const hasTokens = weaponTokens > 0 || armorTokens > 0 || accessoryTokens > 0;

  // If not finalized, show full controls
  if (!wl.finalized) {
    return interaction.reply({ embeds: [embed], components: buildWishlistControls(wl), flags: [64] });
  }

  // If finalized but has available tokens, show LIMITED controls (only add buttons, no remove/clear)
  if (hasTokens) {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const addRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('add_weapon')
        .setLabel('Add Weapon')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️')
        .setDisabled(weaponTokens <= 0),
      new ButtonBuilder()
        .setCustomId('add_armor')
        .setLabel('Add Armor')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🛡️')
        .setDisabled(armorTokens <= 0),
      new ButtonBuilder()
        .setCustomId('add_accessory')
        .setLabel('Add Accessory')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💍')
        .setDisabled(accessoryTokens <= 0)
    );

    return interaction.reply({ 
      embeds: [embed], 
      components: [addRow], 
      flags: [64] 
    });
  }

  // Fully finalized with no tokens - no controls
  return interaction.reply({ embeds: [embed], flags: [64] });
}

module.exports = { handleMyWishlist, getUserWishlist };