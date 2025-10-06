const { EmbedBuilder } = require('discord.js');

function createWishlistEmbed(wishlist, member) {
  const weaponTokens = (1 + (wishlist.tokenGrants?.weapon || 0)) - wishlist.tokensUsed.weapon;
  const armorTokens = (4 + (wishlist.tokenGrants?.armor || 0)) - wishlist.tokensUsed.armor;
  const accessoryTokens = (1 + (wishlist.tokenGrants?.accessory || 0)) - wishlist.tokensUsed.accessory;

  const formatItems = (items, timestamps) => {
    if (!items || items.length === 0) return 'None selected';
    return items.map(item => {
      const ts = timestamps?.[item];
      const dateStr = ts ? ` (${new Date(ts).toLocaleDateString()})` : '';
      return `• ${item}${dateStr}`;
    }).join('\n');
  };

  return new EmbedBuilder()
    .setColor(wishlist.finalized ? '#FFD700' : '#3498db')
    .setTitle(`${member.displayName}'s Wishlist`)
    .setDescription(wishlist.finalized ? '✅ **FINALIZED** - Contact an admin to make changes' : 'Click the buttons below to manage your wishlist')
    .addFields(
      { name: `⚔️ Weapons (${weaponTokens} token${weaponTokens !== 1 ? 's' : ''} remaining)`, value: formatItems(wishlist.weapons, wishlist.timestamps) },
      { name: `🛡️ Armor (${armorTokens} token${armorTokens !== 1 ? 's' : ''} remaining)`, value: formatItems(wishlist.armor, wishlist.timestamps) },
      { name: `💍 Accessories (${accessoryTokens} token${accessoryTokens !== 1 ? 's' : ''} remaining)`, value: formatItems(wishlist.accessories, wishlist.timestamps) }
    )
    .setFooter({ text: 'Throne and Liberty Guild Helper' })
    .setTimestamp();
}

module.exports = { createWishlistEmbed };
