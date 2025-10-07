const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { createWishlistEmbed } = require('../../features/wishlist/embed');
const { buildWishlistControls } = require('../../features/wishlist/controls');
const { BOSS_DATA } = require('../../data/bossData');
const { scheduleLiveSummaryUpdate } = require('../liveSummary');
const { getUserWishlist } = require('./selects');
const { getUserPendingRegenerations } = require('../tokenRegeneration');
const { checkUserCooldown } = require('../rateLimit');
const { validateAndFixTokenCounts } = require('../tokenRegeneration');
const { isWishlistFrozen } = require('../freezeCheck');

async function handleButtons({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  // Rate limiting for non-admin actions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const allowed = await checkUserCooldown(interaction.user.id, 'button_action', collections);
    if (!allowed) {
      return interaction.reply({ 
        content: '⏳ Please wait a moment before performing another action.', 
        flags: [64] 
      });
    }
  }

  // Check if wishlists are frozen (for non-admin users)
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const frozen = await isWishlistFrozen(interaction.guildId, collections);

    // Block these actions when frozen
    const blockedActions = [
      'open_wishlist', 'add_weapon', 'add_armor', 'add_accessory',
      'remove_item', 'remove_regen_item', 'clear_all', 'finalize_wishlist',
      'finalize_regen_items', 'confirm_clear_all_yes'
    ];

    if (frozen && blockedActions.includes(interaction.customId)) {
      return interaction.reply({
        content: '❄️ **Wishlists are currently frozen!**\n\nAn admin has temporarily disabled wishlist modifications. Please try again later.',
        flags: [64]
      });
    }
  }

  // open wishlist
  if (interaction.customId === 'open_wishlist') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);

    // Validate token counts
    await validateAndFixTokenCounts(interaction.user.id, interaction.guildId, collections);

    const pendingRegens = await getUserPendingRegenerations(
      interaction.user.id,
      interaction.guildId,
      collections
    );
    const embed = createWishlistEmbed(wl, interaction.member, pendingRegens);

    // Check if user has available tokens
    const hasTokens = (
      (1 + (wl.tokenGrants?.weapon || 0)) - (wl.tokensUsed?.weapon || 0) > 0 ||
      (4 + (wl.tokenGrants?.armor || 0)) - (wl.tokensUsed?.armor || 0) > 0 ||
      (1 + (wl.tokenGrants?.accessory || 0)) - (wl.tokensUsed?.accessory || 0) > 0
    );

    // If not finalized, show full controls
    if (!wl.finalized) {
      return interaction.reply({ embeds: [embed], components: buildWishlistControls(wl), flags: [64] });
    }

    // If finalized but has available tokens, show LIMITED controls (only add buttons)
    if (hasTokens) {
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

      return interaction.reply({ 
        embeds: [embed], 
        components: [addRow], 
        flags: [64] 
      });
    }

    // Fully finalized with no tokens - no controls
    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  // add item -> choose tier
  if (['add_weapon','add_armor','add_accessory'].includes(interaction.customId)) {
    const itemType = interaction.customId.replace('add_', '');
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_tier_${itemType}`)
        .setPlaceholder('Choose boss tier')
        .addOptions(
          { label: 'Tier 2 Bosses', description: 'Tier 2 list', value: 'tier2', emoji: '2️⃣' },
          { label: 'Tier 3 Bosses', description: 'Tier 3 list', value: 'tier3', emoji: '3️⃣' }
        )
    );
    return interaction.reply({
      content: `Select which tier of bosses you want to choose ${itemType === 'armor' ? 'armor' : `a ${itemType}`} from:`,
      components: [row],
      flags: [64]
    });
  }

  // remove single item (now we include boss for disambiguation)
  if (interaction.customId === 'remove_item') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) return interaction.reply({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', flags: [64] });

    const mkOption = (type, entry, emoji) => {
      if (typeof entry === 'string') {
        // legacy string: no boss info
        return { value: `${type}::${entry}`, label: entry, emoji };
      }
      return { value: `${type}:${entry.boss}:${entry.name}`, label: `${entry.name} — ${entry.boss}`, emoji };
    };

    const options = [
      ...(wl.weapons || []).map(i => mkOption('weapon', i, '⚔️')),
      ...(wl.armor || []).map(i => mkOption('armor', i, '🛡️')),
      ...(wl.accessories || []).map(i => mkOption('accessory', i, '💍'))
    ];

    if (options.length === 0) return interaction.reply({ content: '❌ Your wishlist is empty!', flags: [64] });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('confirm_remove_item')
        .setPlaceholder('Select item to remove')
        .addOptions(options.slice(0, 25))
    );

    return interaction.reply({ content: 'Select an item to remove:', components: [row], flags: [64] });
  }

  // remove regenerated token items only (for finalized wishlists)
  if (interaction.customId === 'remove_regen_item') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);

    const mkOption = (type, entry, emoji) => {
      return { value: `${type}:${entry.boss}:${entry.name}`, label: `${entry.name} — ${entry.boss}`, emoji };
    };

    // Only show items marked as regenerated tokens
    const regenItems = [
      ...(wl.weapons || []).filter(i => typeof i === 'object' && i.isRegeneratedToken).map(i => mkOption('weapon', i, '⚔️')),
      ...(wl.armor || []).filter(i => typeof i === 'object' && i.isRegeneratedToken).map(i => mkOption('armor', i, '🛡️')),
      ...(wl.accessories || []).filter(i => typeof i === 'object' && i.isRegeneratedToken).map(i => mkOption('accessory', i, '💍'))
    ];

    if (regenItems.length === 0) return interaction.reply({ content: '❌ No regenerated token items to remove!', flags: [64] });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('confirm_remove_regen_item')
        .setPlaceholder('Select regenerated item to remove')
        .addOptions(regenItems.slice(0, 25))
    );

    return interaction.reply({ content: 'Select a regenerated token item to remove:', components: [row], flags: [64] });
  }

  // finalize regenerated items
  if (interaction.customId === 'finalize_regen_items') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);

    // Mark all regenerated items as no longer regenerated (they're now part of the finalized list)
    await wishlists.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { 
        $set: {
          'weapons.$[elem].isRegeneratedToken': false,
          'armor.$[elem].isRegeneratedToken': false,
          'accessories.$[elem].isRegeneratedToken': false
        }
      },
      { 
        arrayFilters: [{ 'elem.isRegeneratedToken': true }]
      }
    );

    const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(updated, interaction.member);

    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.reply({ 
      content: '✅ Your new selections have been finalized!', 
      embeds: [embed], 
      flags: [64] 
    });
  }

  // clear all -> confirmation
  if (interaction.customId === 'clear_all') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) return interaction.reply({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', flags: [64] });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_clear_all_yes').setLabel('Yes, clear everything').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('confirm_clear_all_no').setLabel('No, keep my selections').setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({ content: 'Are you sure you want to clear **all** your selections?', components: [row], flags: [64] });
  }

  if (['confirm_clear_all_yes','confirm_clear_all_no'].includes(interaction.customId)) {
    if (interaction.customId === 'confirm_clear_all_no') return interaction.update({ content: '❎ Cancelled. Your selections are unchanged.', components: [] });

    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) return interaction.update({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', components: [] });

    await wishlists.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $set: { weapons: [], armor: [], accessories: [], tokensUsed: { weapon: 0, armor: 0, accessory: 0 }, timestamps: {} } }
    );

    const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(updated, interaction.member);
    const components = updated.finalized ? [] : buildWishlistControls(updated);

    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.update({ content: '🧹 Cleared all your selections.', embeds: [embed], components });
  }

  // finalize
  if (interaction.customId === 'finalize_wishlist') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if ((wl.weapons?.length || 0) + (wl.armor?.length || 0) + (wl.accessories?.length || 0) === 0) {
      return interaction.reply({ content: '❌ Cannot finalize an empty wishlist!', flags: [64] });
    }

    await wishlists.updateOne({ userId: interaction.user.id, guildId: interaction.guildId }, { $set: { finalized: true } });

    const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(updated, interaction.member);

    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.reply({ content: '✅ Your wishlist has been finalized! Contact an admin if you need to make changes.', embeds: [embed], flags: [64] });
  }

  // summary: mark handed out -> build choices with boss awareness
  if (interaction.customId === 'mark_handed_out') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const all = await collections.wishlists.find({ guildId: interaction.guildId, finalized: true }).toArray();
    if (all.length === 0) return interaction.reply({ content: '❌ No wishlists found.', flags: [64] });

    const itemOptions = [];
    for (const wl of all) {
      const member = await interaction.guild.members.fetch(wl.userId).catch(() => null);
      const displayName = member ? member.displayName : 'Unknown User';
      const packs = [
        ...(wl.weapons || []).map(v => ({ type: 'weapon', v })),
        ...(wl.armor || []).map(v => ({ type: 'armor', v })),
        ...(wl.accessories || []).map(v => ({ type: 'accessory', v }))
      ];
      for (const { v } of packs) {
        const name = typeof v === 'string' ? v : v.name;
        const boss = typeof v === 'string' ? '(unknown boss)' : v.boss;
        // value needs userId + boss + item
        itemOptions.push({
          label: `${name} (${boss}) - ${displayName}`,
          value: `${wl.userId}:${boss}:${name}`,
          description: 'Mark as handed out'
        });
      }
    }

    if (itemOptions.length === 0) return interaction.reply({ content: '❌ No items to mark.', flags: [64] });

    const limited = itemOptions.slice(0, 25);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('confirm_handed_out').setPlaceholder('Select item to mark as handed out').addOptions(limited)
    );
    return interaction.reply({ content: 'Select an item to mark as handed out:', components: [row], flags: [64] });
  }

  // summary: unmark handed out
  if (interaction.customId === 'unmark_handed_out') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const entries = await handedOut.find({ guildId: interaction.guildId }).toArray();
    if (!entries.length) return interaction.reply({ content: 'Nothing is currently marked as handed out.', flags: [64] });

    const options = entries.map(h => ({
      label: `${h.item} (${h.boss || 'unknown'}) - ${h.userId}`,
      value: `${h.userId}:${h.boss || ''}:${h.item}`
    }));

    const limited = options.slice(0, 25);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('confirm_unmark_handed_out').setPlaceholder('Select item(s) to unmark').setMinValues(1).setMaxValues(limited.length).addOptions(limited)
    );
    return interaction.reply({ content: 'Choose item(s) to unmark as handed out:', components: [row], flags: [64] });
  }

  // clear all handed out
  if (interaction.customId === 'clear_handed_out_all') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_clear_handed_out_all_yes').setLabel('Yes, clear all').setStyle(ButtonStyle.Danger).setEmoji('🧹'),
      new ButtonBuilder().setCustomId('confirm_clear_handed_out_all_no').setLabel('No').setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({ content: 'Are you sure you want to clear **all** handed-out marks for this guild?', components: [row], flags: [64] });
  }

  if (['confirm_clear_handed_out_all_yes','confirm_clear_handed_out_all_no'].includes(interaction.customId)) {
    if (interaction.customId === 'confirm_clear_handed_out_all_no') {
      return interaction.update({ content: '❎ Cancelled. No changes made.', components: [] });
    }

    const result = await handedOut.deleteMany({ guildId: interaction.guildId });
    await scheduleLiveSummaryUpdate(interaction, collections);
    return interaction.update({ content: `🧹 Cleared **${result.deletedCount}** handed-out record(s).`, components: [] });
  }
}

module.exports = { handleButtons };