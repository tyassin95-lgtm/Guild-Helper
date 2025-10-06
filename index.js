require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { MongoClient } = require('mongodb');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let db;
let wishlists;
let panels;
let handedOut;

// Banner image to make the main panel feel larger (REPLACE with a real wide banner URL)
const PANEL_BANNER_URL = 'https://i.imgur.com/yourBanner.png';

// Throne and Liberty boss data with image URLs (REPLACE placeholders)
const BOSS_DATA = {
  tier2: {
    'Kowazan': {
      weapons: ['Kowazan Greatsword', 'Kowazan Staff', 'Kowazan Bow'],
      armor: ['Kowazan Helmet', 'Kowazan Chest', 'Kowazan Gloves', 'Kowazan Pants', 'Kowazan Boots'],
      accessories: ['Kowazan Ring', 'Kowazan Necklace'],
      image: 'https://i.imgur.com/placeholder1.png'
    },
    'Ahzreil': {
      weapons: ['Ahzreil Dagger', 'Ahzreil Crossbow', 'Ahzreil Wand'],
      armor: ['Ahzreil Helmet', 'Ahzreil Chest', 'Ahzreil Gloves', 'Ahzreil Pants', 'Ahzreil Boots'],
      accessories: ['Ahzreil Ring', 'Ahzreil Bracelet'],
      image: 'https://i.imgur.com/placeholder2.png'
    },
    'Talus': {
      weapons: ['Talus Sword & Shield', 'Talus Longbow', 'Talus Greatsword'],
      armor: ['Talus Helmet', 'Talus Chest', 'Talus Gloves', 'Talus Pants', 'Talus Boots'],
      accessories: ['Talus Necklace', 'Talus Belt'],
      image: 'https://i.imgur.com/placeholder3.png'
    }
  },
  tier3: {
    'Cornelius': {
      weapons: ['Cornelius Greatsword', 'Cornelius Staff', 'Cornelius Bow'],
      armor: ['Cornelius Helmet', 'Cornelius Chest', 'Cornelius Gloves', 'Cornelius Pants', 'Cornelius Boots'],
      accessories: ['Cornelius Ring', 'Cornelius Necklace'],
      image: 'https://i.imgur.com/placeholder4.png'
    },
    'Aelon': {
      weapons: ['Aelon Dagger', 'Aelon Crossbow', 'Aelon Wand'],
      armor: ['Aelon Helmet', 'Aelon Chest', 'Aelon Gloves', 'Aelon Pants', 'Aelon Boots'],
      accessories: ['Aelon Ring', 'Aelon Bracelet'],
      image: 'https://i.imgur.com/placeholder5.png'
    },
    'Chernobog': {
      weapons: ['Chernobog Sword & Shield', 'Chernobog Longbow', 'Chernobog Greatsword'],
      armor: ['Chernobog Helmet', 'Chernobog Chest', 'Chernobog Gloves', 'Chernobog Pants', 'Chernobog Boots'],
      accessories: ['Chernobog Necklace', 'Chernobog Belt'],
      image: 'https://i.imgur.com/placeholder6.png'
    }
  }
};

// Connect to MongoDB
MongoClient.connect(process.env.MONGODB_URI)
  .then(mongoClient => {
    console.log('Connected to MongoDB');
    db = mongoClient.db('guildhelper');
    wishlists = db.collection('wishlists');
    panels = db.collection('panels');
    handedOut = db.collection('handedout');

    // Create indexes
    wishlists.createIndex({ userId: 1, guildId: 1 }, { unique: true });
    panels.createIndex({ guildId: 1, channelId: 1 });
    handedOut.createIndex({ guildId: 1, item: 1, userId: 1 }, { unique: true });
  })
  .catch(err => console.error('MongoDB connection error:', err));

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Helper: get or create a wishlist
async function getUserWishlist(userId, guildId) {
  let wishlist = await wishlists.findOne({ userId, guildId });
  if (!wishlist) {
    wishlist = {
      userId,
      guildId,
      weapons: [],
      armor: [],
      accessories: [],
      tokensUsed: { weapon: 0, armor: 0, accessory: 0 },
      tokenGrants: { weapon: 0, armor: 0, accessory: 0 },
      timestamps: {},
      finalized: false
    };
    await wishlists.insertOne(wishlist);
  }
  return wishlist;
}

// Helper: embed
function createWishlistEmbed(wishlist, user) {
  const weaponTokens = (1 + (wishlist.tokenGrants?.weapon || 0)) - wishlist.tokensUsed.weapon;
  const armorTokens = (4 + (wishlist.tokenGrants?.armor || 0)) - wishlist.tokensUsed.armor;
  const accessoryTokens = (1 + (wishlist.tokenGrants?.accessory || 0)) - wishlist.tokensUsed.accessory;

  const formatItems = (items, timestamps) => {
    if (!items || items.length === 0) return 'None selected';
    return items.map(item => {
      const timestamp = timestamps?.[item];
      const dateStr = timestamp ? ` (${new Date(timestamp).toLocaleDateString()})` : '';
      return `• ${item}${dateStr}`;
    }).join('\n');
  };

  return new EmbedBuilder()
    .setColor(wishlist.finalized ? '#FFD700' : '#3498db')
    .setTitle(`${user.displayName}'s Wishlist`)
    .setDescription(wishlist.finalized ? '✅ **FINALIZED** - Contact an admin to make changes' : 'Click the buttons below to manage your wishlist')
    .addFields(
      {
        name: `⚔️ Weapons (${weaponTokens} token${weaponTokens !== 1 ? 's' : ''} remaining)`,
        value: formatItems(wishlist.weapons, wishlist.timestamps),
        inline: false
      },
      {
        name: `🛡️ Armor (${armorTokens} token${armorTokens !== 1 ? 's' : ''} remaining)`,
        value: formatItems(wishlist.armor, wishlist.timestamps),
        inline: false
      },
      {
        name: `💍 Accessories (${accessoryTokens} token${accessoryTokens !== 1 ? 's' : ''} remaining)`,
        value: formatItems(wishlist.accessories, wishlist.timestamps),
        inline: false
      }
    )
    .setFooter({ text: 'Throne and Liberty Guild Helper' })
    .setTimestamp();
}

// Helper: build control rows so buttons always show
function buildWishlistControls(wishlist) {
  const weaponTokens = (1 + (wishlist.tokenGrants?.weapon || 0)) - wishlist.tokensUsed.weapon;
  const armorTokens = (4 + (wishlist.tokenGrants?.armor || 0)) - wishlist.tokensUsed.armor;
  const accessoryTokens = (1 + (wishlist.tokenGrants?.accessory || 0)) - wishlist.tokensUsed.accessory;

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

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('remove_item')
      .setLabel('Remove Item')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️'),
    new ButtonBuilder()
      .setCustomId('clear_all')
      .setLabel('Clear All')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('♻️'),
    new ButtonBuilder()
      .setCustomId('finalize_wishlist')
      .setLabel('Finalize Wishlist')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  );

  return [row1, row2];
}

// Interactions
client.on('interactionCreate', async interaction => {
  try {
    // /createpanel
    if (interaction.isChatInputCommand() && interaction.commandName === 'createpanel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions to create panels.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🎯 Guild Wishlist System')
        .setDescription(
          'Welcome to the Throne and Liberty Guild Wishlist!\n\n' +
          '**How it works:**\n' +
          '• You have **1 Weapon Token**, **4 Armor Tokens**, and **1 Accessory Token**\n' +
          '• Use these tokens to add items from Tier 2 or Tier 3 bosses to your wishlist\n' +
          '• You can change your selections until you finalize\n' +
          '• Once finalized, only admins can make changes\n\n' +
          'Click **"View/Edit My Wishlist"** below to get started!'
        )
        .setFooter({ text: 'Make your choices wisely!' })
        .setTimestamp()
        .setImage(PANEL_BANNER_URL);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('open_wishlist')
          .setLabel('View/Edit My Wishlist')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📋')
      );

      const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      await panels.insertOne({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageId: message.id
      });

      return;
    }

    // /mywishlist
    if (interaction.isChatInputCommand() && interaction.commandName === 'mywishlist') {
      const wl = await getUserWishlist(interaction.user.id, interaction.guildId);
      const embed = createWishlistEmbed(wl, interaction.member);
      if (!wl.finalized) {
        return interaction.reply({ embeds: [embed], components: buildWishlistControls(wl), ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /summary (admins)
    if (interaction.isChatInputCommand() && interaction.commandName === 'summary') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions to view summaries.', ephemeral: true });
      }

      await interaction.deferReply();

      const allWishlists = await wishlists.find({
        guildId: interaction.guildId,
        finalized: true
      }).toArray();

      if (allWishlists.length === 0) {
        return interaction.editReply('No finalized wishlists found.');
      }

      const handedOutItems = await handedOut.find({ guildId: interaction.guildId }).toArray();
      const handedOutSet = new Set(handedOutItems.map(h => `${h.userId}:${h.item}`));

      // Organize by boss
      const bossSummary = {};
      for (const tier of ['tier2', 'tier3']) {
        for (const boss of Object.keys(BOSS_DATA[tier])) {
          bossSummary[boss] = {};
        }
      }

      for (const wl of allWishlists) {
        const member = await interaction.guild.members.fetch(wl.userId).catch(() => null);
        const displayName = member ? member.displayName : 'Unknown User';
        const allItems = [...wl.weapons, ...wl.armor, ...wl.accessories];

        for (const item of allItems) {
          let itemBoss = null;
          for (const tier of ['tier2', 'tier3']) {
            for (const boss of Object.keys(BOSS_DATA[tier])) {
              const b = BOSS_DATA[tier][boss];
              if ([...b.weapons, ...b.armor, ...b.accessories].includes(item)) {
                itemBoss = boss;
                break;
              }
            }
            if (itemBoss) break;
          }

          if (itemBoss) {
            if (!bossSummary[itemBoss][item]) bossSummary[itemBoss][item] = [];
            const timestamp = wl.timestamps?.[item];
            const isHandedOut = handedOutSet.has(`${wl.userId}:${item}`);
            bossSummary[itemBoss][item].push({
              name: displayName,
              userId: wl.userId,
              timestamp,
              handedOut: isHandedOut
            });
          }
        }
      }

      const embeds = [];
      for (const boss of Object.keys(bossSummary)) {
        const items = bossSummary[boss];
        if (Object.keys(items).length === 0) continue;

        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle(`💀 ${boss.toUpperCase()}`)
          .setTimestamp();

        const bossImg = (BOSS_DATA.tier2[boss]?.image) || (BOSS_DATA.tier3[boss]?.image);
        if (bossImg) embed.setImage(bossImg);

        for (const [item, users] of Object.entries(items)) {
          const userList = users.map(u => {
            const dateStr = u.timestamp ? ` - ${new Date(u.timestamp).toLocaleDateString()}` : '';
            const crossedOut = u.handedOut ? '~~' : '';
            return `${crossedOut}• ${u.name}${dateStr}${crossedOut}`;
          }).join('\n');

          embed.addFields({
            name: `${item} (${users.length})`,
            value: userList.length > 1024 ? userList.substring(0, 1021) + '...' : userList,
            inline: false
          });
        }

        embeds.push(embed);
      }

      if (embeds.length === 0) {
        return interaction.editReply('No items wishlisted yet.');
      }

      // Controls for handout management
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('mark_handed_out')
          .setLabel('Mark Item as Handed Out')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId('unmark_handed_out')
          .setLabel('Unmark Handed Out')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️'),
        new ButtonBuilder()
          .setCustomId('clear_handed_out_all')
          .setLabel('Clear All Handed Out')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🧹')
      );

      return interaction.editReply({ embeds, components: [row] });
    }

    // Summary: mark handed out
    if (interaction.isButton() && interaction.customId === 'mark_handed_out') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
      }

      const allWishlists = await wishlists.find({
        guildId: interaction.guildId,
        finalized: true
      }).toArray();

      if (allWishlists.length === 0) {
        return interaction.reply({ content: '❌ No wishlists found.', ephemeral: true });
      }

      const itemOptions = [];
      for (const wl of allWishlists) {
        const member = await interaction.guild.members.fetch(wl.userId).catch(() => null);
        const displayName = member ? member.displayName : 'Unknown User';
        const allItems = [...wl.weapons, ...wl.armor, ...wl.accessories];
        for (const item of allItems) {
          itemOptions.push({
            label: `${item} - ${displayName}`,
            value: `${wl.userId}:${item}`,
            description: 'Mark as handed out'
          });
        }
      }

      if (itemOptions.length === 0) {
        return interaction.reply({ content: '❌ No items to mark.', ephemeral: true });
      }

      const limitedOptions = itemOptions.slice(0, 25);
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('confirm_handed_out')
          .setPlaceholder('Select item to mark as handed out')
          .addOptions(limitedOptions)
      );

      return interaction.reply({ content: 'Select an item to mark as handed out:', components: [row], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'confirm_handed_out') {
      const [userId, ...itemParts] = interaction.values[0].split(':');
      const item = itemParts.join(':');

      await handedOut.updateOne(
        { guildId: interaction.guildId, userId, item },
        { $set: { guildId: interaction.guildId, userId, item, timestamp: new Date() } },
        { upsert: true }
      );

      return interaction.update({ content: `✅ Marked **${item}** as handed out!`, components: [] });
    }

    // NEW: Unmark handed out (pick one or multiple)
    if (interaction.isButton() && interaction.customId === 'unmark_handed_out') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
      }

      const entries = await handedOut.find({ guildId: interaction.guildId }).toArray();
      if (entries.length === 0) {
        return interaction.reply({ content: 'Nothing is currently marked as handed out.', ephemeral: true });
      }

      // Join with display names
      const options = [];
      for (const h of entries) {
        const member = await interaction.guild.members.fetch(h.userId).catch(() => null);
        const displayName = member ? member.displayName : 'Unknown User';
        options.push({
          label: `${h.item} - ${displayName}`,
          value: `${h.userId}:${h.item}`
        });
      }

      const limited = options.slice(0, 25);
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('confirm_unmark_handed_out')
          .setPlaceholder('Select item(s) to unmark')
          .setMinValues(1)
          .setMaxValues(limited.length)
          .addOptions(limited)
      );

      return interaction.reply({ content: 'Choose item(s) to unmark as handed out:', components: [row], ephemeral: true });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'confirm_unmark_handed_out') {
      const selections = interaction.values; // array of userId:item
      let removed = 0;
      for (const sel of selections) {
        const [userId, ...itemParts] = sel.split(':');
        const item = itemParts.join(':');
        const res = await handedOut.deleteOne({ guildId: interaction.guildId, userId, item });
        if (res.deletedCount > 0) removed++;
      }
      return interaction.update({ content: `↩️ Unmarked ${removed} item(s) as handed out.`, components: [] });
    }

    // NEW: Clear all handed out (with confirm)
    if (interaction.isButton() && interaction.customId === 'clear_handed_out_all') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
      }

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_clear_handed_out_all_yes').setLabel('Yes, clear all').setStyle(ButtonStyle.Danger).setEmoji('🧹'),
        new ButtonBuilder().setCustomId('confirm_clear_handed_out_all_no').setLabel('No').setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({ content: 'Are you sure you want to clear **all** handed-out marks for this guild?', components: [confirmRow], ephemeral: true });
    }

    if (interaction.isButton() && (interaction.customId === 'confirm_clear_handed_out_all_yes' || interaction.customId === 'confirm_clear_handed_out_all_no')) {
      if (interaction.customId === 'confirm_clear_handed_out_all_no') {
        return interaction.update({ content: '❎ Cancelled. No changes made.', components: [] });
      }

      const result = await handedOut.deleteMany({ guildId: interaction.guildId });
      return interaction.update({ content: `🧹 Cleared **${result.deletedCount}** handed-out record(s).`, components: [] });
    }

    // /granttokens
    if (interaction.isChatInputCommand() && interaction.commandName === 'granttokens') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
      }
      const targetUser = interaction.options.getUser('user');
      const tokenType = interaction.options.getString('type');
      const amount = interaction.options.getInteger('amount');

      await wishlists.updateOne(
        { userId: targetUser.id, guildId: interaction.guildId },
        { $inc: { [`tokenGrants.${tokenType}`]: amount } },
        { upsert: true }
      );

      return interaction.reply({ content: `✅ Granted ${amount} ${tokenType} token(s) to ${targetUser.tag}!`, ephemeral: true });
    }

    // /removetokens
    if (interaction.isChatInputCommand() && interaction.commandName === 'removetokens') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions.', ephemeral: true });
      }
      const targetUser = interaction.options.getUser('user');
      const tokenType = interaction.options.getString('type');
      const amount = interaction.options.getInteger('amount');

      const wl = await getUserWishlist(targetUser.id, interaction.guildId);
      const current = wl.tokenGrants?.[tokenType] || 0;
      const newGrant = Math.max(0, current - amount);

      await wishlists.updateOne(
        { userId: targetUser.id, guildId: interaction.guildId },
        { $set: { [`tokenGrants.${tokenType}`]: newGrant } },
        { upsert: true }
      );

      return interaction.reply({ content: `✅ Removed ${amount} ${tokenType} token(s) from ${targetUser.tag}. New ${tokenType} grants: ${newGrant}.`, ephemeral: true });
    }

    // /resetuser
    if (interaction.isChatInputCommand() && interaction.commandName === 'resetuser') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ You need administrator permissions to reset wishlists.', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('user');
      const result = await wishlists.updateOne(
        { userId: targetUser.id, guildId: interaction.guildId },
        { $set: { finalized: false } }
      );

      if (result.matchedCount === 0) {
        return interaction.reply({ content: '❌ User has no wishlist.', ephemeral: true });
      }

      return interaction.reply({ content: `✅ ${targetUser.tag}'s wishlist has been unlocked for editing.`, ephemeral: true });
    }

    // Open wishlist button
    if (interaction.isButton() && interaction.customId === 'open_wishlist') {
      const wl = await getUserWishlist(interaction.user.id, interaction.guildId);
      const embed = createWishlistEmbed(wl, interaction.member);
      if (!wl.finalized) {
        return interaction.reply({ embeds: [embed], components: buildWishlistControls(wl), ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add item buttons
    if (interaction.isButton() && (interaction.customId === 'add_weapon' || interaction.customId === 'add_armor' || interaction.customId === 'add_accessory')) {
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

    // Tier selection
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_tier_')) {
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

    // Boss selection
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_boss_')) {
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
        .setImage(bossImage); // big boss image

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

    // Item selection
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_item_')) {
      const parts = interaction.customId.split('_');
      const itemType = parts[2];
      const selectedItems = interaction.values;

      const wl = await getUserWishlist(interaction.user.id, interaction.guildId);
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

      // Add items with timestamps
      const timestamp = new Date();
      const timestampUpdates = {};
      for (const item of selectedItems) {
        timestampUpdates[`timestamps.${item}`] = timestamp;
      }

      await wishlists.updateOne(
        { userId: interaction.user.id, guildId: interaction.guildId },
        {
          $push: { [itemKey]: { $each: selectedItems } },
          $inc: { [`tokensUsed.${tokenKey}`]: tokensNeeded },
          $set: timestampUpdates
        }
      );

      const updated = await getUserWishlist(interaction.user.id, interaction.guildId);
      const embed = createWishlistEmbed(updated, interaction.member);
      const itemsList = selectedItems.map(i => `• ${i}`).join('\n');
      const components = updated.finalized ? [] : buildWishlistControls(updated);

      return interaction.update({
        content: `✅ Added ${tokensNeeded} item(s) to your wishlist:\n${itemsList}`,
        embeds: [embed],
        components
      });
    }

    // Remove single item
    if (interaction.isButton() && interaction.customId === 'remove_item') {
      const wl = await getUserWishlist(interaction.user.id, interaction.guildId);
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

    if (interaction.isStringSelectMenu() && interaction.customId === 'confirm_remove_item') {
      const [itemType, ...itemParts] = interaction.values[0].split(':');
      const itemName = itemParts.join(':');
      const itemKey = itemType === 'weapon' ? 'weapons' : itemType === 'armor' ? 'armor' : 'accessories';
      const tokenKey = itemType === 'weapon' ? 'weapon' : itemType === 'armor' ? 'armor' : 'accessory';

      await wishlists.updateOne(
        { userId: interaction.user.id, guildId: interaction.guildId },
        {
          $pull: { [itemKey]: itemName },
          $inc: { [`tokensUsed.${tokenKey}`]: -1 },
          $unset: { [`timestamps.${itemName}`]: '' }
        }
      );

      const updated = await getUserWishlist(interaction.user.id, interaction.guildId);
      const embed = createWishlistEmbed(updated, interaction.member);
      const components = updated.finalized ? [] : buildWishlistControls(updated);

      return interaction.update({ content: `✅ Removed **${itemName}** from your wishlist!`, embeds: [embed], components });
    }

    // Clear all (confirm)
    if (interaction.isButton() && interaction.customId === 'clear_all') {
      const wl = await getUserWishlist(interaction.user.id, interaction.guildId);
      if (wl.finalized) {
        return interaction.reply({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', ephemeral: true });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_clear_all_yes').setLabel('Yes, clear everything').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('confirm_clear_all_no').setLabel('No, keep my selections').setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({ content: 'Are you sure you want to clear **all** your selections?', components: [row], ephemeral: true });
    }

    if (interaction.isButton() && (interaction.customId === 'confirm_clear_all_yes' || interaction.customId === 'confirm_clear_all_no')) {
      if (interaction.customId === 'confirm_clear_all_no') {
        return interaction.update({ content: '❎ Cancelled. Your selections are unchanged.', components: [] });
      }

      const wl = await getUserWishlist(interaction.user.id, interaction.guildId);
      if (wl.finalized) {
        return interaction.update({ content: '❌ Your wishlist is finalized. Contact an admin to make changes.', components: [] });
      }

      await wishlists.updateOne(
        { userId: interaction.user.id, guildId: interaction.guildId },
        {
          $set: {
            weapons: [],
            armor: [],
            accessories: [],
            tokensUsed: { weapon: 0, armor: 0, accessory: 0 },
            timestamps: {}
          }
        }
      );

      const updated = await getUserWishlist(interaction.user.id, interaction.guildId);
      const embed = createWishlistEmbed(updated, interaction.member);
      const components = updated.finalized ? [] : buildWishlistControls(updated);

      return interaction.update({ content: '🧹 Cleared all your selections.', embeds: [embed], components });
    }

    // Finalize
    if (interaction.isButton() && interaction.customId === 'finalize_wishlist') {
      const wl = await getUserWishlist(interaction.user.id, interaction.guildId);

      if (wl.weapons.length === 0 && wl.armor.length === 0 && wl.accessories.length === 0) {
        return interaction.reply({ content: '❌ Cannot finalize an empty wishlist!', ephemeral: true });
      }

      await wishlists.updateOne(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { $set: { finalized: true } }
      );

      const updated = await getUserWishlist(interaction.user.id, interaction.guildId);
      const embed = createWishlistEmbed(updated, interaction.member);

      return interaction.reply({
        content: '✅ Your wishlist has been finalized! Contact an admin if you need to make changes.',
        embeds: [embed],
        ephemeral: true
      });
    }

  } catch (error) {
    console.error('Error handling interaction:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: '❌ An error occurred!', ephemeral: true }).catch(() => {});
    }
  }
});

// Register slash commands
client.on('ready', async () => {
  const commands = [
    { name: 'createpanel', description: 'Create a wishlist panel in this channel.' },
    { name: 'mywishlist', description: 'View your wishlist (ephemeral).' },
    { name: 'summary', description: 'Admins: View a boss-by-boss summary of finalized wishlists.' },
    {
      name: 'granttokens',
      description: 'Admins: Grant extra tokens to a user.',
      options: [
        { type: 6, name: 'user', description: 'User to grant tokens to', required: true }, // USER
        {
          type: 3, name: 'type', description: 'Type of token to grant', required: true, // STRING
          choices: [
            { name: 'weapon', value: 'weapon' },
            { name: 'armor', value: 'armor' },
            { name: 'accessory', value: 'accessory' }
          ]
        },
        { type: 4, name: 'amount', description: 'Number of tokens to grant', required: true } // INTEGER
      ]
    },
    {
      name: 'removetokens',
      description: 'Admins: Remove token grants from a user.',
      options: [
        { type: 6, name: 'user', description: 'User to remove tokens from', required: true }, // USER
        {
          type: 3, name: 'type', description: 'Type of token to remove', required: true, // STRING
          choices: [
            { name: 'weapon', value: 'weapon' },
            { name: 'armor', value: 'armor' },
            { name: 'accessory', value: 'accessory' }
          ]
        },
        { type: 4, name: 'amount', description: 'Number of tokens to remove', required: true } // INTEGER
      ]
    },
    {
      name: 'resetuser',
      description: 'Admins: Unlock a user’s wishlist for editing.',
      options: [
        { type: 6, name: 'user', description: 'User to unlock', required: true } // USER
      ]
    }
  ];

  try {
    await client.application.commands.set(commands);
    console.log('Slash commands registered.');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
});

console.log('Loaded token:', process.env.DISCORD_TOKEN ? '✅ Found' : '❌ Missing');
client.login(process.env.DISCORD_TOKEN);