const { StringSelectMenuBuilder, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const { BOSS_DATA } = require('../../data/bossData');
const { createWishlistEmbed } = require('../../features/wishlist/embed');
const { buildWishlistControls } = require('../../features/wishlist/controls');
const { getUserWishlist } = require('./commands/mywishlist');

async function handleSelects({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  // Tier selection -> show bosses
  if (interaction.customId.startsWith('select_tier_')) {
    const itemType = interaction.customId.replace('select_tier_', '');
    const tier = interaction.values[0];

    const bosses = Object.keys(BOSS_DATA[tier]);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_boss_${itemType}_${tier}`)
        .setPlaceholder('Choose a boss')
        .addOptions(bosses.map(boss => ({ label: boss, value: boss, emoji: '💀' })))
    );

    return interaction.update({ content: 'Now select which boss:', components: [row] });
  }

  // Boss selection -> show items for that boss
  if (interaction.customId.startsWith('select_boss_')) {
    const parts = interaction.customId.split('_');
    const itemType = parts[2];
    const tier = parts[3];
    const boss = interaction.values[0];

    const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
    const items = BOSS_DATA[tier][boss][itemKey];
    const bossImage = BOSS_DATA[tier][boss].image;

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setTitle(`💀 ${boss}`)
      .setDescription(`Select your ${itemType}${itemType === 'armor' ? ' (you can select multiple)' : ''}:`)
      .setImage(bossImage);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_item_${itemType}_${tier}_${boss}`)
        .setPlaceholder(`Choose ${itemType}`)
        .setMinValues(1)
        .setMaxValues(itemType === 'armor' ? Math.min(items.length, 4) : 1)
        .addOptions(items.map(item => ({ label: item, value: item })))
    );

    return interaction.update({ content: '', embeds: [embed], components: [row] });
  }

  // Item selection -> add to wishlist
  if (interaction.customId.startsWith('select_item_')) {
    const parts = interaction.customId.split('_');
    const itemType = parts[2];
    const selectedItems = interaction.values;

    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) {
      return interaction.update({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', embeds: [], components: [] });
    }

    const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
    const tokenKey = itemType === 'weapon' ? 'weapon' : itemType === 'armor' ? 'armor' : 'accessory';
    const maxTokens = (itemType === 'weapon' ? 1 : itemType === 'armor' ? 4 : 1) + (wl.tokenGrants?.[tokenKey] || 0);

    const tokensNeeded = selectedItems.length;
    const tokensAvailable = maxTokens - wl.tokensUsed[tokenKey];

    if (tokensNeeded > tokensAvailable) {
      const embed = createWishlistEmbed(wl, interaction.member);
      const components = wl.finalized ? [] : buildWishlistControls(wl);
      return interaction.update({
        content: `❌ You don't have enough ${itemType} tokens! You need ${tokensNeeded} but only have ${tokensAvailable} available.`,
        embeds: [embed],
        components
      });
    }

    const timestamp = new Date();
    const stampUpdates = {};
    for (const item of selectedItems) stampUpdates[`timestamps.${item}`] = timestamp;

    await wishlists.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $push: { [itemKey]: { $each: selectedItems } }, $inc: { [`tokensUsed.${tokenKey}`]: tokensNeeded }, $set: stampUpdates }
    );

    const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(updated, interaction.member);
    const itemsList = selectedItems.map(i => `• ${i}`).join('\n');
    const components = updated.finalized ? [] : buildWishlistControls(updated);

    return interaction.update({ content: `✅ Added ${tokensNeeded} item(s) to your wishlist:\n${itemsList}`, embeds: [embed], components });
  }

  // Confirm remove item (from "remove_item" button)
  if (interaction.customId === 'confirm_remove_item') {
    const [itemType, ...itemParts] = interaction.values[0].split(':');
    const itemName = itemParts.join(':');
    const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
    const tokenKey = itemType === 'weapon' ? 'weapon' : itemType === 'armor' ? 'armor' : 'accessory';

    await wishlists.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $pull: { [itemKey]: itemName }, $inc: { [`tokensUsed.${tokenKey}`]: -1 }, $unset: { [`timestamps.${itemName}`]: '' } }
    );

    const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(updated, interaction.member);
    const components = updated.finalized ? [] : buildWishlistControls(updated);

    return interaction.update({ content: `✅ Removed **${itemName}** from your wishlist!`, embeds: [embed], components });
  }

  // Summary selects (handed out / unmark)
  if (interaction.customId === 'confirm_handed_out') {
    const [userId, ...itemParts] = interaction.values[0].split(':');
    const item = itemParts.join(':');

    await handedOut.updateOne(
      { guildId: interaction.guildId, userId, item },
      { $set: { guildId: interaction.guildId, userId, item, timestamp: new Date() } },
      { upsert: true }
    );

    return interaction.update({ content: `✅ Marked **${item}** as handed out!`, components: [] });
  }

  if (interaction.customId === 'confirm_unmark_handed_out') {
    const selections = interaction.values;
    let removed = 0;
    for (const sel of selections) {
      const [userId, ...itemParts] = sel.split(':');
      const item = itemParts.join(':');
      const res = await handedOut.deleteOne({ guildId: interaction.guildId, userId, item });
      if (res.deletedCount > 0) removed++;
    }
    return interaction.update({ content: `↩️ Unmarked ${removed} item(s) as handed out.`, components: [] });
  }
}

module.exports = { handleSelects };
