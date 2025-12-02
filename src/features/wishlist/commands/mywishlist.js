const { createWishlistEmbed } = require('../utils/embed');
const { buildWishlistControls } = require('../utils/controls');
const { getUserPendingRegenerations, validateAndFixTokenCounts } = require('../utils/tokenRegeneration');
const { getUserWishlist } = require('../utils/wishlistHelper');

async function handleMyWishlist({ interaction, collections }) {
  const { wishlists } = collections;
  const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);

  await validateAndFixTokenCounts(interaction.user.id, interaction.guildId, collections);

  const pendingRegens = await getUserPendingRegenerations(
    interaction.user.id, 
    interaction.guildId, 
    collections
  );

  const embed = createWishlistEmbed(wl, interaction.member, pendingRegens);

  const weaponTokens = Math.max(0, (1 + (wl.tokenGrants?.weapon || 0)) - (wl.tokensUsed?.weapon || 0));
  const armorTokens = Math.max(0, (4 + (wl.tokenGrants?.armor || 0)) - (wl.tokensUsed?.armor || 0));
  const accessoryTokens = Math.max(0, (1 + (wl.tokenGrants?.accessory || 0)) - (wl.tokensUsed?.accessory || 0));

  const hasTokens = weaponTokens > 0 || armorTokens > 0 || accessoryTokens > 0;

  if (!wl.finalized) {
    return interaction.reply({ embeds: [embed], components: buildWishlistControls(wl), flags: [64] });
  }

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

  return interaction.reply({ embeds: [embed], flags: [64] });
}

module.exports = { handleMyWishlist };