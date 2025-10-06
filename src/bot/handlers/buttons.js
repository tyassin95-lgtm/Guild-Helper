const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const { createWishlistEmbed } = require('../../features/wishlist/embed');
const { buildWishlistControls } = require('../../features/wishlist/controls');
const { BOSS_DATA } = require('../../data/bossData');
const { scheduleLiveSummaryUpdate } = require('../liveSummary');
const { getUserWishlist } = require('./selects'); // reuse the shared getter

async function handleButtons({ interaction, collections }) {
  const { wishlists, handedOut } = collections;

  // open wishlist
  if (interaction.customId === 'open_wishlist') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(wl, interaction.member);
    if (!wl.finalized) return interaction.reply({ embeds: [embed], components: buildWishlistControls(wl), ephemeral: true });
    return interaction.reply({ embeds: [embed], ephemeral: true });
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
      ephemeral: true
    });
  }

  // remove single item (now we include boss for disambiguation)
  if (interaction.customId === 'remove_item') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) return interaction.reply({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', ephemeral: true });

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

    if (options.length === 0) return interaction.reply({ content: '❌ Your wishlist is empty!', ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('confirm_remove_item')
        .setPlaceholder('Select item to remove')
        .addOptions(options.slice(0, 25))
    );

    return interaction.reply({ content: 'Select an item to remove:', components: [row], ephemeral: true });
  }

  // clear all -> confirmation
  if (interaction.customId === 'clear_all') {
    const wl = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    if (wl.finalized) return interaction.reply({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_clear_all_yes').setLabel('Yes, clear everything').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('confirm_clear_all_no').setLabel('No, keep my selections').setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({ content: 'Are you sure you want to clear **all** your selections?', components: [row], ephemeral: true });
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
      return interaction.reply({ content: '❌ Cannot finalize an empty wishlist!', ephemeral: true });
    }

    await wishlists.updateOne({ userId: interaction.user.id, guildId: interaction.guildId }, { $set: { finalized: true } });

    const updated = await getUserWishlist(wishlists, interaction.user.id, interaction.guildId);
    const embed = createWishlistEmbed(updated, interaction.member);

    await scheduleLiveSummaryUpdate(interaction, collections);

    return interaction.reply({ content: '✅ Your wishlist has been finalized! Contact an admin if you need to make changes.', embeds: [embed], ephemeral: true });
  }

  // summary: mark handed out -> build choices with boss awareness
  if (interaction.customId === 'mark_handed_out') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
    }

    const all = await collections.wishlists.find({ guildId: interaction.guildId, finalized: true }).toArray();
    if (all.length === 0) return interaction.reply({ content: '❌ No wishlists found.', ephemeral: true });

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

    if (itemOptions.length === 0) return interaction.reply({ content: '❌ No items to mark.', ephemeral: true });

    const limited = itemOptions.slice(0, 25);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('confirm_handed_out').setPlaceholder('Select item to mark as handed out').addOptions(limited)
    );
    return interaction.reply({ content: 'Select an item to mark as handed out:', components: [row], ephemeral: true });
  }

  // summary: unmark handed out
  if (interaction.customId === 'unmark_handed_out') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
    }

    const entries = await handedOut.find({ guildId: interaction.guildId }).toArray();
    if (!entries.length) return interaction.reply({ content: 'Nothing is currently marked as handed out.', ephemeral: true });

    const options = entries.map(h => ({
      label: `${h.item} (${h.boss || 'unknown'}) - ${h.userId}`,
      value: `${h.userId}:${h.boss || ''}:${h.item}`
    }));

    const limited = options.slice(0, 25);
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('confirm_unmark_handed_out').setPlaceholder('Select item(s) to unmark').setMinValues(1).setMaxValues(limited.length).addOptions(limited)
    );
    return interaction.reply({ content: 'Choose item(s) to unmark as handed out:', components: [row], ephemeral: true });
  }

  // clear all handed out
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
    await scheduleLiveSummaryUpdate(interaction, collections);
    return interaction.update({ content: `🧹 Cleared **${result.deletedCount}** handed-out record(s).`, components: [] });
  }
}

module.exports = { handleButtons };
