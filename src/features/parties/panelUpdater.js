const { EmbedBuilder } = require('discord.js');
const { getRoleEmoji } = require('./roleDetection');
const { getReservePlayers } = require('./reserve');

const UPDATE_INTERVAL_MS = 60 * 1000; // 60 seconds
const DEBOUNCE_DELAY_MS = 5000; // 5 seconds between updates per guild
const STARTUP_DELAY_MS = 10 * 1000; // 10 seconds delay on startup

// Track update timers and last update time per guild
const updateTimers = new Map();
const lastUpdateTime = new Map();

// Track if bot is still initializing
let isInitializing = true;

/**
 * Start the automatic party panel updater
 */
function startPartyPanelUpdater(client, collections) {
  if (!client || !collections) {
    console.error('Cannot start panel updater: client or collections missing');
    return;
  }

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

  // Run every 60 seconds
  setInterval(async () => {
    if (isInitializing) return;

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
  if (!collections?.partyPanels) {
    console.warn('Cannot update all panels: partyPanels collection missing');
    return;
  }

  const allPanels = await collections.partyPanels.find({}).toArray();

  for (const panel of allPanels) {
    try {
      await updatePartyPanel(panel.guildId, client, collections);
    } catch (err) {
      console.error(`Failed to update panel for guild ${panel.guildId}:`, err?.message || err);
    }
  }
}

/**
 * Update a specific guild's party panel
 */
async function updatePartyPanel(guildId, client, collections) {
  if (!guildId || !client || !collections?.partyPanels) {
    console.warn(`Skipping panel update: missing guildId, client, or collections for guild ${guildId}`);
    return;
  }

  const { partyPanels, parties, guildSettings } = collections;

  // Debounce
  const lastUpdate = lastUpdateTime.get(guildId);
  if (lastUpdate && Date.now() - lastUpdate < DEBOUNCE_DELAY_MS) return;

  const panelInfo = await partyPanels.findOne({ guildId });
  if (!panelInfo) return;

  const channel = await client.channels.fetch(panelInfo.channelId).catch(() => null);
  if (!channel) {
    console.log(`Channel ${panelInfo.channelId} not found, removing panel record`);
    await partyPanels.deleteOne({ guildId }).catch(() => {});
    return;
  }

  const message = await channel.messages.fetch(panelInfo.messageId).catch(() => null);
  if (!message) {
    console.log(`Panel message ${panelInfo.messageId} not found, removing panel record`);
    await partyPanels.deleteOne({ guildId }).catch(() => {});
    return;
  }

  // Load settings safely
  const settings = guildSettings ? await guildSettings.findOne({ guildId }) : {};
  const maxParties = settings?.maxParties || 10;

  // Load parties and reserve players in parallel
  const [allPartiesData, reservePlayersData] = await Promise.all([
    parties ? parties.find({ guildId, partyNumber: { $lte: maxParties } }).sort({ partyNumber: 1 }).toArray() : [],
    getReservePlayers ? getReservePlayers(guildId, collections) : []
  ]);

  const allParties = allPartiesData || [];
  const reservePlayers = reservePlayersData || [];

  const embeds = [];

  // Build party embeds
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
      const totalCP = party.totalCP || 0;
      const avgCP = members.length > 0 ? Math.round(totalCP / members.length) : 0;

      const memberList = await Promise.all(members.map(async (m, index) => {
        const roleIcon = getRoleEmoji(m.role) || '';
        const cp = (m.cp || 0).toLocaleString();
        const position = ['⓵','⓶','⓷','⓸','⓹','⓺'][index] || `${index+1}.`;
        return `${position} <@${m.userId}>\n   ${roleIcon} ${m.weapon1 || ''} / ${m.weapon2 || ''} • \`${cp} CP\``;
      }));

      embed.setDescription(memberList.join('\n\n'));

      const statusEmoji = members.length >= 6 ? '✅' : members.length >= 4 ? '⚠️' : '❌';
      embed.addFields(
        { name: 'Party Status', value: `${statusEmoji} \`${members.length}/6 slots filled\``, inline: true },
        { name: 'Total CP', value: `\`${totalCP.toLocaleString()}\``, inline: true },
        { name: 'Average CP', value: `\`${avgCP.toLocaleString()}\``, inline: true }
      );

      const roleComposition = party.roleComposition || { tank: 0, healer: 0, dps: 0 };
      embed.addFields({
        name: '📊 Role Composition',
        value: `🛡️ Tanks: ${roleComposition.tank}\n💚 Healers: ${roleComposition.healer}\n⚔️ DPS: ${roleComposition.dps}`,
        inline: false
      });
    }

    embeds.push(embed);
  }

  // Build reserve embed
  const reserveEmbed = new EmbedBuilder()
    .setColor(reservePlayers.length > 0 ? '#e67e22' : '#95a5a6')
    .setTitle('📋 Reserve Pool')
    .setTimestamp();

  if (reservePlayers.length === 0) {
    reserveEmbed.setDescription('```\n✅ No players in reserve\n```');
  } else {
    const tanks = reservePlayers.filter(p => p.role === 'tank');
    const healers = reservePlayers.filter(p => p.role === 'healer');
    const dpsPlayers = reservePlayers.filter(p => p.role === 'dps');

    const reserveList = [];
    function appendPlayers(title, list) {
      if (list.length === 0) return;
      reserveList.push(`**${title}**`);
      list.forEach((p, i) => {
        const pos = ['⓵','⓶','⓷','⓸','⓹','⓺','⓻','⓼','⓽','⓾'][i] || `${i+1}.`;
        reserveList.push(`${pos} <@${p.userId}>\n   ${getRoleEmoji(p.role)||''} ${p.weapon1||''} / ${p.weapon2||''} • \`${(p.cp||0).toLocaleString()} CP\``);
      });
      reserveList.push('');
    }

    appendPlayers('🛡️ TANKS', tanks);
    appendPlayers('💚 HEALERS', healers);
    appendPlayers('⚔️ DPS', dpsPlayers);

    reserveEmbed.setDescription(reserveList.join('\n'));
  }

  embeds.push(reserveEmbed);

  // Truncate to 10 embeds
  if (embeds.length > 10) embeds.splice(10);

  try {
    await message.edit({ embeds });
    lastUpdateTime.set(guildId, Date.now());
  } catch (err) {
    console.error(`Failed to edit panel message for guild ${guildId}:`, err?.message || err);
  }
}

/**
 * Schedule an immediate panel update (debounced)
 */
function schedulePartyPanelUpdate(guildId, client, collections) {
  if (!guildId || !client || !collections?.partyPanels) {
    console.warn(`Cannot schedule update: missing arguments for guild ${guildId}`);
    return;
  }

  if (isInitializing) return;

  if (updateTimers.has(guildId)) {
    clearTimeout(updateTimers.get(guildId));
  }

  const timer = setTimeout(async () => {
    try {
      await updatePartyPanel(guildId, client, collections);
    } catch (err) {
      console.error(`Failed to update party panel for guild ${guildId}:`, err?.message || err);
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
