const { PermissionFlagsBits } = require('discord.js');

async function handleViewParties({ interaction, collections }) {
  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to manage parties.',
      flags: [64]
    });
  }

  // Generate web token
  const { webServer } = require('../../../web/server');
  const token = webServer.generateStaticPartyToken(interaction.guildId, interaction.user.id);

  const baseUrl = process.env.WEB_BASE_URL || 'http://34.170.220.22:3001';
  const webUrl = `${baseUrl}/static-party-editor/${token}`;

  return interaction.reply({
    content: `⚔️ **Static Party Manager**\n\n` +
             `Click the link below to manage your guild's parties:\n\n` +
             `**[Open Party Editor](${webUrl})**\n\n` +
             `⏰ Link expires in 1 hour\n` +
             `ℹ️ You can create, edit, delete parties and drag members between them`,
    flags: [64]
  });
}

module.exports = { handleViewParties };
