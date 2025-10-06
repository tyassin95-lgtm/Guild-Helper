const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { createWishlistEmbed } = require('../../features/wishlist/embed');
const { buildWishlistControls } = require('../../features/wishlist/controls');
const { BOSS_DATA } = require('../../data/bossData');
const { handleSummary } = require('./commands/summary');
const { getUserWishlist } = require('./commands/mywishlist');

async function handleButtons({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  // Open wishlist
  if (interaction.customId === 'open_wishlist') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(wl, interaction.member);
    if (!wl.finalized) {
      return interaction.reply({ embeds: [embed], components: buildWishlistControls(wl), ephemeral: true });
    }
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Add buttons -> next step is tier select (handled in selects.js)
  if (['add_weapon', 'add_armor', 'add_accessory'].includes(interaction.customId)) {
    const itemType = interaction.customId.replace('add_', '');
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_tier_${itemType}`)
        .setPlaceholder('Choose boss tier')
        .addOptions(
          { label: 'Tier 2 Bosses', description: 'Kowazan, Ahzreil, Talus', value: 'tier2', emoji: '2️⃣' },
          { label: 'Tier 3 Bosses', description: 'Cornelius, Aelon, Chernobog', value: 'tier3', emoji: '3️⃣' }
        )
    );

    return interaction.reply({
      content: `Select which tier of bosses you want to choose ${itemType === 'armor' ? 'armor' : `a ${itemType}`} from:`,
      components: [row],
      ephemeral: true
    });
  }

  // Remove item
  if (interaction.customId === 'remove_item') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) {
      return interaction.reply({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', ephemeral: true });
    }

    const allItems = [
      ...wl.weapons.map(i => ({ value: `weapon:${i}`, label: i, emoji: '⚔️' })),
      ...wl.armor.map(i => ({ value: `armor:${i}`, label: i, emoji: '🛡️' })),
      ...wl.accessories.map(i => ({ value: `accessory:${i}`, label: i, emoji: '💍' }))
    ];

    if (allItems.length === 0) {
      return interaction.reply({ content: '❌ Your wishlist is empty!', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('confirm_remove_item')
        .setPlaceholder('Select item to remove')
        .addOptions(allItems.slice(0, 25))
    );

    return interaction.reply({ content: 'Select an item to remove:', components: [row], ephemeral: true });
  }

  // Clear all -> confirmation
  if (interaction.customId === 'clear_all') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) {
      return interaction.reply({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_clear_all_yes').setLabel('Yes, clear everything').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('confirm_clear_all_no').setLabel('No, keep my selections').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ content: 'Are you sure you want to clear **all** your selections?', components: [row], ephemeral: true });
  }

  if (['confirm_clear_all_yes','confirm_clear_all_no'].includes(interaction.customId)) {
    if (interaction.customId === 'confirm_clear_all_no') {
      return interaction.update({ content: '❎ Cancelled. Your selections are unchanged.', components: [] });
    }

    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) {
      return interaction.update({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', components: [] });
    }

    await wishlists.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $set: { weapons: [], armor: [], accessories: [], tokensUsed: { weapon: 0, armor: 0, accessory: 0 }, timestamps: {} } }
    );

    const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(updated, interaction.member);
    const components = updated.finalized ? [] : buildWishlistControls(updated);

    return interaction.update({ content: '🧹 Cleared all your selections.', embeds: [embed], components });
  }

  // Finalize
  if (interaction.customId === 'finalize_wishlist') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.weapons.length === 0 && wl.armor.length === 0 && wl.accessories.length === 0) {
      return interaction.reply({ content: '❌ Cannot finalize an empty wishlist!', ephemeral: true });
    }

    await wishlists.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $set: { finalized: true } }
    );

    const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(updated, interaction.member);
    return interaction.reply({ content: '✅ Your wishlist has been finalized! Contact an admin if you need to make changes.', embeds: [embed], ephemeral: true });
  }

  // Summary panel sub-buttons (hand-outs)
  if (interaction.customId === 'mark_handed_out') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
    }

    // Collect from all finalized wishlists
    const allWishlists = await collections.wishlists.find({ guildId: interaction.guildId, finalized: true }).toArray();
    if (allWishlists.length === 0) {
      return interaction.reply({ content: '❌ No wishlists found.', ephemeral: true });
    }

    const itemOptions = [];
    for (const wl of allWishlists) {
      const member = await interaction.guild.members.fetch(wl.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown User';
      const allItems = [...wl.weapons, ...wl.armor, ...wl.accessories];
      for (const item of allItems) {
        itemOptions.push({ label: `${item} - ${displayName}`, value: `${wl.userId}:${item}`, description: 'Mark as handed out' });
      }
    }

    if (itemOptions.length === 0) {
      return interaction.reply({ content: '❌ No items to mark.', ephemeral: true });
    }

    const limited = itemOptions.slice(0, 25);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('confirm_handed_out').setPlaceholder('Select item to mark as handed out').addOptions(limited)
    );

    return interaction.reply({ content: 'Select an item to mark as handed out:', components: [row], ephemeral: true });
  }

  if (interaction.customId === 'unmark_handed_out') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
    }

    const entries = await handedOut.find({ guildId: interaction.guildId }).toArray();
    if (entries.length === 0) return interaction.reply({ content: 'Nothing is currently marked as handed out.', ephemeral: true });

    const options = [];
    for (const h of entries) {
      const member = await interaction.guild.members.fetch(h.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown User';
      options.push({ label: `${h.item} - ${displayName}`, value: `${h.userId}:${h.item}` });
    }

    const limited = options.slice(0, 25);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('confirm_unmark_handed_out').setPlaceholder('Select item(s) to unmark').setMinValues(1).setMaxValues(limited.length).addOptions(limited)
    );

    return interaction.reply({ content: 'Choose item(s) to unmark as handed out:', components: [row], ephemeral: true });
  }

  if (interaction.customId === 'clear_handed_out_all') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_clear_handed_out_all_yes').setLabel('Yes, clear all').setStyle(ButtonStyle.Danger).setEmoji('🧹'),
      new ButtonBuilder().setCustomId('confirm_clear_handed_out_all_no').setLabel('No').setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ content: 'Are you sure you want to clear **all** handed-out marks for this guild?', components: [row], ephemeral: true });
  }

  if (['confirm_clear_handed_out_all_yes','confirm_clear_handed_out_all_no'].includes(interaction.customId)) {
    if (interaction.customId === 'confirm_clear_handed_out_all_no') {
      return interaction.update({ content: '❎ Cancelled. No changes made.', components: [] });
    }
    const result = await handedOut.deleteMany({ guildId: interaction.guildId });
    return interaction.update({ content: `🧹 Cleared **${result.deletedCount}** handed-out record(s).`, components: [] });
  }
}

module.exports = { handleButtons };
