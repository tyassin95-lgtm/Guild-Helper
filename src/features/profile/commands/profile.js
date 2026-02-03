const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Handle /profile command - Direct users to the Oathly web dashboard
 */
async function handleProfile({ interaction, collections, webServer }) {
  await interaction.deferReply({ flags: 64 }); // ephemeral

  try {
    const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${process.env.WEB_PORT || 3001}`;

    // Create the embed
    const embed = new EmbedBuilder()
      .setColor('#8b5cf6')
      .setTitle('Oathly - Your Profile Dashboard')
      .setDescription('Visit the Oathly website to access your personal profile dashboard.\n\n**Sign in with Discord** to view and manage:')
      .addFields(
        { name: 'My Info', value: 'Your class, weapons, CP, build link, and gear screenshot', inline: false },
        { name: 'Events', value: 'View upcoming events, your signup status, and register for events', inline: false },
        { name: 'Wishlist', value: 'View and manage your item wishlist', inline: false },
        { name: 'Roster', value: 'View your guild roster and party members', inline: false }
      )
      .setFooter({ text: 'Secure Discord OAuth2 login - No password required' })
      .setTimestamp();

    // Create button to open the website
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Open Oathly Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(baseUrl)
          .setEmoji('🌐')
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Error handling profile command:', error);
    await interaction.editReply({
      content: 'Failed to generate profile link. Please try again later.',
    });
  }
}

module.exports = { handleProfile };
