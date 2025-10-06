const { EmbedBuilder } = require('discord.js');

function createWishlistEmbed(wishlist, user) {
  const weaponTokens = (1 + (wishlist.tokenGrants?.weapon || 0)) - (wishlist.tokensUsed?.weapon || 0);
  const armorTokens = (4 + (wishlist.tokenGrants?.armor || 0)) - (wishlist.tokensUsed?.armor || 0);
  const accessoryTokens = (1 + (wishlist.tokenGrants?.accessory || 0)) - (wishlist.tokensUsed?.accessory || 0);

  const fmtDate = (d) => {
    try { return new Date(d).toLocaleDateString(); } catch { return ''; }
  };

  const normalizeArr = (arr) => Array.isArray(arr) ? arr : [];
  const weapons = normalizeArr(wishlist.weapons);
  const armor = normalizeArr(wishlist.armor);
  const accessories = normalizeArr(wishlist.accessories);

  const formatItems = (arr, timestamps = {}) => {
    if (!arr || arr.length === 0) return 'None selected';

    return arr.map(it => {
      // Support both legacy strings and new object form
      const name = typeof it === 'string' ? it : it.name;
      const boss = typeof it === 'string' ? null : it.boss;
      const addedAt = typeof it === 'string' ? timestamps?.[name] : it.addedAt;

      const bossStr = boss ? ` — from **${boss}**` : '';
      const dateStr = addedAt ? ` (${fmtDate(addedAt)})` : '';
      return `• ${name}${bossStr}${dateStr}`;
    }).join('\n');
  };

  return new EmbedBuilder()
    .setColor(wishlist.finalized ? '#FFD700' : '#3498db')
    .setTitle(`${user.displayName}'s Wishlist`)
    .setDescription(wishlist.finalized ? '✅ **FINALIZED** - Contact an admin to make changes' : 'Click the buttons below to manage your wishlist')
    .addFields(
      {
        name: `⚔️ Weapons (${weaponTokens} token${weaponTokens !== 1 ? 's' : ''} remaining)`,
        value: formatItems(weapons, wishlist.timestamps),
        inline: false
      },
      {
        name: `🛡️ Armor (${armorTokens} token${armorTokens !== 1 ? 's' : ''} remaining)`,
        value: formatItems(armor, wishlist.timestamps),
        inline: false
      },
      {
        name: `💍 Accessories (${accessoryTokens} token${accessoryTokens !== 1 ? 's' : ''} remaining)`,
        value: formatItems(accessories, wishlist.timestamps),
        inline: false
      }
    )
    .setFooter({ text: 'Throne and Liberty Guild Helper' })
    .setTimestamp();
}

module.exports = { createWishlistEmbed };
