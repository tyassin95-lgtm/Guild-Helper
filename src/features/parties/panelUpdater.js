const { EmbedBuilder } = require('discord.js');
const { getRoleEmoji } = require('./roleDetection');

const UPDATE_INTERVAL_MS = 60 * 1000; // 60 seconds
const DEBOUNCE_DELAY_MS = 5000; // 5 seconds between updates per guild

// Track update timers per guild
const updateTimers = new Map();
const lastUpdateTime = new Map();

/**
 * Start the automatic party panel updater
 */
function startPartyPanelUpdater(client, collections) {
  console.log('Starting party panel auto-updater (60s interval)...');

  // Run every 60 seconds
  setInterval(async () => {
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
  const { partyPanels, parties } = collections;

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

  // Get all parties for this guild
  const allParties = await parties.find({ guildId }).sort({ partyNumber: 1 }).toArray();

  if (allParties.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle('⚔️ Static Parties')
      .setDescription('No parties have been created yet.')
      .setTimestamp();

    await message.edit({ embeds: [embed] });
    lastUpdateTime.set(guildId, Date.now());
    return;
  }

  // Build embeds for each party
  const embeds = [];

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

  // Update the message
  await message.edit({ embeds });
  lastUpdateTime.set(guildId, Date.now());
}

/**
 * Schedule an immediate panel update (debounced)
 */
function schedulePartyPanelUpdate(guildId, client, collections) {
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