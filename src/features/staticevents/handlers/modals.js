const { updateCalendar } = require('../../pvp/calendar/calendarUpdate');

// Map day names to day numbers (0 = Sunday, 6 = Saturday)
const dayNameToNumber = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6
};

const dayNumberToName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function handleStaticEventModals({ interaction, collections }) {
  const { staticEvents, pvpCalendars } = collections;

  if (interaction.customId === 'static_event_create') {
    const title = interaction.fields.getTextInputValue('title').trim();
    const dayInput = interaction.fields.getTextInputValue('day').trim().toLowerCase();
    const timeInput = interaction.fields.getTextInputValue('time').trim();

    // Validate day of week
    const dayOfWeek = dayNameToNumber[dayInput];
    if (dayOfWeek === undefined) {
      return interaction.reply({
        content: '❌ Invalid day of week. Please use: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, or Sunday.',
        flags: [64]
      });
    }

    // Validate time format (HH:MM)
    const timeMatch = timeInput.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return interaction.reply({
        content: '❌ Invalid time format. Please use 24-hour format (e.g., 19:00 or 21:30).',
        flags: [64]
      });
    }

    const hour = parseInt(timeMatch[1]);
    const minute = parseInt(timeMatch[2]);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return interaction.reply({
        content: '❌ Invalid time. Hours must be 0-23 and minutes must be 0-59.',
        flags: [64]
      });
    }

    // Format time display
    const timeDisplay = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const dayName = dayNumberToName[dayOfWeek];

    // Store the static event
    const event = {
      guildId: interaction.guildId,
      title,
      dayOfWeek,
      dayName,
      hour,
      minute,
      timeDisplay,
      createdBy: interaction.user.id,
      createdAt: new Date()
    };

    await staticEvents.insertOne(event);

    // Update the calendar to show the new static event
    const calendar = await pvpCalendars.findOne({ guildId: interaction.guildId });
    if (calendar) {
      try {
        await updateCalendar(interaction.guildId, interaction.client, collections);
      } catch (error) {
        console.error('Failed to update calendar after static event creation:', error);
      }
    }

    return interaction.reply({
      content: `✅ **Static Event Created!**\n\n📅 **${title}**\n🗓️ Every **${dayName}** at **${timeDisplay}** (UK time)\n\nThis event will now appear on the calendar every week.`,
      flags: [64]
    });
  }
}

module.exports = { handleStaticEventModals };
