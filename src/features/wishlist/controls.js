const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildWishlistControls(wishlist) {
  const weaponTokens = (1 + (wishlist.tokenGrants?.weapon || 0)) - wishlist.tokensUsed.weapon;
  const armorTokens = (4 + (wishlist.tokenGrants?.armor || 0)) - wishlist.tokensUsed.armor;
  const accessoryTokens = (1 + (wishlist.tokenGrants?.accessory || 0)) - wishlist.tokensUsed.accessory;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('add_weapon').setLabel('Add Weapon').setStyle(ButtonStyle.Primary).setEmoji('⚔️').setDisabled(weaponTokens <= 0),
    new ButtonBuilder().setCustomId('add_armor').setLabel('Add Armor').setStyle(ButtonStyle.Primary).setEmoji('🛡️').setDisabled(armorTokens <= 0),
    new ButtonBuilder().setCustomId('add_accessory').setLabel('Add Accessory').setStyle(ButtonStyle.Primary).setEmoji('💍').setDisabled(accessoryTokens <= 0)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('remove_item').setLabel('Remove Item').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
    new ButtonBuilder().setCustomId('clear_all').setLabel('Clear All').setStyle(ButtonStyle.Danger).setEmoji('♻️'),
    new ButtonBuilder().setCustomId('finalize_wishlist').setLabel('Finalize Wishlist').setStyle(ButtonStyle.Success).setEmoji('✅')
  );

  return [row1, row2];
}

module.exports = { buildWishlistControls };
