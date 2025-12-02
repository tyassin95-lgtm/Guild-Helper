const { EmbedBuilder } = require('discord.js');

function createWishlistEmbed(wishlist, user, pendingRegenerations = []) {
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
  const itemsReceived = normalizeArr(wishlist.itemsReceived);

  const formatItems = (arr, timestamps = {}) => {
    if (!arr || arr.length === 0) return 'None selected';

    return arr.map(it => {
      const name = typeof it === 'string' ? it : it.name;
      const boss = typeof it === 'string' ? null : it.boss;
      const addedAt = typeof it === 'string' ? timestamps?.[name] : it.addedAt;

      const bossStr = boss ? ` — from **${boss}**` : '';
      const dateStr = addedAt ? ` (${fmtDate(addedAt)})` : '';
      return `• ${name}${bossStr}${dateStr}`;
    }).join('\n');
  };

  const formatReceivedItems = (arr) => {
    if (!arr || arr.length === 0) return 'None yet';

    return arr.map(it => {
      const icon = it.type === 'weapon' ? '⚔️' : it.type === 'armor' ? '🛡️' : '💍';
      const bossStr = it.boss ? ` — **${it.boss}**` : '';
      const dateStr = it.receivedAt ? ` (${fmtDate(it.receivedAt)})` : '';
      return `${icon} ${it.name}${bossStr}${dateStr}`;
    }).join('\n');
  };

  const regenInfo = [];
  for (const regen of pendingRegenerations) {
    const daysLeft = Math.ceil((new Date(regen.regeneratesAt) - new Date()) / (1000 * 60 * 60 * 24));
    const tokenName = regen.tokenType.charAt(0).toUpperCase() + regen.tokenType.slice(1);
    regenInfo.push(`• ${tokenName} token (${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining)`);
  }

  const embed = new EmbedBuilder()
    .setColor(wishlist.finalized ? '#FFD700' : '#3498db')
    .setTitle(`${user.displayName}'s Wishlist`)
    .setDescription(
      wishlist.finalized 
        ? '✅ **FINALIZED** - You can add items when tokens regenerate'
        : 'Click the buttons below to manage your wishlist'
    )
    .addFields(
      {
        name: `⚔️ Weapons (${weaponTokens} token${weaponTokens !== 1 ? 's' : ''} available)`,
        value: formatItems(weapons, wishlist.timestamps),
        inline: false
      },
      {
        name: `🛡️ Armor (${armorTokens} token${armorTokens !== 1 ? 's' : ''} available)`,
        value: formatItems(armor, wishlist.timestamps),
        inline: false
      },
      {
        name: `💍 Accessories (${accessoryTokens} token${accessoryTokens !== 1 ? 's' : ''} available)`,
        value: formatItems(accessories, wishlist.timestamps),
        inline: false
      }
    )
    .setFooter({ text: 'Throne and Liberty Guild Helper' })
    .setTimestamp();

  if (regenInfo.length > 0) {
    embed.addFields({
      name: '🔄 Regenerating Tokens',
      value: regenInfo.join('\n'),
      inline: false
    });
  }

  if (itemsReceived.length > 0) {
    const receivedText = formatReceivedItems(itemsReceived);
    const truncated = receivedText.length > 1024 ? receivedText.substring(0, 1021) + '...' : receivedText;

    embed.addFields({
      name: `📦 Items Received (${itemsReceived.length})`,
      value: truncated,
      inline: false
    });
  }

  return embed;
}

module.exports = { createWishlistEmbed };