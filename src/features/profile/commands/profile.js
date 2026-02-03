const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Handle /profile command - Direct users to Oathly website
 */
async function handleProfile({ interaction, collections, webServer }) {
  try {
    // Defer reply early to acknowledge the interaction
    await interaction.deferReply({ flags: 64 }); // ephemeral
  } catch (error) {
    // If deferReply fails, the interaction has likely expired
    // Log the error but don't throw - the error handler will manage it
    console.error('Failed to defer reply for profile command:', error.message);
    // If we can't defer, we also can't send any response
    // The interaction has expired and user won't see anything
    return;
  }

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
    try {
      await interaction.editReply({
        content: 'Failed to generate profile info. Please try again later.',
      });
    } catch (editError) {
      // If we can't edit the reply, the interaction is no longer valid
      console.error('Failed to edit reply (interaction may have expired):', editError.message);
    }
  }
}

module.exports = { handleProfile };
