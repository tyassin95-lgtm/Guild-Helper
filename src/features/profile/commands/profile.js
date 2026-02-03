const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Handle /profile command - Generate a unique profile dashboard link
 */
async function handleProfile({ interaction, collections, webServer }) {
  await interaction.deferReply({ flags: 64 }); // ephemeral

  try {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    // Generate a secure profile token (1 hour expiry)
    const token = webServer.generateProfileToken(guildId, userId, 3600000);

    const baseUrl = process.env.WEB_BASE_URL || `http://localhost:${process.env.WEB_PORT || 3001}`;
    const profileUrl = `${baseUrl}/profile/${token}`;

    // Create the embed
    const embed = new EmbedBuilder()
      .setColor('#8b5cf6')
      .setTitle('Your Profile Dashboard')
      .setDescription('Click the button below to open your personal profile dashboard.\n\nYou can view and edit:')
      .addFields(
        { name: 'My Info', value: 'Your class, weapons, CP, build link, and gear screenshot', inline: false },
        { name: 'Events', value: 'View upcoming events, your signup status, and register for events', inline: false },
        { name: 'Wishlist', value: 'View and manage your item wishlist', inline: false }
      )
      .setFooter({ text: 'This link expires in 1 hour' })
      .setTimestamp();

    // Create button to open profile
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Open Profile Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(profileUrl)
          .setEmoji('🔗')
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
