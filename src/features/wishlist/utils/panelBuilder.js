// Panel builder for wishlist displays
const { EmbedBuilder } = require('discord.js');
const { getItemById } = require('./items');

// Discord embed limits
const MAX_EMBED_DESCRIPTION_LENGTH = 4096;
const MAX_EMBED_FIELDS = 25;
const MAX_FIELD_VALUE_LENGTH = 1024;

/**
 * Build wishlist panel embeds
 * @param {Object} params
 * @param {Array} params.submissions - All wishlist submissions
 * @param {Guild} params.guild - Discord guild object
 * @param {boolean} params.frozen - Whether wishlists are frozen
 * @param {Object} params.collections - Database collections
 * @returns {Array<EmbedBuilder>} Array of embed builders
 */
async function buildWishlistPanels({ submissions, guild, frozen = false, collections }) {
  const { wishlistGivenItems } = collections;

  // Get all given items for this guild (userId + itemId combinations)
  const givenItemsData = await wishlistGivenItems.find({ guildId: guild.id }).toArray();
  const givenItemsMap = new Map();
  givenItemsData.forEach(item => {
    // Key format: userId:itemId
    const key = `${item.userId}:${item.itemId}`;
    givenItemsMap.set(key, item.givenAt);
  });
  // Group submissions by item
  const itemGroups = {
    archbossWeapons: {},
    archbossArmors: {},
    t3Weapons: {},
    t3Armors: {},
    t3Accessories: {}
  };

  // Process all submissions
  for (const submission of submissions) {
    // Process archboss weapons
    if (submission.archbossWeapon && submission.archbossWeapon.length > 0) {
      for (const itemId of submission.archbossWeapon) {
        if (!itemGroups.archbossWeapons[itemId]) {
          itemGroups.archbossWeapons[itemId] = [];
        }
        itemGroups.archbossWeapons[itemId].push({
          userId: submission.userId,
          submittedAt: submission.submittedAt
        });
      }
    }

    // Process archboss armors
    if (submission.archbossArmor && submission.archbossArmor.length > 0) {
      for (const itemId of submission.archbossArmor) {
        if (!itemGroups.archbossArmors[itemId]) {
          itemGroups.archbossArmors[itemId] = [];
        }
        itemGroups.archbossArmors[itemId].push({
          userId: submission.userId,
          submittedAt: submission.submittedAt
        });
      }
    }

    // Process T3 weapons
    if (submission.t3Weapons && submission.t3Weapons.length > 0) {
      for (const itemId of submission.t3Weapons) {
        if (!itemGroups.t3Weapons[itemId]) {
          itemGroups.t3Weapons[itemId] = [];
        }
        itemGroups.t3Weapons[itemId].push({
          userId: submission.userId,
          submittedAt: submission.submittedAt
        });
      }
    }

    // Process T3 armors
    if (submission.t3Armors && submission.t3Armors.length > 0) {
      for (const itemId of submission.t3Armors) {
        if (!itemGroups.t3Armors[itemId]) {
          itemGroups.t3Armors[itemId] = [];
        }
        itemGroups.t3Armors[itemId].push({
          userId: submission.userId,
          submittedAt: submission.submittedAt
        });
      }
    }

    // Process T3 accessories
    if (submission.t3Accessories && submission.t3Accessories.length > 0) {
      for (const itemId of submission.t3Accessories) {
        if (!itemGroups.t3Accessories[itemId]) {
          itemGroups.t3Accessories[itemId] = [];
        }
        itemGroups.t3Accessories[itemId].push({
          userId: submission.userId,
          submittedAt: submission.submittedAt
        });
      }
    }
  }

  // Build content sections
  const sections = [];

  // Archboss Weapons
  const abWeaponSection = await buildCategorySection({
    title: '⚔️ ARCHBOSS WEAPONS',
    itemGroups: itemGroups.archbossWeapons,
    guild,
    givenItemsMap
  });
  if (abWeaponSection) sections.push(abWeaponSection);

  // Archboss Armors
  const abArmorSection = await buildCategorySection({
    title: '🛡️ ARCHBOSS ARMORS',
    itemGroups: itemGroups.archbossArmors,
    guild,
    givenItemsMap
  });
  if (abArmorSection) sections.push(abArmorSection);

  // T3 Weapons
  const t3WeaponSection = await buildCategorySection({
    title: '⚔️ WEAPONS',
    itemGroups: itemGroups.t3Weapons,
    guild,
    givenItemsMap
  });
  if (t3WeaponSection) sections.push(t3WeaponSection);

  // T3 Armors
  const t3ArmorSection = await buildCategorySection({
    title: '🛡️ ARMOR',
    itemGroups: itemGroups.t3Armors,
    guild,
    givenItemsMap
  });
  if (t3ArmorSection) sections.push(t3ArmorSection);

  // T3 Accessories
  const t3AccessorySection = await buildCategorySection({
    title: '💍 ACCESSORIES',
    itemGroups: itemGroups.t3Accessories,
    guild,
    givenItemsMap
  });
  if (t3AccessorySection) sections.push(t3AccessorySection);

  // If no sections, create a simple "no wishlists" embed
  if (sections.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('📋 Guild Wishlists')
      .setDescription('No wishlists have been submitted yet.')
      .setTimestamp();

    if (frozen) {
      embed.setFooter({ text: '🔒 Wishlists are currently frozen' });
    }

    return [embed];
  }

  // Split sections into multiple embeds if needed
  const embeds = [];
  let currentEmbed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('📋 Guild Wishlists')
    .setTimestamp();

  if (frozen) {
    currentEmbed.setFooter({ text: '🔒 Wishlists are currently frozen' });
  }

  let currentDescription = '';

  for (const section of sections) {
    // Check if adding this section would exceed limits
    if (currentDescription.length + section.length + 2 > MAX_EMBED_DESCRIPTION_LENGTH - 200) {
      // Finalize current embed
      currentEmbed.setDescription(currentDescription || 'Continued from previous panel...');
      embeds.push(currentEmbed);

      // Start new embed
      currentEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📋 Guild Wishlists (Continued)')
        .setTimestamp();

      if (frozen) {
        currentEmbed.setFooter({ text: '🔒 Wishlists are currently frozen' });
      }

      currentDescription = section + '\n\n';
    } else {
      currentDescription += section + '\n\n';
    }
  }

  // Add the last embed
  if (currentDescription) {
    currentEmbed.setDescription(currentDescription);
    embeds.push(currentEmbed);
  }

  // Add panel numbers if multiple embeds
  if (embeds.length > 1) {
    embeds.forEach((embed, index) => {
      const currentTitle = embed.data.title;
      embed.setTitle(`${currentTitle} - Panel ${index + 1}/${embeds.length}`);
    });
  }

  return embeds;
}

/**
 * Build a category section
 * @param {Object} params
 * @param {string} params.title - Category title
 * @param {Object} params.itemGroups - Grouped items
 * @param {Guild} params.guild - Discord guild
 * @param {Map} params.givenItemsMap - Map of userId:itemId combinations that were given
 * @returns {string|null} Section text or null if empty
 */
async function buildCategorySection({ title, itemGroups, guild, givenItemsMap }) {
  const itemIds = Object.keys(itemGroups);
  if (itemIds.length === 0) return null;

  let section = `**${title}**\n`;

  // Sort items by number of users (descending)
  itemIds.sort((a, b) => itemGroups[b].length - itemGroups[a].length);

  for (const itemId of itemIds) {
    const item = getItemById(itemId);
    if (!item) continue;

    const users = itemGroups[itemId];

    section += `\n**${item.name}** (${users.length} ${users.length === 1 ? 'user' : 'users'})\n`;

    // Sort users by submission date (oldest first)
    users.sort((a, b) => a.submittedAt - b.submittedAt);

    // Add user list
    for (const user of users) {
      const member = await guild.members.fetch(user.userId).catch(() => null);
      const displayName = member ? member.displayName : `Unknown User (${user.userId})`;
      const addedDateStr = new Date(user.submittedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // Check if this specific user received this item
      const givenKey = `${user.userId}:${itemId}`;
      const givenData = givenItemsMap.get(givenKey);

      if (givenData) {
        // User received this item - show with strikethrough and date
        const givenDateStr = new Date(givenData).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        section += `• ~~${displayName}~~ ✅ *Received: ${givenDateStr}*\n`;
      } else {
        // User hasn't received it yet
        section += `• ${displayName} - *Added ${addedDateStr}*\n`;
      }
    }
  }

  return section;
}

/**
 * Build a user's wishlist display embed
 * @param {Object} params
 * @param {Object} params.wishlist - User's wishlist
 * @param {User} params.user - Discord user
 * @param {boolean} params.frozen - Whether wishlists are frozen
 * @returns {EmbedBuilder}
 */
function buildUserWishlistEmbed({ wishlist, user, frozen = false }) {
  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('🎯 My Wishlist Configuration')
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setTimestamp();

  if (frozen) {
    embed.setFooter({ text: '🔒 Wishlists are currently frozen - Cannot submit changes' });
  }

  let description = '**📦 CURRENT SELECTIONS:**\n\n';

  // Archboss Weapon
  const abWeaponCount = (wishlist.archbossWeapon && wishlist.archbossWeapon.length) || 0;
  description += `⚔️ **Archboss Weapon (${abWeaponCount}/1)**\n`;
  if (wishlist.archbossWeapon && wishlist.archbossWeapon.length > 0) {
    for (const itemId of wishlist.archbossWeapon) {
      const item = getItemById(itemId);
      if (item) {
        description += `✅ ${item.name}\n`;
      }
    }
  } else {
    description += '❌ None selected\n';
  }

  description += '\n';

  // Archboss Armor
  const abArmorCount = (wishlist.archbossArmor && wishlist.archbossArmor.length) || 0;
  description += `🛡️ **Archboss Armor (${abArmorCount}/1)**\n`;
  if (wishlist.archbossArmor && wishlist.archbossArmor.length > 0) {
    for (const itemId of wishlist.archbossArmor) {
      const item = getItemById(itemId);
      if (item) {
        description += `✅ ${item.name}\n`;
      }
    }
  } else {
    description += '❌ None selected\n';
  }

  description += '\n';

  // T3 Weapons
  const t3WeaponCount = (wishlist.t3Weapons && wishlist.t3Weapons.length) || 0;
  description += `⚔️ **Weapons (${t3WeaponCount}/1)**\n`;
  if (wishlist.t3Weapons && wishlist.t3Weapons.length > 0) {
    for (const itemId of wishlist.t3Weapons) {
      const item = getItemById(itemId);
      if (item) {
        description += `✅ ${item.name}\n`;
      }
    }
  } else {
    description += '❌ None selected\n';
  }

  description += '\n';

  // T3 Armors
  const t3ArmorCount = (wishlist.t3Armors && wishlist.t3Armors.length) || 0;
  description += `🛡️ **Armor (${t3ArmorCount}/4)**\n`;
  if (wishlist.t3Armors && wishlist.t3Armors.length > 0) {
    for (const itemId of wishlist.t3Armors) {
      const item = getItemById(itemId);
      if (item) {
        description += `✅ ${item.name}\n`;
      }
    }
  } else {
    description += '❌ None selected\n';
  }

  description += '\n';

  // T3 Accessories
  const t3AccessoryCount = (wishlist.t3Accessories && wishlist.t3Accessories.length) || 0;
  description += `💍 **Accessories (${t3AccessoryCount}/2)**\n`;
  if (wishlist.t3Accessories && wishlist.t3Accessories.length > 0) {
    for (const itemId of wishlist.t3Accessories) {
      const item = getItemById(itemId);
      if (item) {
        description += `✅ ${item.name}\n`;
      }
    }
  } else {
    description += '❌ None selected\n';
  }

  embed.setDescription(description);

  return embed;
}

module.exports = {
  buildWishlistPanels,
  buildUserWishlistEmbed
};