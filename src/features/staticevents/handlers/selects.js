const { ObjectId } = require('mongodb');
const { updateCalendar } = require('../../pvp/calendar/calendarUpdate');

async function handleStaticEventSelects({ interaction, collections }) {
  const { staticEvents, pvpCalendars } = collections;

  if (interaction.customId === 'static_event_cancel_select') {
    const eventId = interaction.values[0];

    // Find and delete the event
    const event = await staticEvents.findOneAndDelete({
      _id: new ObjectId(eventId),
      guildId: interaction.guildId
    });

    if (!event) {
      return interaction.update({
        content: '❌ Event not found or already deleted.',
        components: []
      });
    }

    // Update the calendar to remove the static event
    const calendar = await pvpCalendars.findOne({ guildId: interaction.guildId });
    if (calendar) {
      try {
        await updateCalendar(interaction.guildId, interaction.client, collections);
      } catch (error) {
        console.error('Failed to update calendar after static event deletion:', error);
      }
    }

    return interaction.update({
      content: `✅ **Static Event Cancelled!**\n\n📅 **${event.title}** (${event.dayName} at ${event.timeDisplay})\n\nThis event has been removed from the calendar.`,
      components: []
    });
  }
}

module.exports = { handleStaticEventSelects };
