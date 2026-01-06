/**
 * /automod command - Main configuration command
 */

const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getActiveWarnings, clearWarnings, WARNINGS_BEFORE_TIMEOUT } = require('../utils/warningManager');

async function handleAutoMod({ interaction, collections }) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'setup') {
    return handleSetup({ interaction, collections });
  }

  if (subcommand === 'toggle') {
    return handleToggle({ interaction, collections });
  }

  if (subcommand === 'channels') {
    return handleChannels({ interaction, collections });
  }

  if (subcommand === 'exempt') {
    return handleExempt({ interaction, collections });
  }

  if (subcommand === 'logchannel') {
    return handleLogChannel({ interaction, collections });
  }

  if (subcommand === 'status') {
    return handleStatus({ interaction, collections });
  }

  if (subcommand === 'timeout') {
    return handleTimeout({ interaction, collections });
  }

  if (subcommand === 'warnings') {
    return handleViewWarnings({ interaction, collections });
  }

  if (subcommand === 'clearwarnings') {
    return handleClearWarnings({ interaction, collections });
  }
}

/**
 * /automod setup - Initial setup wizard
 */
async function handleSetup({ interaction, collections }) {
  const { automodSettings } = collections;

  const settings = await automodSettings.findOne({ guildId: interaction.guildId });

  if (settings && settings.enabled) {
    return interaction.reply({
      content: '⚠️ AutoMod is already set up. Use `/automod status` to view settings or other subcommands to modify configuration.',
      flags: [64]
    });
  }

  // Create default settings
  await automodSettings.updateOne(
    { guildId: interaction.guildId },
    {
      $set: {
        guildId: interaction.guildId,
        enabled: false, // Start disabled
        enabledChannelIds: [],
        exemptRoleIds: [],
        timeoutDuration: 300, // 5 minutes
        severityThreshold: 'low', // Changed to 'low' to catch all levels including warnings
        sendDM: true,
        timeoutUser: true,
        logChannelId: null,
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('✅ AutoMod Setup Complete')
    .setDescription('AutoMod has been initialized with default settings. The system uses a **3-strike warning system** before timeouts.\n\n' +
                   '**How it works:**\n' +
                   '• Minor violations (insults, rudeness) = Warning\n' +
                   '• 3 warnings in 24 hours = Automatic timeout\n' +
                   '• Serious violations (slurs, threats) = Immediate timeout\n\n' +
                   'Configure it using the following commands:')
    .addFields(
      { name: '📍 Monitor Channels', value: '`/automod channels add #channel` - Add channels to monitor', inline: false },
      { name: '🛡️ Exempt Roles', value: '`/automod exempt add @role` - Exempt roles from automod', inline: false },
      { name: '📋 Log Channel', value: '`/automod logchannel #channel` - Set moderation log channel', inline: false },
      { name: '⏱️ Timeout Duration', value: '`/automod timeout 5` - Set timeout duration (in minutes)', inline: false },
      { name: '⚠️ View Warnings', value: '`/automod warnings @user` - Check user warnings', inline: false },
      { name: '🧹 Clear Warnings', value: '`/automod clearwarnings @user` - Reset warnings', inline: false },
      { name: '✅ Enable AutoMod', value: '`/automod toggle on` - Enable the system', inline: false },
      { name: '📊 View Status', value: '`/automod status` - View current configuration', inline: false }
    )
    .setFooter({ text: 'AutoMod is currently DISABLED. Enable it after configuration.' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: [64] });
}

/**
 * /automod toggle - Enable/disable automod
 */
async function handleToggle({ interaction, collections }) {
  const { automodSettings } = collections;
  const action = interaction.options.getString('action');

  const enabled = action === 'on';

  const settings = await automodSettings.findOne({ guildId: interaction.guildId });

  if (!settings) {
    return interaction.reply({
      content: '❌ AutoMod is not set up yet. Run `/automod setup` first.',
      flags: [64]
    });
  }

  // Warn if enabling without channels configured
  if (enabled && (!settings.enabledChannelIds || settings.enabledChannelIds.length === 0)) {
    return interaction.reply({
      content: '⚠️ Cannot enable AutoMod: No channels are configured for monitoring.\n\nUse `/automod channels add #channel` to add channels first.',
      flags: [64]
    });
  }

  await automodSettings.updateOne(
    { guildId: interaction.guildId },
    { $set: { enabled } }
  );

  return interaction.reply({
    content: enabled 
      ? '✅ **AutoMod is now ENABLED**\n\nThe system will now monitor configured channels with a 3-strike warning system:\n• Warnings for minor violations\n• Timeout after 3 warnings in 24 hours\n• Immediate timeout for serious violations' 
      : '❌ **AutoMod is now DISABLED**\n\nNo automatic moderation actions will be taken.',
    flags: [64]
  });
}

/**
 * /automod channels - Manage monitored channels
 */
async function handleChannels({ interaction, collections }) {
  const { automodSettings } = collections;
  const action = interaction.options.getString('action');
  const channel = interaction.options.getChannel('channel');

  const settings = await automodSettings.findOne({ guildId: interaction.guildId });

  if (!settings) {
    return interaction.reply({
      content: '❌ AutoMod is not set up yet. Run `/automod setup` first.',
      flags: [64]
    });
  }

  if (action === 'add') {
    if (!channel) {
      return interaction.reply({
        content: '❌ You must specify a channel to add.',
        flags: [64]
      });
    }

    if (settings.enabledChannelIds.includes(channel.id)) {
      return interaction.reply({
        content: `❌ ${channel} is already being monitored.`,
        flags: [64]
      });
    }

    await automodSettings.updateOne(
      { guildId: interaction.guildId },
      { $addToSet: { enabledChannelIds: channel.id } }
    );

    return interaction.reply({
      content: `✅ ${channel} is now being monitored by AutoMod.`,
      flags: [64]
    });
  }

  if (action === 'remove') {
    if (!channel) {
      return interaction.reply({
        content: '❌ You must specify a channel to remove.',
        flags: [64]
      });
    }

    if (!settings.enabledChannelIds.includes(channel.id)) {
      return interaction.reply({
        content: `❌ ${channel} is not currently being monitored.`,
        flags: [64]
      });
    }

    await automodSettings.updateOne(
      { guildId: interaction.guildId },
      { $pull: { enabledChannelIds: channel.id } }
    );

    return interaction.reply({
      content: `✅ ${channel} is no longer being monitored by AutoMod.`,
      flags: [64]
    });
  }

  if (action === 'list') {
    if (!settings.enabledChannelIds || settings.enabledChannelIds.length === 0) {
      return interaction.reply({
        content: 'ℹ️ No channels are currently being monitored.',
        flags: [64]
      });
    }

    const channelList = settings.enabledChannelIds.map(id => `• <#${id}>`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('📍 Monitored Channels')
      .setDescription(channelList)
      .setFooter({ text: `Total: ${settings.enabledChannelIds.length} channel(s)` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: [64] });
  }
}

/**
 * /automod exempt - Manage exempt roles
 */
async function handleExempt({ interaction, collections }) {
  const { automodSettings } = collections;
  const action = interaction.options.getString('action');
  const role = interaction.options.getRole('role');

  const settings = await automodSettings.findOne({ guildId: interaction.guildId });

  if (!settings) {
    return interaction.reply({
      content: '❌ AutoMod is not set up yet. Run `/automod setup` first.',
      flags: [64]
    });
  }

  if (action === 'add') {
    if (!role) {
      return interaction.reply({
        content: '❌ You must specify a role to exempt.',
        flags: [64]
      });
    }

    if (settings.exemptRoleIds && settings.exemptRoleIds.includes(role.id)) {
      return interaction.reply({
        content: `❌ ${role} is already exempt from AutoMod.`,
        flags: [64]
      });
    }

    await automodSettings.updateOne(
      { guildId: interaction.guildId },
      { $addToSet: { exemptRoleIds: role.id } }
    );

    return interaction.reply({
      content: `✅ ${role} is now exempt from AutoMod.\n\nMembers with this role will not be subject to automatic moderation.`,
      flags: [64]
    });
  }

  if (action === 'remove') {
    if (!role) {
      return interaction.reply({
        content: '❌ You must specify a role to remove from exemptions.',
        flags: [64]
      });
    }

    if (!settings.exemptRoleIds || !settings.exemptRoleIds.includes(role.id)) {
      return interaction.reply({
        content: `❌ ${role} is not currently exempt.`,
        flags: [64]
      });
    }

    await automodSettings.updateOne(
      { guildId: interaction.guildId },
      { $pull: { exemptRoleIds: role.id } }
    );

    return interaction.reply({
      content: `✅ ${role} is no longer exempt from AutoMod.`,
      flags: [64]
    });
  }

  if (action === 'list') {
    if (!settings.exemptRoleIds || settings.exemptRoleIds.length === 0) {
      return interaction.reply({
        content: 'ℹ️ No roles are currently exempt from AutoMod.',
        flags: [64]
      });
    }

    const roleList = settings.exemptRoleIds.map(id => `• <@&${id}>`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('🛡️ Exempt Roles')
      .setDescription(roleList)
      .setFooter({ text: `Total: ${settings.exemptRoleIds.length} role(s)` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: [64] });
  }
}

/**
 * /automod logchannel - Set log channel
 */
async function handleLogChannel({ interaction, collections }) {
  const { automodSettings } = collections;
  const channel = interaction.options.getChannel('channel');

  const settings = await automodSettings.findOne({ guildId: interaction.guildId });

  if (!settings) {
    return interaction.reply({
      content: '❌ AutoMod is not set up yet. Run `/automod setup` first.',
      flags: [64]
    });
  }

  await automodSettings.updateOne(
    { guildId: interaction.guildId },
    { $set: { logChannelId: channel.id } }
  );

  return interaction.reply({
    content: `✅ AutoMod logs will now be sent to ${channel}.`,
    flags: [64]
  });
}

/**
 * /automod timeout - Set timeout duration
 */
async function handleTimeout({ interaction, collections }) {
  const { automodSettings } = collections;
  const minutes = interaction.options.getInteger('minutes');

  if (minutes < 1 || minutes > 1440) {
    return interaction.reply({
      content: '❌ Timeout duration must be between 1 and 1440 minutes (24 hours).',
      flags: [64]
    });
  }

  const settings = await automodSettings.findOne({ guildId: interaction.guildId });

  if (!settings) {
    return interaction.reply({
      content: '❌ AutoMod is not set up yet. Run `/automod setup` first.',
      flags: [64]
    });
  }

  await automodSettings.updateOne(
    { guildId: interaction.guildId },
    { $set: { timeoutDuration: minutes * 60 } }
  );

  return interaction.reply({
    content: `✅ Timeout duration set to **${minutes} minute(s)**.`,
    flags: [64]
  });
}

/**
 * /automod status - View current settings
 */
async function handleStatus({ interaction, collections }) {
  const { automodSettings } = collections;

  const settings = await automodSettings.findOne({ guildId: interaction.guildId });

  if (!settings) {
    return interaction.reply({
      content: '❌ AutoMod is not set up yet. Run `/automod setup` first.',
      flags: [64]
    });
  }

  const embed = new EmbedBuilder()
    .setColor(settings.enabled ? '#2ecc71' : '#95a5a6')
    .setTitle('⚙️ AutoMod Configuration')
    .setDescription(settings.enabled 
      ? '**Warning System:** 3 strikes in 24 hours = timeout\n**Minor violations** get warnings, **serious violations** get immediate timeout'
      : 'AutoMod is currently disabled')
    .addFields(
      { 
        name: '📊 Status', 
        value: settings.enabled ? '✅ **ENABLED**' : '❌ **DISABLED**', 
        inline: true 
      },
      { 
        name: '⏱️ Timeout Duration', 
        value: `${Math.floor(settings.timeoutDuration / 60)} minutes`, 
        inline: true 
      },
      { 
        name: '📍 Monitored Channels', 
        value: settings.enabledChannelIds.length > 0 
          ? settings.enabledChannelIds.map(id => `<#${id}>`).join('\n')
          : 'None configured', 
        inline: false 
      },
      { 
        name: '🛡️ Exempt Roles', 
        value: settings.exemptRoleIds && settings.exemptRoleIds.length > 0 
          ? settings.exemptRoleIds.map(id => `<@&${id}>`).join('\n')
          : 'None', 
        inline: false 
      },
      { 
        name: '📋 Log Channel', 
        value: settings.logChannelId ? `<#${settings.logChannelId}>` : 'Not configured', 
        inline: false 
      }
    )
    .setFooter({ text: 'AutoMod System • Warnings expire after 24 hours' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: [64] });
}

/**
 * /automod warnings - View user warnings
 */
async function handleViewWarnings({ interaction, collections }) {
  const user = interaction.options.getUser('user');

  const warnings = await getActiveWarnings({
    collections,
    guildId: interaction.guildId,
    userId: user.id
  });

  if (warnings.length === 0) {
    return interaction.reply({
      content: `✅ ${user.tag} has no active warnings.`,
      flags: [64]
    });
  }

  const embed = new EmbedBuilder()
    .setColor('#f39c12')
    .setTitle(`⚠️ Active Warnings for ${user.tag}`)
    .setDescription(`**Total:** ${warnings.length}/${WARNINGS_BEFORE_TIMEOUT} warnings\n\n` +
                   `Warnings expire 24 hours after being issued.\n` +
                   `${warnings.length >= WARNINGS_BEFORE_TIMEOUT ? '⚠️ **Next violation will result in timeout!**' : ''}`)
    .setTimestamp();

  warnings.forEach((warning, index) => {
    const timeAgo = Math.floor((Date.now() - warning.timestamp.getTime()) / 1000 / 60); // minutes ago
    const hoursAgo = Math.floor(timeAgo / 60);
    const minutesAgo = timeAgo % 60;

    let timeString;
    if (hoursAgo > 0) {
      timeString = `${hoursAgo}h ${minutesAgo}m ago`;
    } else {
      timeString = `${minutesAgo}m ago`;
    }

    embed.addFields({
      name: `Warning ${index + 1} (${timeString})`,
      value: `**Reason:** ${warning.reason}\n**Message:** \`${warning.messageContent.substring(0, 100)}${warning.messageContent.length > 100 ? '...' : ''}\``,
      inline: false
    });
  });

  return interaction.reply({ embeds: [embed], flags: [64] });
}

/**
 * /automod clearwarnings - Clear all warnings for a user
 */
async function handleClearWarnings({ interaction, collections }) {
  const user = interaction.options.getUser('user');

  const count = await clearWarnings({
    collections,
    guildId: interaction.guildId,
    userId: user.id
  });

  if (count === 0) {
    return interaction.reply({
      content: `ℹ️ ${user.tag} has no warnings to clear.`,
      flags: [64]
    });
  }

  return interaction.reply({
    content: `✅ Cleared ${count} warning${count === 1 ? '' : 's'} for ${user.tag}.`,
    flags: [64]
  });
}

module.exports = { handleAutoMod };