const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { BOSS_DATA } = require('../../data/bossData');

// Store active countdown intervals to prevent memory leaks
const activeCountdowns = new Map(); // guildId -> interval

/**
 * Create and store a new raid session
 */
async function createRaidSession(guildId, channelId, minutesUntilRaid, selectedBosses, collections) {
  const { raidSessions } = collections;

  const raidStartTime = new Date(Date.now() + (minutesUntilRaid * 60 * 1000));

  const session = {
    guildId,
    channelId,
    raidStartTime,
    minutesUntilRaid,
    bosses: selectedBosses, // Array of { tier, name, order }
    frozenAt: new Date(),
    itemsHandedOut: [], // Will be populated during the raid
    active: true
  };

  await raidSessions.insertOne(session);
  return session;
}

/**
 * Get active raid session for a guild
 */
async function getActiveRaidSession(guildId, collections) {
  const { raidSessions } = collections;
  return await raidSessions.findOne({ guildId, active: true });
}

/**
 * End a raid session and return summary data
 */
async function endRaidSession(guildId, collections) {
  const { raidSessions, handedOut } = collections;

  const session = await getActiveRaidSession(guildId, collections);
  if (!session) return null;

  // Get all items handed out during this raid session
  const itemsHandedOutDuringRaid = await handedOut.find({
    guildId,
    timestamp: { $gte: session.frozenAt }
  }).toArray();

  // Mark session as inactive
  await raidSessions.updateOne(
    { _id: session._id },
    { 
      $set: { 
        active: false, 
        unfrozenAt: new Date(),
        itemsHandedOut: itemsHandedOutDuringRaid
      } 
    }
  );

  // Clear countdown interval for this guild
  clearCountdownInterval(guildId);

  return {
    ...session,
    itemsHandedOut: itemsHandedOutDuringRaid,
    unfrozenAt: new Date()
  };
}

/**
 * Create the raid announcement message (formatted text, no embed)
 */
function createRaidAnnouncementMessage(minutesUntilRaid, bosses, raidStartTime) {
  const timestamp = Math.floor(raidStartTime.getTime() / 1000);

  let message = '# 🚨 GUILD RAID ALERT 🚨\n\n';
  message += '## ❄️ Wishlists are now **FROZEN**!\n\n';
  message += `### ⏰ Raid starts in **${minutesUntilRaid} minute(s)**\n`;
  message += `> Raid begins: <t:${timestamp}:R>\n`;
  message += `> Exact time: <t:${timestamp}:F>\n\n`;

  // Group bosses by tier
  const tier3Bosses = bosses.filter(b => b.tier === 'tier3');
  const tier2Bosses = bosses.filter(b => b.tier === 'tier2');

  if (bosses.length > 0) {
    message += '## 📋 Bosses to Kill\n\n';

    if (tier3Bosses.length > 0) {
      message += '### 🔥 Tier 3 Bosses\n';
      tier3Bosses.forEach((boss, index) => {
        message += `**${index + 1}.** ${boss.name}\n`;
      });
      message += '\n';
    }

    if (tier2Bosses.length > 0) {
      message += '### ⚔️ Tier 2 Bosses\n';
      tier2Bosses.forEach((boss, index) => {
        message += `**${index + 1}.** ${boss.name}\n`;
      });
      message += '\n';
    }
  }

  message += '---\n';
  message += '### 🛡️ Get ready! Good luck everyone!\n';

  return message;
}

/**
 * Create the raid summary message (formatted text, no embed)
 */
async function createRaidSummaryMessage(session, client, collections) {
  const duration = Math.round((session.unfrozenAt - session.frozenAt) / (1000 * 60)); // minutes

  let message = '# ✅ RAID COMPLETE!\n\n';
  message += '## 🎉 Congratulations to everyone who participated!\n\n';
  message += `> ⏱️ **Raid Duration**: ${duration} minute(s)\n`;
  message += '> ❄️ **Wishlists are now UNFROZEN** - You can make changes again!\n\n';

  // Bosses killed
  const tier3Bosses = session.bosses.filter(b => b.tier === 'tier3');
  const tier2Bosses = session.bosses.filter(b => b.tier === 'tier2');

  if (session.bosses.length > 0) {
    message += '## 💀 Bosses Defeated\n\n';

    if (tier3Bosses.length > 0) {
      message += '### 🔥 Tier 3 Bosses\n';
      tier3Bosses.forEach((boss) => {
        message += `✓ ${boss.name}\n`;
      });
      message += '\n';
    }

    if (tier2Bosses.length > 0) {
      message += '### ⚔️ Tier 2 Bosses\n';
      tier2Bosses.forEach((boss) => {
        message += `✓ ${boss.name}\n`;
      });
      message += '\n';
    }
  }

  // Items handed out
  const itemsHandedOut = session.itemsHandedOut || [];

  if (itemsHandedOut.length > 0) {
    message += `## 🎁 Loot Distributed (${itemsHandedOut.length} item${itemsHandedOut.length !== 1 ? 's' : ''})\n\n`;

    // Group by user
    const userItems = {};
    for (const handout of itemsHandedOut) {
      if (!userItems[handout.userId]) {
        userItems[handout.userId] = [];
      }
      userItems[handout.userId].push(handout);
    }

    // Build items list
    let itemCount = 0;
    const maxLength = 1500; // Discord message limit safeguard
    let currentLength = message.length;

    for (const [userId, items] of Object.entries(userItems)) {
      const member = await client.users.fetch(userId).catch(() => null);
      const displayName = member ? member.username : 'Unknown';

      let userSection = `### 👤 ${displayName}\n`;

      for (const item of items) {
        const icon = getItemIcon(item.item);
        const itemLine = `${icon} **${item.item}** — *${item.boss || 'Unknown Boss'}*\n`;

        if (currentLength + userSection.length + itemLine.length > maxLength) {
          message += `\n*... and ${itemsHandedOut.length - itemCount} more item(s)*\n`;
          break;
        }

        userSection += itemLine;
        itemCount++;
      }

      userSection += '\n';

      if (currentLength + userSection.length > maxLength) {
        break;
      }

      message += userSection;
      currentLength += userSection.length;
    }
  } else {
    message += '## 🎁 Loot Distributed\n\n';
    message += '*No items were handed out during this raid.*\n\n';
  }

  message += '---\n';
  message += '### 🏆 Great work everyone! See you next raid!\n';

  return message;
}

/**
 * Get item icon based on item name/type
 */
function getItemIcon(itemName) {
  const lowerName = itemName.toLowerCase();

  if (lowerName.includes('weapon') || lowerName.includes('sword') || 
      lowerName.includes('bow') || lowerName.includes('staff') || 
      lowerName.includes('dagger') || lowerName.includes('spear') ||
      lowerName.includes('crossbow') || lowerName.includes('greatsword')) {
    return '⚔️';
  }

  if (lowerName.includes('armor') || lowerName.includes('helm') || 
      lowerName.includes('plate') || lowerName.includes('greaves') ||
      lowerName.includes('gauntlet') || lowerName.includes('sabatons') ||
      lowerName.includes('garb') || lowerName.includes('tunic') ||
      lowerName.includes('handguard') || lowerName.includes('glove') ||
      lowerName.includes('robe') || lowerName.includes('pants') ||
      lowerName.includes('trousers') || lowerName.includes('boots') ||
      lowerName.includes('shoes')) {
    return '🛡️';
  }

  if (lowerName.includes('ring') || lowerName.includes('belt') || 
      lowerName.includes('necklace') || lowerName.includes('bracelet') ||
      lowerName.includes('earring') || lowerName.includes('collar') ||
      lowerName.includes('gorget') || lowerName.includes('band')) {
    return '💍';
  }

  return '📦';
}

/**
 * Get all available bosses for selection
 */
function getAllBosses() {
  const bosses = [];

  // Tier 3
  for (const bossName of Object.keys(BOSS_DATA.tier3)) {
    bosses.push({ tier: 'tier3', name: bossName, label: `[T3] ${bossName}` });
  }

  // Tier 2
  for (const bossName of Object.keys(BOSS_DATA.tier2)) {
    bosses.push({ tier: 'tier2', name: bossName, label: `[T2] ${bossName}` });
  }

  return bosses;
}

/**
 * Update countdown message (called periodically)
 */
async function updateCountdownMessage(messageId, channelId, raidStartTime, client) {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return;

    const now = Date.now();
    const timeUntilRaid = raidStartTime.getTime() - now;

    if (timeUntilRaid <= 0) {
      // Raid has started
      const lines = message.content.split('\n');
      const bossesSectionIndex = lines.findIndex(line => line.includes('📋 Bosses to Kill'));

      let newMessage = '@everyone\n\n';
      newMessage += '# 🚨 GUILD RAID ALERT 🚨\n\n';
      newMessage += '## ❄️ Wishlists are **FROZEN**!\n\n';
      newMessage += '### 🔥 RAID IN PROGRESS!\n\n';

      // Keep the bosses section if it exists
      if (bossesSectionIndex !== -1) {
        newMessage += lines.slice(bossesSectionIndex).join('\n');
      } else {
        newMessage += '---\n';
        newMessage += '### 🛡️ Good luck everyone!\n';
      }

      await message.edit({ 
        content: newMessage,
        allowedMentions: { parse: ['everyone'] }
      });
      return;
    }

    // Update countdown
    const minutesLeft = Math.ceil(timeUntilRaid / (1000 * 60));
    const timestamp = Math.floor(raidStartTime.getTime() / 1000);

    const lines = message.content.split('\n');
    const bossesSectionIndex = lines.findIndex(line => line.includes('📋 Bosses to Kill'));

    let newMessage = '@everyone\n\n';
    newMessage += '# 🚨 GUILD RAID ALERT 🚨\n\n';
    newMessage += '## ❄️ Wishlists are now **FROZEN**!\n\n';
    newMessage += `### ⏰ Raid starts in **${minutesLeft} minute(s)**\n`;
    newMessage += `> Raid begins: <t:${timestamp}:R>\n`;
    newMessage += `> Exact time: <t:${timestamp}:F>\n\n`;

    // Keep the bosses section
    if (bossesSectionIndex !== -1) {
      newMessage += lines.slice(bossesSectionIndex).join('\n');
    } else {
      newMessage += '---\n';
      newMessage += '### 🛡️ Get ready! Good luck everyone!\n';
    }

    await message.edit({ 
      content: newMessage,
      allowedMentions: { parse: ['everyone'] }
    });
  } catch (err) {
    console.error('Failed to update countdown:', err);
  }
}

/**
 * Start countdown updater for a raid session
 * FIXED: Now stores interval to prevent memory leaks
 */
function startCountdownUpdater(messageId, channelId, raidStartTime, client, guildId) {
  // Clear any existing countdown for this guild
  clearCountdownInterval(guildId);

  const interval = setInterval(async () => {
    const now = Date.now();
    const timeUntilRaid = raidStartTime.getTime() - now;

    // Update countdown
    await updateCountdownMessage(messageId, channelId, raidStartTime, client);

    // Stop updating after raid starts
    if (timeUntilRaid <= 0) {
      clearCountdownInterval(guildId);
    }
  }, 60 * 1000); // Update every minute

  // Store interval for cleanup
  activeCountdowns.set(guildId, interval);

  return interval;
}

/**
 * Clear countdown interval for a guild
 */
function clearCountdownInterval(guildId) {
  const existingInterval = activeCountdowns.get(guildId);
  if (existingInterval) {
    clearInterval(existingInterval);
    activeCountdowns.delete(guildId);
    console.log(`Cleared countdown interval for guild ${guildId}`);
  }
}

/**
 * Cleanup all countdown intervals (call on bot shutdown)
 */
function clearAllCountdownIntervals() {
  for (const [guildId, interval] of activeCountdowns.entries()) {
    clearInterval(interval);
    console.log(`Cleared countdown interval for guild ${guildId}`);
  }
  activeCountdowns.clear();
}

/**
 * Resume active raid countdowns after bot restart
 */
async function resumeActiveRaidCountdowns(client, collections) {
  const { raidSessions } = collections;

  const activeSessions = await raidSessions.find({ active: true }).toArray();

  console.log(`Found ${activeSessions.length} active raid session(s) to resume`);

  for (const session of activeSessions) {
    // Check if raid already started
    if (new Date(session.raidStartTime) <= new Date()) {
      console.log(`Raid for guild ${session.guildId} already started, skipping countdown`);
      continue;
    }

    // Resume countdown
    if (session.announcementMessageId) {
      console.log(`Resuming countdown for guild ${session.guildId}`);
      startCountdownUpdater(
        session.announcementMessageId,
        session.channelId,
        new Date(session.raidStartTime),
        client,
        session.guildId
      );
    }
  }
}

module.exports = {
  createRaidSession,
  getActiveRaidSession,
  endRaidSession,
  createRaidAnnouncementMessage,
  createRaidSummaryMessage,
  getAllBosses,
  updateCountdownMessage,
  startCountdownUpdater,
  clearCountdownInterval,
  clearAllCountdownIntervals,
  resumeActiveRaidCountdowns
};