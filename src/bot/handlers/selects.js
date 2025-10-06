const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { BOSS_DATA } = require('../../data/bossData');
const { createWishlistEmbed } = require('../../features/wishlist/embed');
const { buildWishlistControls } = require('../../features/wishlist/controls');
const { scheduleLiveSummaryUpdate } = require('../liveSummary');
const { scheduleTokenRegeneration } = require('../tokenRegeneration');

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
    const boss = parts.slice(4).join('_');

    const selectedItems = interaction.values;

    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);

    // Check if finalized AND no available tokens
    const tokenKey = itemType === 'weapon' ? 'weapon' : itemType === 'armor' ? 'armor' : 'accessory';
    const maxTokens = (itemType === 'weapon' ? 1 : itemType === 'armor' ? 4 : 1) + (wl.tokenGrants?.[tokenKey] || 0);
    const tokensAvailable = maxTokens - (wl.tokensUsed?.[tokenKey] || 0);

    if (wl.finalized && tokensAvailable === 0) {
      return interaction.update({ content: '❌ Your wishlist is finalized and you have no available tokens. Contact an admin to make changes.', embeds: [], components: [] });
    }

    const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
    const tokensNeeded = selectedItems.length;

    if (tokensNeeded > tokensAvailable) {
      const embed = createWishlistEmbed(wl, interaction.member);

      // Show appropriate controls based on finalized state and available tokens
      let components = [];
      if (!wl.finalized) {
        components = buildWishlistControls(wl);
      } else if (tokensAvailable > 0) {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const weaponTokens = (1 + (wl.tokenGrants?.weapon || 0)) - (wl.tokensUsed?.weapon || 0);
        const armorTokens = (4 + (wl.tokenGrants?.armor || 0)) - (wl.tokensUsed?.armor || 0);
        const accessoryTokens = (1 + (wl.tokenGrants?.accessory || 0)) - (wl.tokensUsed?.accessory || 0);

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
        components = [addRow];
      }

      return interaction.update({
        content: `❌ You don't have enough ${itemType} tokens! You need ${tokensNeeded} but only have ${tokensAvailable} available.`,
        embeds: [embed],
        components
      });
    }

    const now = new Date();
    const entries = selectedItems.map(name => ({
      name, boss, tier, type: itemType, addedAt: now,
      isRegeneratedToken: wl.finalized
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

    // Determine appropriate controls
    let components = [];
    if (!updated.finalized) {
      components = buildWishlistControls(updated);
    } else {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const weaponTokens = (1 + (updated.tokenGrants?.weapon || 0)) - (updated.tokensUsed?.weapon || 0);
      const armorTokens = (4 + (updated.tokenGrants?.armor || 0)) - (updated.tokensUsed?.armor || 0);
      const accessoryTokens = (1 + (updated.tokenGrants?.accessory || 0)) - (updated.tokensUsed?.accessory || 0);

      const row1 = new ActionRowBuilder().addComponents(
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

      const hasRegenItems = [
        ...(updated.weapons || []),
        ...(updated.armor || []),
        ...(updated.accessories || [])
      ].some(item => typeof item === 'object' && item.isRegeneratedToken);

      if (hasRegenItems) {
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('remove_regen_item')
            .setLabel('Remove Regenerated Item')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
          new ButtonBuilder()
            .setCustomId('finalize_regen_items')
            .setLabel('Finalize New Selections')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
        );
        components = [row1, row2];
      } else {
        components = [row1];
      }
    }

    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.update({ content: `✅ Added ${tokensNeeded} item(s) to your wishlist:\n${itemsList}`, embeds: [embed], components });
  }

  // confirm remove single item
  if (interaction.customId === 'confirm_remove_item') {
    try {
      const raw = interaction.values[0];
      const isLegacy = raw.includes('::');
      let itemType, boss, itemName;

      if (isLegacy) {
        [itemType, itemName] = raw.split('::');
        boss = null;
      } else {
        const firstColon = raw.indexOf(':');
        const secondColon = raw.indexOf(':', firstColon + 1);
        itemType = raw.slice(0, firstColon);
        boss = raw.slice(firstColon + 1, secondColon);
        itemName = raw.slice(secondColon + 1);
      }

      const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
      const tokenKey = itemType === 'weapon' ? 'weapon' : itemType === 'armor' ? 'armor' : 'accessory';

      const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);

      let itemToRemove = null;
      const itemArray = wl[itemKey] || [];

      if (isLegacy) {
        itemToRemove = itemArray.find(item => 
          typeof item === 'string' ? item === itemName : item.name === itemName
        );
      } else {
        itemToRemove = itemArray.find(item => 
          typeof item === 'object' && item.name === itemName && item.boss === boss
        );
      }

      if (!itemToRemove) {
        const embed = createWishlistEmbed(wl, interaction.member);
        const components = wl.finalized ? [] : buildWishlistControls(wl);
        return interaction.update({
          content: 'ℹ️ That item was not found in your wishlist (it may have already been removed).',
          embeds: [embed],
          components
        });
      }

      let pullQuery;
      if (typeof itemToRemove === 'string') {
        pullQuery = { [itemKey]: itemName };
      } else {
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

  // confirm remove regenerated token item
  if (interaction.customId === 'confirm_remove_regen_item') {
    try {
      const raw = interaction.values[0];
      const firstColon = raw.indexOf(':');
      const secondColon = raw.indexOf(':', firstColon + 1);
      const itemType = raw.slice(0, firstColon);
      const boss = raw.slice(firstColon + 1, secondColon);
      const itemName = raw.slice(secondColon + 1);

      const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
      const tokenKey = itemType === 'weapon' ? 'weapon' : itemType === 'armor' ? 'armor' : 'accessory';

      const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
      const itemToRemove = wl[itemKey].find(item => 
        typeof item === 'object' && item.name === itemName && item.boss === boss && item.isRegeneratedToken
      );

      if (!itemToRemove) {
        const embed = createWishlistEmbed(wl, interaction.member);
        return interaction.update({
          content: 'ℹ️ That item was not found.',
          embeds: [embed],
          components: []
        });
      }

      await wishlists.updateOne(
        { userId: interaction.user.id, guildId: interaction.guildId },
        {
          $pull: { [itemKey]: itemToRemove },
          $inc: { [`tokensUsed.${tokenKey}`]: -1 }
        }
      );

      const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
      const embed = createWishlistEmbed(updated, interaction.member);

      await scheduleLiveSummaryUpdate(interaction, collections);

      return interaction.update({
        content: `✅ Removed **${itemName}** from **${boss}** from your wishlist!`,
        embeds: [embed],
        components: []
      });
    } catch (err) {
      console.error('confirm_remove_regen_item error:', err);
      return interaction.reply({ content: '❌ Could not remove that item due to an error.', ephemeral: true });
    }
  }

  // confirm "mark handed out" from summary menu
  if (interaction.customId === 'confirm_handed_out') {
    const [userId, boss, ...rest] = interaction.values[0].split(':');
    const item = rest.join(':');

    const wl = await wishlists.findOne({ userId, guildId: interaction.guildId });
    if (!wl) {
      return interaction.update({ content: '❌ User wishlist not found.', components: [] });
    }

    let itemType = null;

    if (wl.weapons?.some(w => (typeof w === 'string' ? w : w.name) === item)) {
      itemType = 'weapon';
    } else if (wl.armor?.some(a => (typeof a === 'string' ? a : a.name) === item)) {
      itemType = 'armor';
    } else if (wl.accessories?.some(ac => (typeof ac === 'string' ? ac : ac.name) === item)) {
      itemType = 'accessory';
    }

    if (!itemType) {
      return interaction.update({ content: '❌ Item not found in user\'s wishlist.', components: [] });
    }

    await handedOut.updateOne(
      { guildId: interaction.guildId, userId, item, boss },
      { $set: { guildId: interaction.guildId, userId, item, boss, timestamp: new Date() } },
      { upsert: true }
    );

    const regenDate = new Date();
    regenDate.setDate(regenDate.getDate() + 7);

    await scheduleTokenRegeneration(interaction.client, {
      userId,
      guildId: interaction.guildId,
      tokenType: itemType,
      itemName: item,
      bossName: boss,
      regeneratesAt: regenDate
    }, collections);

    try {
      const user = await interaction.client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🎉 Item Received!')
        .setDescription(`You have received **${item}** from **${boss || 'a boss'}**!`)
        .addFields(
          { name: 'Token Used', value: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} Token`, inline: true },
          { name: 'Regenerates In', value: '7 days', inline: true }
        )
        .setFooter({ text: 'You will receive a DM when your token regenerates!' })
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (err) {
      console.error('Failed to send DM to user:', err);
    }

    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.update({ 
      content: `✅ Marked **${item}** (from **${boss}**) as handed out to <@${userId}>!\n` +
              `Their ${itemType} token will regenerate in 7 days.\n` +
              `The item will remain on their wishlist but appear crossed out in summaries.`, 
      components: [] 
    });
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