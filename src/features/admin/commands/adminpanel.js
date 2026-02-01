const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { hasAdminPanelAccess } = require('./adminrole');

/**
 * Handle /adminpanel command - Generate a unique admin panel dashboard link
 */
async function handleAdminPanel({ interaction, collections, webServer }) {
  await interaction.deferReply({ flags: 64 }); // ephemeral

  try {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    // Check if user has admin panel access
    const hasAccess = await hasAdminPanelAccess(interaction.member, collections);
    if (!hasAccess) {
      return interaction.editReply({
        content: 'You do not have permission to access the admin panel. Ask a server administrator to grant you access with `/adminrole add @your-role`.'
      });
    }

    // Generate a secure admin token (1 hour expiry)
    const token = webServer.generateAdminToken(guildId, userId, 3600000);

    const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${process.env.WEB_PORT || 3001}`;
    const adminUrl = `${baseUrl}/admin/${token}`;

    // Create the embed
    const embed = new EmbedBuilder()
      .setColor('#8b5cf6')
      .setTitle('Admin Panel')
      .setDescription('Click the button below to open the admin panel.\n\nYou can manage:')
      .addFields(
        { name: 'Event Parties', value: 'Form parties for upcoming events using the web editor', inline: true },
        { name: 'Static Parties', value: 'View and edit static party assignments', inline: true },
        { name: 'User Management', value: 'Reset user wishlists and party information', inline: true },
        { name: 'Reminders', value: 'Send DM reminders for party info or wishlist setup', inline: true },
        { name: 'Item Distribution', value: 'Hand out items from wishlists to users', inline: true },
        { name: 'Item Rolls', value: 'Create new item roll events', inline: true }
      )
      .setFooter({ text: 'This link expires in 1 hour' })
      .setTimestamp();

    // Create button to open admin panel
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Open Admin Panel')
          .setStyle(ButtonStyle.Link)
          .setURL(adminUrl)
          .setEmoji('🛠️')
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Error handling adminpanel command:', error);
    await interaction.editReply({
      content: 'Failed to generate admin panel link. Please try again later.',
    });
  }
}

module.exports = { handleAdminPanel };
