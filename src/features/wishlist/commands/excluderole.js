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
    if (excludedRoles.includes(role.id)) {
      return interaction.reply({
        content: `❌ The role **${role.name}** is already excluded from wishlist tracking.`,
        flags: [64]
      });
    }

    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $addToSet: { excludedRoles: role.id } },
      { upsert: true }
    );

    return interaction.reply({
      content: `✅ **${role.name}** has been excluded from wishlist tracking.\n\n` +
               `Members with this role will not appear in the "Not Submitted" or "Submitted" lists.`,
      flags: [64]
    });
  }

  if (action === 'remove') {
    if (!excludedRoles.includes(role.id)) {
      return interaction.reply({
        content: `❌ The role **${role.name}** is not currently excluded.`,
        flags: [64]
      });
    }

    await guildSettings.updateOne(
      { guildId: interaction.guildId },
      { $pull: { excludedRoles: role.id } }
    );

    return interaction.reply({
      content: `✅ **${role.name}** has been removed from the exclusion list.\n\n` +
               `Members with this role will now appear in wishlist tracking.`,
      flags: [64]
    });
  }

  if (action === 'list') {
    if (excludedRoles.length === 0) {
      return interaction.reply({
        content: 'ℹ️ No roles are currently excluded from wishlist tracking.',
        flags: [64]
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#e67e22')
      .setTitle('📋 Excluded Roles')
      .setDescription('Members with these roles will not appear in wishlist tracking.')
      .setTimestamp();

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