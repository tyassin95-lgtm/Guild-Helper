const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getAllBosses, createRaidSession, createRaidAnnouncementMessage, getActiveRaidSession, endRaidSession, createRaidSummaryMessage, startCountdownUpdater } = require('../../../features/raids/raidSession');

async function handleFreeze({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const action = interaction.options.getString('action');

  if (action === 'freeze') {
    // Check if already frozen
    const settings = await guildSettings.findOne({ guildId: interaction.guildId });
    if (settings?.finalizeFrozen) {
      return interaction.reply({
        content: '❌ Wishlists are already frozen! Use `/freeze action:unfreeze` to unfreeze first.',
        flags: [64]
      });
    }

    // Show modal to get raid details
    const modal = new ModalBuilder()
      .setCustomId('freeze_raid_setup')
      .setTitle('Setup Guild Raid');

    const minutesInput = new TextInputBuilder()
      .setCustomId('minutes_until_raid')
      .setLabel('Minutes Until Raid Starts')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 15')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(4);

    const row = new ActionRowBuilder().addComponents(minutesInput);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  if (action === 'unfreeze') {
    // Check if frozen
    const settings = await guildSettings.findOne({ guildId: interaction.guildId });
    if (!settings?.finalizeFrozen) {
      return interaction.reply({
        content: '❌ Wishlists are not currently frozen!',
        flags: [64]
      });
    }

    await interaction.deferReply();

    // Get active raid session
    const raidSession = await getActiveRaidSession(interaction.guildId, collections);

    // Unfreeze wishlists
    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $set: { finalizeFrozen: false, unfrozenAt: new Date() } },
      { upsert: true }
    );

    if (raidSession) {
      // End raid session and get summary
      const summary = await endRaidSession(interaction.guildId, collections);

      // Create and post raid summary
      const summaryMessage = await createRaidSummaryMessage(summary, interaction.client, collections);

      await interaction.channel.send({
        content: `@everyone\n\n${summaryMessage}`,
        allowedMentions: { parse: ['everyone'] }
      });

      return interaction.editReply({
        content: '✅ Raid session ended! Summary posted above.'
      });
    } else {
      // No active raid session, just unfreeze
      return interaction.editReply({
        content: '✅ **Wishlist finalization has been UNFROZEN!**\n\n' +
                 '• Users can now finalize their wishlists\n' +
                 '• Users can add/remove items again'
      });
    }
  }

  return interaction.reply({ content: 'Unknown action.', flags: [64] });
}

async function handleFreezeModal({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const minutesValue = interaction.fields.getTextInputValue('minutes_until_raid');
  const minutes = parseInt(minutesValue);

  if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
    return interaction.reply({
      content: '❌ Invalid time! Please enter a number between 1 and 1440 minutes (24 hours).',
      flags: [64]
    });
  }

  // Show boss selection menu
  const bosses = getAllBosses();

  // Split into multiple select menus if needed (max 25 options per menu)
  const tier3Bosses = bosses.filter(b => b.tier === 'tier3');
  const tier2Bosses = bosses.filter(b => b.tier === 'tier2');

  const components = [];

  if (tier3Bosses.length > 0) {
    const tier3Row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`freeze_select_tier3:${minutes}`)
        .setPlaceholder('Select Tier 3 bosses (optional)')
        .setMinValues(0)
        .setMaxValues(Math.min(tier3Bosses.length, 25))
        .addOptions(tier3Bosses.slice(0, 25).map(b => ({
          label: b.name,
          value: `tier3:${b.name}`,
          emoji: '🔥'
        })))
    );
    components.push(tier3Row);
  }

  if (tier2Bosses.length > 0) {
    const tier2Row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`freeze_select_tier2:${minutes}`)
        .setPlaceholder('Select Tier 2 bosses (optional)')
        .setMinValues(0)
        .setMaxValues(Math.min(tier2Bosses.length, 25))
        .addOptions(tier2Bosses.slice(0, 25).map(b => ({
          label: b.name,
          value: `tier2:${b.name}`,
          emoji: '⚔️'
        })))
    );
    components.push(tier2Row);
  }

  // Store the minutes in a temporary collection for retrieval
  await collections.guildSettings.updateOne(
    { guildId: interaction.guildId },
    { $set: { tempRaidMinutes: minutes, tempRaidBosses: [] } },
    { upsert: true }
  );

  // Add a "Finish Selection" button
  const finishButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('freeze_finish_selection')
      .setLabel('Finish Selection & Start Raid')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  );

  components.push(finishButton);

  return interaction.reply({
    content: `⏰ **Raid Time Set**: ${minutes} minute(s)\n\n` +
             '📋 **Select the bosses you plan to kill** (in order):\n' +
             '• Select from Tier 3 and/or Tier 2 bosses\n' +
             '• You can select from one or both tiers\n' +
             '• Click **"Finish Selection & Start Raid"** when done\n' +
             '• You can also skip boss selection entirely and just freeze',
    components,
    flags: [64]
  });
}

async function handleFreezeBossSelection({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.update({ content: '❌ You need administrator permissions.', components: [] });
  }

  // Get stored minutes
  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const minutes = settings?.tempRaidMinutes || 15;

  // Parse selections
  const selectedBosses = [];
  let order = 1;

  for (const value of interaction.values) {
    const [tier, bossName] = value.split(':');
    selectedBosses.push({ tier, name: bossName, order: order++ });
  }

  // Get existing selections
  const existingSelections = settings?.tempRaidBosses || [];

  // Merge selections (keeping order)
  const allSelections = [...existingSelections, ...selectedBosses];

  // Update with new selections
  await guildSettings.updateOne(
    { guildId: interaction.guildId },
    { $set: { tempRaidBosses: allSelections } },
    { upsert: true }
  );

  // Check if this is tier3 or tier2
  const isTier3 = interaction.customId.includes('tier3');

  // Just update the status message, don't finalize yet
  const tierName = isTier3 ? 'Tier 3' : 'Tier 2';
  return interaction.update({
    content: `✅ Selected ${selectedBosses.length} ${tierName} boss(es). Total: ${allSelections.length} boss(es)\n\n` +
             `You can select more bosses from the other tier, or click **"Finish Selection & Start Raid"** to continue.`,
    components: interaction.message.components
  });
}

async function handleFreezeFinishButton({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.update({ content: '❌ You need administrator permissions.', components: [] });
  }

  // Get stored data
  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const minutes = settings?.tempRaidMinutes || 15;
  const selectedBosses = settings?.tempRaidBosses || [];

  // Finalize the freeze
  await finalizeFreeze(interaction, minutes, selectedBosses, collections);
}

async function finalizeFreeze(interaction, minutes, selectedBosses, collections) {
  const { guildSettings } = collections;

  await interaction.deferUpdate();

  // Freeze wishlists
  await guildSettings.updateOne(
    { guildId: interaction.guildId },
    { 
      $set: { 
        finalizeFrozen: true, 
        frozenAt: new Date() 
      },
      $unset: {
        tempRaidMinutes: '',
        tempRaidBosses: ''
      }
    },
    { upsert: true }
  );

  // Renumber bosses to ensure sequential order
  const orderedBosses = selectedBosses.map((boss, index) => ({
    ...boss,
    order: index + 1
  }));

  // Create raid session
  const raidStartTime = new Date(Date.now() + (minutes * 60 * 1000));
  const session = await createRaidSession(
    interaction.guildId,
    interaction.channelId,
    minutes,
    orderedBosses,
    collections
  );

  // Create and post announcement
  const announcementMessage = createRaidAnnouncementMessage(
    minutes,
    orderedBosses,
    raidStartTime
  );

  const announcementMsg = await interaction.channel.send({
    content: `@everyone\n\n${announcementMessage}`,
    allowedMentions: { parse: ['everyone'] }
  });

  // Start countdown updater
  startCountdownUpdater(
    announcementMsg.id,
    interaction.channelId,
    raidStartTime,
    interaction.client
  );

  // Store message ID for updates
  await collections.raidSessions.updateOne(
    { _id: session._id },
    { $set: { announcementMessageId: announcementMsg.id } }
  );

  return interaction.editReply({
    content: '✅ **Raid freeze activated!**\n\n' +
             `• Wishlists are now frozen\n` +
             `• Raid announcement posted\n` +
             `• Countdown started (${minutes} minutes)\n` +
             `• ${orderedBosses.length} boss(es) selected\n\n` +
             'Use `/freeze action:unfreeze` when the raid is complete.',
    components: []
  });
}

async function handleFreezeStatus({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const isFrozen = settings?.finalizeFrozen || false;

  if (isFrozen) {
    const frozenAt = settings.frozenAt ? new Date(settings.frozenAt).toLocaleString() : 'Unknown';

    // Check for active raid session
    const raidSession = await getActiveRaidSession(interaction.guildId, collections);

    let content = `❄️ **Status: FROZEN**\n\nWishlists have been frozen since: ${frozenAt}\n\nUsers cannot make changes until unfrozen.`;

    if (raidSession) {
      const timeUntilRaid = raidSession.raidStartTime.getTime() - Date.now();
      const minutesLeft = Math.max(0, Math.ceil(timeUntilRaid / (1000 * 60)));

      content += `\n\n🔥 **Active Raid Session**\n`;
      content += `• Time until raid: ${minutesLeft} minute(s)\n`;
      content += `• Bosses planned: ${raidSession.bosses.length}\n`;
      content += `• Started: <t:${Math.floor(raidSession.frozenAt.getTime() / 1000)}:R>`;
    }

    return interaction.reply({ content, flags: [64] });
  }

  const unfrozenAt = settings?.unfrozenAt ? new Date(settings.unfrozenAt).toLocaleString() : 'Never frozen';
  return interaction.reply({
    content: `✅ **Status: UNFROZEN**\n\nLast unfrozen: ${unfrozenAt}\n\nUsers can freely make changes to their wishlists.`,
    flags: [64]
  });
}

module.exports = { 
  handleFreeze, 
  handleFreezeStatus,
  handleFreezeModal,
  handleFreezeBossSelection,
  handleFreezeFinishButton
};