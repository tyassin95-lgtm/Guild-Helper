const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

async function handlePvPCodeManagers({ interaction, collections }) {
  const { guildSettings } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const action = interaction.options.getString('action');
  const role = interaction.options.getRole('role');

  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const pvpCodeManagers = settings?.pvpCodeManagers || [];

  if (action === 'add') {
    if (!role) {
      return interaction.reply({
        content: '❌ You must specify a role to add.',
        flags: [64]
      });
    }

    // Check if role is already authorized
    if (pvpCodeManagers.includes(role.id)) {
      return interaction.reply({
        content: `❌ The role **${role.name}** is already authorized to view PvP attendance codes.`,
        flags: [64]
      });
    }

    // Add role to authorized list
    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $addToSet: { pvpCodeManagers: role.id } },
      { upsert: true }
    );

    return interaction.reply({
      content: `✅ **${role.name}** has been authorized to view PvP attendance codes.\n\n` +
               `Members with this role can now click the "View Code" button on PvP events.`,
      flags: [64]
    });
  }

  if (action === 'remove') {
    if (!role) {
      return interaction.reply({
        content: '❌ You must specify a role to remove.',
        flags: [64]
      });
    }

    // Check if role is in authorized list
    if (!pvpCodeManagers.includes(role.id)) {
      return interaction.reply({
        content: `❌ The role **${role.name}** is not currently authorized.`,
        flags: [64]
      });
    }

    // Remove role from authorized list
    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $pull: { pvpCodeManagers: role.id } }
    );

    return interaction.reply({
      content: `✅ **${role.name}** has been removed from PvP code managers.\n\n` +
               `Members with this role can no longer view attendance codes.`,
      flags: [64]
    });
  }

  if (action === 'list') {
    if (pvpCodeManagers.length === 0) {
      return interaction.reply({
        content: 'ℹ️ No roles are currently authorized to view PvP attendance codes.\n\n' +
                 'Only administrators can view codes by default.\n\n' +
                 'Use `/pvpcodemanagers add` to authorize roles.',
        flags: [64]
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#e74c3c')
      .setTitle('🔐 PvP Code Managers')
      .setDescription('These roles can view PvP event attendance codes.')
      .setTimestamp();

    // Fetch role names
    const roleNames = [];
    for (const roleId of pvpCodeManagers) {
      const guildRole = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (guildRole) {
        roleNames.push(`• ${guildRole.name}`);
      } else {
        roleNames.push(`• Unknown Role (ID: ${roleId})`);
      }
    }

    embed.addFields({
      name: `Authorized Roles (${pvpCodeManagers.length})`,
      value: roleNames.join('\n'),
      inline: false
    });

    embed.addFields({
      name: 'ℹ️ Note',
      value: 'Administrators always have access to view codes, regardless of this list.',
      inline: false
    });

    return interaction.reply({ embeds: [embed], flags: [64] });
  }

  return interaction.reply({ content: 'Unknown action.', flags: [64] });
}

module.exports = { handlePvPCodeManagers };