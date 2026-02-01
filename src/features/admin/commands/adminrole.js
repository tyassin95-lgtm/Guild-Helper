const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Handle /adminrole command - Manage admin panel access roles
 */
async function handleAdminRole({ interaction, collections }) {
  // Check for administrator permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: 'You need administrator permissions to manage admin panel roles.',
      flags: 64
    });
  }

  const action = interaction.options.getString('action');
  const role = interaction.options.getRole('role');
  const guildId = interaction.guildId;

  // Get current guild settings
  let guildSettings = await collections.guildSettings.findOne({ guildId });

  if (!guildSettings) {
    guildSettings = {
      guildId,
      adminPanelRoles: []
    };
  }

  if (!guildSettings.adminPanelRoles) {
    guildSettings.adminPanelRoles = [];
  }

  switch (action) {
    case 'add': {
      if (!role) {
        return interaction.reply({
          content: 'Please specify a role to add.',
          flags: 64
        });
      }

      if (guildSettings.adminPanelRoles.includes(role.id)) {
        return interaction.reply({
          content: `${role.name} already has admin panel access.`,
          flags: 64
        });
      }

      await collections.guildSettings.updateOne(
        { guildId },
        { $addToSet: { adminPanelRoles: role.id } },
        { upsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor('#22c55e')
        .setTitle('Admin Panel Role Added')
        .setDescription(`${role} now has access to the admin panel.`)
        .setFooter({ text: 'Members with this role can use /adminpanel' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    case 'remove': {
      if (!role) {
        return interaction.reply({
          content: 'Please specify a role to remove.',
          flags: 64
        });
      }

      if (!guildSettings.adminPanelRoles.includes(role.id)) {
        return interaction.reply({
          content: `${role.name} doesn't have admin panel access.`,
          flags: 64
        });
      }

      await collections.guildSettings.updateOne(
        { guildId },
        { $pull: { adminPanelRoles: role.id } }
      );

      const embed = new EmbedBuilder()
        .setColor('#ef4444')
        .setTitle('Admin Panel Role Removed')
        .setDescription(`${role} no longer has access to the admin panel.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    case 'list': {
      const roleNames = [];
      for (const roleId of guildSettings.adminPanelRoles) {
        const guildRole = interaction.guild.roles.cache.get(roleId);
        if (guildRole) {
          roleNames.push(`<@&${roleId}>`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#8b5cf6')
        .setTitle('Admin Panel Roles')
        .setDescription(
          roleNames.length > 0
            ? `The following roles can access the admin panel:\n\n${roleNames.join('\n')}`
            : 'No roles have been granted admin panel access yet.\n\nUse `/adminrole add @role` to add a role.\n\n*Note: Server administrators can always access the admin panel.*'
        )
        .setFooter({ text: 'Administrators always have access' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    default:
      return interaction.reply({
        content: 'Invalid action. Use add, remove, or list.',
        flags: 64
      });
  }
}

/**
 * Check if a member has admin panel access
 */
async function hasAdminPanelAccess(member, collections) {
  // Administrators always have access
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const guildSettings = await collections.guildSettings.findOne({
    guildId: member.guild.id
  });

  if (!guildSettings || !guildSettings.adminPanelRoles) {
    return false;
  }

  // Check if member has any of the admin panel roles
  for (const roleId of guildSettings.adminPanelRoles) {
    if (member.roles.cache.has(roleId)) {
      return true;
    }
  }

  return false;
}

module.exports = { handleAdminRole, hasAdminPanelAccess };
