const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { BOSS_DATA } = require('../../data/bossData');
const { createWishlistEmbed } = require('../../features/wishlist/embed');
const { buildWishlistControls } = require('../../features/wishlist/controls');
const { scheduleLiveSummaryUpdate } = require('../liveSummary');

// shared util used by multiple handlers
async function getUserWishlist(wishlists, userId, guildId) {
  let wl = await wishlists.findOne({ userId, guildId });
  if (!wl) {
    wl = {
      userId, guildId,
      weapons: [], armor: [], accessories: [],
      tokensUsed: { weapon: 0, armor: 0, accessory: 0 },
      tokenGrants: { weapon: 0, armor: 0, accessory: 0 },
      timestamps: {}, // legacy support
      finalized: false
    };
    await wishlists.insertOne(wl);
  }
  return wl;
}

async function handleSelects({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  // choose tier -> show bosses
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

  // choose boss -> show items
  if (interaction.customId.startsWith('select_boss_')) {
    const parts = interaction.customId.split('_');
    const itemType = parts[2];
    const tier = parts[3];
    const boss = interaction.values[0];

    const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
    const items = BOSS_DATA[tier][boss][itemKey];
    const bossImage = BOSS_DATA[tier][boss].image;

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

  // choose items -> add (now store boss + tier with each item)
  if (interaction.customId.startsWith('select_item_')) {
    const parts = interaction.customId.split('_');
    const itemType = parts[2];
    const tier = parts[3];
    const boss = parts.slice(4).join('_'); // boss might contain underscores if ever

    const selectedItems = interaction.values;

    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) {
      return interaction.update({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', embeds: [], components: [] });
    }

    const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
    const tokenKey = itemType === 'weapon' ? 'weapon' : itemType === 'armor' ? 'armor' : 'accessory';
    const maxTokens = (itemType === 'weapon' ? 1 : itemType === 'armor' ? 4 : 1) + (wl.tokenGrants?.[tokenKey] || 0);

    const tokensNeeded = selectedItems.length;
    const tokensAvailable = maxTokens - (wl.tokensUsed?.[tokenKey] || 0);

    if (tokensNeeded > tokensAvailable) {
      const embed = createWishlistEmbed(wl, interaction.member);
      const components = wl.finalized ? [] : buildWishlistControls(wl);
      return interaction.update({
        content: `❌ You don't have enough ${itemType} tokens! You need ${tokensNeeded} but only have ${tokensAvailable} available.`,
        embeds: [embed],
        components
      });
    }

    const now = new Date();
    const entries = selectedItems.map(name => ({
      name, boss, tier, type: itemType, addedAt: now
    }));

    await wishlists.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      {
        $push: { [itemKey]: { $each: entries } },
        $inc: { [`tokensUsed.${tokenKey}`]: tokensNeeded }
      }
    );

    const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(updated, interaction.member);
    const itemsList = selectedItems.map(i => `• ${i} — from **${boss}**`).join('\n');
    const components = updated.finalized ? [] : buildWishlistControls(updated);

    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.update({ content: `✅ Added ${tokensNeeded} item(s) to your wishlist:\n${itemsList}`, embeds: [embed], components });
  }

  // ===== FIXED: confirm remove single item with better boss matching
  if (interaction.customId === 'confirm_remove_item') {
    try {
      const raw = interaction.values[0];
      // Two supported encodings coming from the remove menu:
      // 1) legacy string:  "type::Item Name"
      // 2) object entry:   "type:Boss Name:Item Name"
      const isLegacy = raw.includes('::');
      let itemType, boss, itemName;

      if (isLegacy) {
        [itemType, itemName] = raw.split('::');
        boss = null;
      } else {
        // split only the first two ':' to preserve colons in names if any
        const firstColon = raw.indexOf(':');
        const secondColon = raw.indexOf(':', firstColon + 1);
        itemType = raw.slice(0, firstColon);
        boss = raw.slice(firstColon + 1, secondColon);
        itemName = raw.slice(secondColon + 1);
      }

      const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
      const tokenKey = itemType === 'weapon' ? 'weapon' : itemType === 'armor' ? 'armor' : 'accessory';

      // Get current wishlist to find exact match
      const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);

      // Find the exact item to remove
      let itemToRemove = null;
      const itemArray = wl[itemKey] || [];

      if (isLegacy) {
        // Legacy: match by name only (string)
        itemToRemove = itemArray.find(item => 
          typeof item === 'string' ? item === itemName : item.name === itemName
        );
      } else {
        // New format: match by both name AND boss
        itemToRemove = itemArray.find(item => 
          typeof item === 'object' && item.name === itemName && item.boss === boss
        );
      }

      if (!itemToRemove) {
        // Item not found - gracefully handle
        const embed = createWishlistEmbed(wl, interaction.member);
        const components = wl.finalized ? [] : buildWishlistControls(wl);
        return interaction.update({
          content: 'ℹ️ That item was not found in your wishlist (it may have already been removed).',
          embeds: [embed],
          components
        });
      }

      // Build the correct pull query based on item structure
      let pullQuery;
      if (typeof itemToRemove === 'string') {
        // Legacy string format
        pullQuery = { [itemKey]: itemName };
      } else {
        // Object format - need to match the exact subdocument
        pullQuery = { [itemKey]: { name: itemName, boss, tier: itemToRemove.tier, type: itemToRemove.type, addedAt: itemToRemove.addedAt } };
      }

      const res = await wishlists.updateOne(
        { userId: interaction.user.id, guildId: interaction.guildId },
        {
          $pull: pullQuery,
          $inc: { [`tokensUsed.${tokenKey}`]: -1 },
          ...(typeof itemToRemove === 'string' ? { $unset: { [`timestamps.${itemName}`]: '' } } : {})
        }
      );

      const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
      const embed = createWishlistEmbed(updated, interaction.member);
      const components = updated.finalized ? [] : buildWishlistControls(updated);

      await scheduleLiveSummaryUpdate(interaction, collections);

      const removedText = boss ? `**${itemName}** from **${boss}**` : `**${itemName}**`;
      return interaction.update({
        content: res.modifiedCount > 0
          ? `✅ Removed ${removedText} from your wishlist!`
          : `ℹ️ That item was not found in your wishlist (it may have already been removed).`,
        embeds: [embed],
        components
      });
    } catch (err) {
      console.error('confirm_remove_item error:', err);
      // Fallback UI (don't let Discord show "This interaction failed")
      try {
        const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
        const embed = createWishlistEmbed(wl, interaction.member);
        const components = wl.finalized ? [] : buildWishlistControls(wl);
        return interaction.update({ content: '❌ Could not remove that item due to an error.', embeds: [embed], components });
      } catch {
        return interaction.reply({ content: '❌ Could not remove that item due to an error.', ephemeral: true });
      }
    }
  }

  // confirm "mark handed out" from summary menu
  if (interaction.customId === 'confirm_handed_out') {
    // value format: `${userId}:${boss}:${itemName}`
    const [userId, boss, ...rest] = interaction.values[0].split(':');
    const item = rest.join(':');

    await handedOut.updateOne(
      { guildId: interaction.guildId, userId, item, boss },
      { $set: { guildId: interaction.guildId, userId, item, boss, timestamp: new Date() } },
      { upsert: true }
    );

    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.update({ content: `✅ Marked **${item}** (from **${boss}**) as handed out!`, components: [] });
  }

  // confirm "unmark handed out" (multi)
  if (interaction.customId === 'confirm_unmark_handed_out') {
    let removed = 0;
    for (const sel of interaction.values) {
      const [userId, boss, ...rest] = sel.split(':');
      const item = rest.join(':');
      const res = await handedOut.deleteOne({ guildId: interaction.guildId, userId, item, boss });
      if (res.deletedCount > 0) removed++;
    }

    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.update({ content: `↩️ Unmarked ${removed} item(s) as handed out.`, components: [] });
  }
}

module.exports = { handleSelects, getUserWishlist };