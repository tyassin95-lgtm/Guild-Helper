// Handler for /mywishlist command
const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildUserWishlistEmbed } = require('../utils/panelBuilder');
const { isWishlistEmpty } = require('../utils/wishlistValidator');

async function handleMyWishlist({ interaction, collections }) {
  const { guildSettings, wishlistSubmissions, wishlistSettings } = collections;

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

  // Check if user already has a submitted wishlist
  const existingSubmission = await wishlistSubmissions.findOne({
    userId: interaction.user.id,
    guildId: interaction.guildId
  });

  if (existingSubmission) {
    // User already submitted - cannot edit
    const embed = buildUserWishlistEmbed({
      wishlist: existingSubmission,
      user: interaction.user,
      frozen: false
    });

    embed.setColor('#e74c3c');
    embed.setTitle('🎯 Your Submitted Wishlist');
    embed.setDescription(
      '**Your wishlist has already been submitted and cannot be edited.**\n\n' +
      'If you need to make changes, please contact an administrator to reset your wishlist.\n\n' +
      embed.data.description
    );

    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  // Create new draft wishlist
  const draftWishlist = {
    archbossWeapon: [],
    archbossArmor: [],
    t3Weapons: [],
    t3Armors: [],
    t3Accessories: []
  };

  // Build initial embed
  const embed = buildUserWishlistEmbed({
    wishlist: draftWishlist,
    user: interaction.user,
    frozen: false
  });

  // Create action buttons
  const buttons = createWishlistButtons(draftWishlist);

  await interaction.reply({
    embeds: [embed],
    components: buttons,
    flags: [64]
  });
}

/**
 * Create wishlist action buttons
 * @param {Object} wishlist - Current wishlist state
 * @returns {Array<ActionRowBuilder>}
 */
function createWishlistButtons(wishlist) {
  const rows = [];

  // Row 1: Category selection buttons
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('wishlist_select_archboss_weapon')
      .setLabel('⚔️ Archboss Weapons')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('wishlist_select_archboss_armor')
      .setLabel('🛡️ Archboss Armor')
      .setStyle(ButtonStyle.Primary)
  );

  // Row 2: More category buttons
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('wishlist_select_t3_weapons')
      .setLabel('⚔️ T3 Weapons')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('wishlist_select_t3_armors')
      .setLabel('🛡️ T3 Armor')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('wishlist_select_t3_accessories')
      .setLabel('💍 Accessories')
      .setStyle(ButtonStyle.Primary)
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