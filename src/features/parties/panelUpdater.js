const { EmbedBuilder } = require('discord.js');
const { getRoleEmoji } = require('./roleDetection');
const { getReservePlayers } = require('./reserve');

const UPDATE_INTERVAL_MS = 60 * 1000; // 60 seconds
const DEBOUNCE_DELAY_MS = 5000; // 5 seconds between updates per guild
const STARTUP_DELAY_MS = 10 * 1000; // 10 seconds delay on startup to allow data to load

// Track update timers per guild
const updateTimers = new Map();
const lastUpdateTime = new Map();

// Track if bot is still initializing
let isInitializing = true;

/**
 * Start the automatic party panel updater
 */
function startPartyPanelUpdater(client, collections) {
  console.log('Starting party panel auto-updater (60s interval)...');

  // Wait for startup delay before marking as initialized
  setTimeout(() => {
    isInitializing = false;
    console.log('Party panel updater initialization complete');
  }, STARTUP_DELAY_MS);

  // Run first update after startup delay
  setTimeout(async () => {
    try {
      await updateAllPartyPanels(client, collections);
    } catch (err) {
      console.error('Error in party panel initial update:', err);
    }
  }, STARTUP_DELAY_MS);

  // Run every 60 seconds after that
  setInterval(async () => {
    // Skip updates if still initializing
    if (isInitializing) {
      console.log('Skipping panel update - still initializing');
      return;
    }

    try {
      await updateAllPartyPanels(client, collections);
    } catch (err) {
      console.error('Error in party panel auto-update:', err);
    }
  }, UPDATE_INTERVAL_MS);

  console.log('Party panel auto-updater started');
}

/**
 * Update all party panels across all guilds
 */
async function updateAllPartyPanels(client, collections) {
  const { partyPanels } = collections;

  const allPanels = await partyPanels.find({}).toArray();

  for (const panel of allPanels) {
    try {
      await updatePartyPanel(panel.guildId, client, collections);
    } catch (err) {
      console.error(`Failed to update panel for guild ${panel.guildId}:`, err.message);
    }
  }
}

/**
 * Update a specific guild's party panel
 */
async function updatePartyPanel(guildId, client, collections) {
  const { partyPanels, parties, guildSettings } = collections;

  // Check debounce
  const lastUpdate = lastUpdateTime.get(guildId);
  if (lastUpdate && Date.now() - lastUpdate < DEBOUNCE_DELAY_MS) {
    return; // Too soon, skip this update
  }

  const panelInfo = await partyPanels.findOne({ guildId });
  if (!panelInfo) return; // No panel configured for this guild

  const channel = await client.channels.fetch(panelInfo.channelId).catch(() => null);
  if (!channel) {
    console.log(`Channel ${panelInfo.channelId} not found, removing panel record`);
    await partyPanels.deleteOne({ guildId });
    return;
  }

  const message = await channel.messages.fetch(panelInfo.messageId).catch(() => null);

  // If message doesn't exist, remove the panel record
  if (!message) {
    console.log(`Panel message ${panelInfo.messageId} not found, removing panel record`);
    await partyPanels.deleteOne({ guildId });
    return;
  }

  // FIXED: Load settings FIRST to avoid race condition
  const settings = await guildSettings.findOne({ guildId });
  const maxParties = settings?.maxParties || 10;

  // Then load parties and reserves in parallel
  const [allPartiesData, reservePlayersData] = await Promise.all([
    parties.find({ 
      guildId,
      partyNumber: { $lte: maxParties }
    }).sort({ partyNumber: 1 }).toArray(),
    getReservePlayers(guildId, collections)
  ]);

  const allParties = allPartiesData;
  const reservePlayers = reservePlayersData;

  // Build embeds for each party
  const embeds = [];

  // Add party embeds (if any exist)
  if (allParties.length > 0) {
    for (const party of allParties) {
      const members = party.members || [];
      const embed = new EmbedBuilder()
        .setColor(members.length >= 6 ? '#10B981' : members.length >= 4 ? '#F59E0B' : '#EF4444')
        .setTitle(`⚔️ Party ${party.partyNumber}`)
        .setTimestamp();

      if (members.length === 0) {
        embed.setDescription('```\n🔓 OPEN - No members assigned yet\n```');
        embed.addFields({ name: 'Status', value: '`0/6 slots filled`', inline: true });
      } else {
        // Calculate total CP
        const totalCP = party.totalCP || 0;
        const avgCP = Math.round(totalCP / members.length);

        // Build member list with role icons
        const memberList = await Promise.all(members.map(async (m, index) => {
          const roleIcon = getRoleEmoji(m.role);
          const cp = (m.cp || 0).toLocaleString();
          const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺'][index] || `${index + 1}.`;

          return `${position} <@${m.userId}>\n   ${roleIcon} ${m.weapon1} / ${m.weapon2} • \`${cp} CP\``;
        }));

        embed.setDescription(memberList.join('\n\n'));

        // Stats fields
        const statusEmoji = members.length >= 6 ? '✅' : members.length >= 4 ? '⚠️' : '❌';
        embed.addFields(
          { 
            name: 'Party Status', 
            value: `${statusEmoji} \`${members.length}/6 slots filled\``, 
            inline: true 
          },
          { 
            name: 'Total CP', 
            value: `\`${totalCP.toLocaleString()}\``, 
            inline: true 
          },
          { 
            name: 'Average CP', 
            value: `\`${avgCP.toLocaleString()}\``, 
            inline: true 
          }
        );

        // Role composition
        const roleComposition = party.roleComposition || { tank: 0, healer: 0, dps: 0 };
        const roleText = [
          `🛡️ Tanks: ${roleComposition.tank}`,
          `💚 Healers: ${roleComposition.healer}`,
          `⚔️ DPS: ${roleComposition.dps}`
        ].join('\n');

        embed.addFields({
          name: '📊 Role Composition',
          value: roleText,
          inline: false
        });
      }

      embeds.push(embed);
    }
  }

  // Always add reserve pool embed (even if empty or no parties exist) to prevent flickering
  const reserveEmbed = new EmbedBuilder()
    .setColor(reservePlayers.length > 0 ? '#e67e22' : '#95a5a6')
    .setTitle('📋 Reserve Pool')
    .setTimestamp();

  if (reservePlayers.length === 0) {
    // Empty reserve pool
    if (allParties.length === 0) {
      // No parties and no reserve
      reserveEmbed.setDescription('```\n✅ No parties or reserve players yet\n```');
      reserveEmbed.addFields({
        name: 'ℹ️ Getting Started',
        value: 
          '• Players can set up their info using `/myinfo`\n' +
          '• Parties will be automatically created as players join\n' +
          '• Reserve pool is used when max parties limit is reached',
        inline: false
      });
    } else {
      // Parties exist, but reserve is empty
      reserveEmbed.setDescription('```\n✅ Reserve pool is empty - all players assigned!\n```');
      reserveEmbed.addFields({
        name: 'ℹ️ About Reserve',
        value: 
          '• When max parties is reached, new players go to reserve\n' +
          '• Reserve players are promoted during rebalancing (every 72 hours)\n' +
          '• Update CP with `/myinfo` to improve reserve position',
        inline: false
      });
    }
  } else {
    // Group by role
    const tanks = reservePlayers.filter(p => p.role === 'tank');
    const healers = reservePlayers.filter(p => p.role === 'healer');
    const dpsPlayers = reservePlayers.filter(p => p.role === 'dps');

    // Build description with all reserve players
    const reserveList = [];

    // Add tanks
    if (tanks.length > 0) {
      reserveList.push('**🛡️ TANKS**');
      for (let i = 0; i < tanks.length; i++) {
        const p = tanks[i];
        const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺', '⓻', '⓼', '⓽', '⓾'][i] || `${i + 1}.`;
        const roleIcon = getRoleEmoji(p.role);
        const cp = (p.cp || 0).toLocaleString();
        reserveList.push(`${position} <@${p.userId}>\n   ${roleIcon} ${p.weapon1} / ${p.weapon2} • \`${cp} CP\``);
      }
      reserveList.push(''); // Spacing
    }

    // Add healers
    if (healers.length > 0) {
      reserveList.push('**💚 HEALERS**');
      for (let i = 0; i < healers.length; i++) {
        const p = healers[i];
        const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺', '⓻', '⓼', '⓽', '⓾'][i] || `${i + 1}.`;
        const roleIcon = getRoleEmoji(p.role);
        const cp = (p.cp || 0).toLocaleString();
        reserveList.push(`${position} <@${p.userId}>\n   ${roleIcon} ${p.weapon1} / ${p.weapon2} • \`${cp} CP\``);
      }
      reserveList.push(''); // Spacing
    }

    // Add DPS
    if (dpsPlayers.length > 0) {
      reserveList.push('**⚔️ DPS**');
      for (let i = 0; i < dpsPlayers.length; i++) {
        const p = dpsPlayers[i];
        const position = ['⓵', '⓶', '⓷', '⓸', '⓹', '⓺', '⓻', '⓼', '⓽', '⓾'][i] || `${i + 1}.`;
        const roleIcon = getRoleEmoji(p.role);
        const cp = (p.cp || 0).toLocaleString();
        reserveList.push(`${position} <@${p.userId}>\n   ${roleIcon} ${p.weapon1} / ${p.weapon2} • \`${cp} CP\``);
      }
    }

    reserveEmbed.setDescription(reserveList.join('\n'));

    // Add stats fields
    const totalReserveCP = reservePlayers.reduce((sum, p) => sum + (p.cp || 0), 0);
    const avgReserveCP = reservePlayers.length > 0 ? Math.round(totalReserveCP / reservePlayers.length) : 0;

    reserveEmbed.addFields(
      { 
        name: 'Reserve Status', 
        value: `\`${reservePlayers.length} players in reserve\``, 
        inline: true 
      },
      { 
        name: 'Total CP', 
        value: `\`${totalReserveCP.toLocaleString()}\``, 
        inline: true 
      },
      { 
        name: 'Average CP', 
        value: `\`${avgReserveCP.toLocaleString()}\``, 
        inline: true 
      }
    );

    // Add role breakdown
    const roleText = [
      `🛡️ Tanks: ${tanks.length}`,
      `💚 Healers: ${healers.length}`,
      `⚔️ DPS: ${dpsPlayers.length}`
    ].join('\n');

    reserveEmbed.addFields({
      name: '📊 Role Breakdown',
      value: roleText,
      inline: false
    });

    reserveEmbed.addFields({
      name: 'ℹ️ About Reserve',
      value: 
        '• Players prioritized by: Role → CP → Time in reserve\n' +
        '• Automatically promoted during rebalancing (every 72 hours)\n' +
        '• Update CP with `/myinfo` to improve reserve position',
      inline: false
    });
  }

  embeds.push(reserveEmbed);

  // Discord allows up to 10 embeds per message
  if (embeds.length > 10) {
    console.warn(`Guild ${guildId} has ${embeds.length} embeds, truncating to 10`);
    embeds.splice(10);
  }

  // Update the message
  try {
    await message.edit({ embeds });
    lastUpdateTime.set(guildId, Date.now());
  } catch (err) {
    console.error(`Failed to edit panel message for guild ${guildId}:`, err.message);
  }
}

/**
 * Schedule an immediate panel update (debounced)
 */
function schedulePartyPanelUpdate(guildId, client, collections) {
  // Skip if still initializing
  if (isInitializing) {
    console.log(`Skipping scheduled update for guild ${guildId} - still initializing`);
    return;
  }

  // Clear existing timer for this guild
  if (updateTimers.has(guildId)) {
    clearTimeout(updateTimers.get(guildId));
  }

  // Schedule new update with debounce
  const timer = setTimeout(async () => {
    try {
      await updatePartyPanel(guildId, client, collections);
    } catch (err) {
      console.error(`Failed to update party panel for guild ${guildId}:`, err);
    } finally {
      updateTimers.delete(guildId);
    }
  }, DEBOUNCE_DELAY_MS);

  updateTimers.set(guildId, timer);
}

module.exports = {
  startPartyPanelUpdater,
  updatePartyPanel,
  schedulePartyPanelUpdate
};