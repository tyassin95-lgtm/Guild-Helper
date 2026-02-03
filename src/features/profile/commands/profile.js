const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Handle /profile command - Direct users to Oathly website
 */
async function handleProfile({ interaction, collections, webServer }) {
  await interaction.deferReply({ flags: 64 }); // ephemeral

  try {
    // Create the embed
    const embed = new EmbedBuilder()
      .setColor('#8b5cf6')
      .setTitle('Guild Profile & Management')
      .setDescription('Visit Oathly to access your guild profile and management tools.\n\nOn Oathly you can:')
      .addFields(
        { name: 'My Info', value: 'View and edit your class, weapons, CP, build link, and gear', inline: false },
        { name: 'Events', value: 'View upcoming events, your signup status, and register for events', inline: false },
        { name: 'Roster', value: 'View guild roster, party assignments, and attendance tracking', inline: false },
        { name: 'Wishlist', value: 'View and manage your item wishlist', inline: false }
      )
      .setFooter({ text: 'Visit Oathly for full guild management features' })
      .setTimestamp();

    // Create button to open Oathly
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Visit Oathly')
          .setStyle(ButtonStyle.Link)
          .setURL('https://oathly.net')
          .setEmoji('🌐')
      );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('Error handling profile command:', error);
    await interaction.editReply({
      content: 'Failed to generate profile info. Please try again later.',
    });
  }
}

module.exports = { handleProfile };
