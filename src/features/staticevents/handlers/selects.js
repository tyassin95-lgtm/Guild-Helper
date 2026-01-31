const { ObjectId } = require('mongodb');
const { updateCalendar } = require('../../pvp/calendar/calendarUpdate');

async function handleStaticEventSelects({ interaction, collections }) {
  const { staticEvents, pvpCalendars } = collections;

  if (interaction.customId === 'static_event_cancel_select') {
    // Defer the update immediately to prevent timeout
    await interaction.deferUpdate();

    const eventId = interaction.values[0];

    try {
      // Find and delete the event
      const event = await staticEvents.findOneAndDelete({
        _id: new ObjectId(eventId),
        guildId: interaction.guildId
      });

      if (!event) {
        return interaction.editReply({
          content: '❌ Event not found or already deleted.',
          components: []
        });
      }

      // Update the calendar to remove the static event
      const calendar = await pvpCalendars.findOne({ guildId: interaction.guildId });
      if (calendar) {
        try {
          console.log('Updating calendar after static event deletion...');
          await updateCalendar(interaction.client, interaction.guildId, collections);
          console.log('Calendar updated successfully');
        } catch (error) {
          console.error('Failed to update calendar after static event deletion:', error);
          // Don't fail the whole operation if calendar update fails
        }
      }

      return interaction.editReply({
        content: `✅ **Static Event Cancelled!**\n\n📅 **${event.title}** (${event.dayName} at ${event.timeDisplay})\n\nThis event has been removed from the calendar.`,
        components: []
      });
    } catch (error) {
      console.error('Error in handleStaticEventSelects:', error);

      return interaction.editReply({
        content: `❌ Failed to cancel static event: ${error.message}`,
        components: []
      }).catch((err) => {
        console.error('Failed to edit reply with error:', err);
      });
    }
  }
}

module.exports = { handleStaticEventSelects };