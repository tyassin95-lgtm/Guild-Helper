/**
 * /automod command - Main configuration command
 */

const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

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
        severityThreshold: 'low',
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
    .setDescription('AutoMod has been initialized with default settings. Configure it using the following commands:')
    .addFields(
      { name: '📍 Monitor Channels', value: '`/automod channels add #channel` - Add channels to monitor', inline: false },
      { name: '🛡️ Exempt Roles', value: '`/automod exempt add @role` - Exempt roles from automod', inline: false },
      { name: '📋 Log Channel', value: '`/automod logchannel #channel` - Set moderation log channel', inline: false },
      { name: '⏱️ Timeout Duration', value: '`/automod timeout 5` - Set timeout duration (in minutes)', inline: false },
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
      ? '✅ **AutoMod is now ENABLED**\n\nThe system will now monitor configured channels and take action on problematic messages.' 
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
    .setFooter({ text: 'AutoMod System' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: [64] });
}

module.exports = { handleAutoMod };