const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

async function handleExcludeRole({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const action = interaction.options.getString('action');
  const role = interaction.options.getRole('role');

  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const excludedRoles = settings?.excludedRoles || [];

  if (action === 'add') {
    if (!role) {
      return interaction.reply({
        content: '❌ You must specify a role to exclude.',
        flags: [64]
      });
    }

    // Check if role is already excluded
    if (excludedRoles.includes(role.id)) {
      return interaction.reply({
        content: `❌ The role **${role.name}** is already excluded from tracking.`,
        flags: [64]
      });
    }

    // Add role to exclusion list
    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $addToSet: { excludedRoles: role.id } },
      { upsert: true }
    );

    return interaction.reply({
      content: `✅ **${role.name}** has been excluded from tracking.\n\n` +
               `Members with this role will not appear in various tracking lists.`,
      flags: [64]
    });
  }

  if (action === 'remove') {
    if (!role) {
      return interaction.reply({
        content: '❌ You must specify a role to remove from exclusions.',
        flags: [64]
      });
    }

    // Check if role is in exclusion list
    if (!excludedRoles.includes(role.id)) {
      return interaction.reply({
        content: `❌ The role **${role.name}** is not currently excluded.`,
        flags: [64]
      });
    }

    // Remove role from exclusion list
    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $pull: { excludedRoles: role.id } }
    );

    return interaction.reply({
      content: `✅ **${role.name}** has been removed from the exclusion list.\n\n` +
               `Members with this role will now appear in tracking.`,
      flags: [64]
    });
  }

  if (action === 'list') {
    if (excludedRoles.length === 0) {
      return interaction.reply({
        content: 'ℹ️ No roles are currently excluded from tracking.',
        flags: [64]
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle('📋 Excluded Roles')
      .setDescription('Members with these roles will not appear in various tracking features.')
      .setTimestamp();

    // Fetch role names
    const roleNames = [];
    for (const roleId of excludedRoles) {
      const guildRole = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (guildRole) {
        roleNames.push(`• ${guildRole.name}`);
      } else {
        roleNames.push(`• Unknown Role (ID: ${roleId})`);
      }
    }

    embed.addFields({
      name: `Excluded Roles (${excludedRoles.length})`,
      value: roleNames.join('\n'),
      inline: false
    });

    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  return interaction.reply({ content: 'Unknown action.', flags: [64] });
}

module.exports = { handleExcludeRole };