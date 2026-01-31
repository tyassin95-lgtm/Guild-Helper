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
    // Defer reply immediately to prevent timeout
    await interaction.deferReply({ flags: [64] });

    try {
      const title = interaction.fields.getTextInputValue('title').trim();
      const dayInput = interaction.fields.getTextInputValue('day').trim().toLowerCase();
      const timeInput = interaction.fields.getTextInputValue('time').trim();

      console.log('Creating static event:', { title, dayInput, timeInput });

      // Validate day of week
      const dayOfWeek = dayNameToNumber[dayInput];
      if (dayOfWeek === undefined) {
        return interaction.editReply({
          content: '❌ Invalid day of week. Please use: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, or Sunday.'
        });
      }

      // Validate time format (HH:MM)
      const timeMatch = timeInput.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch) {
        return interaction.editReply({
          content: '❌ Invalid time format. Please use 24-hour format (e.g., 19:00 or 21:30).'
        });
      }

      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);

      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return interaction.editReply({
          content: '❌ Invalid time. Hours must be 0-23 and minutes must be 0-59.'
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

      console.log('Inserting static event into database:', event);
      await staticEvents.insertOne(event);
      console.log('Static event inserted successfully');

      // Update the calendar to show the new static event
      const calendar = await pvpCalendars.findOne({ guildId: interaction.guildId });
      console.log('Calendar found:', calendar ? 'yes' : 'no');

      if (calendar) {
        try {
          console.log('Updating calendar...');
          await updateCalendar(interaction.client, interaction.guildId, collections);
          console.log('Calendar updated successfully');
        } catch (error) {
          console.error('Failed to update calendar after static event creation:', error);
          // Don't fail the whole operation if calendar update fails
        }
      }

      return interaction.editReply({
        content: `✅ **Static Event Created!**\n\n📅 **${title}**\n🗓️ Every **${dayName}** at **${timeDisplay}** (UK time)\n\nThis event will now appear on the calendar every week.`
      });
    } catch (error) {
      console.error('Error in handleStaticEventModals:', error);
      console.error('Error stack:', error.stack);

      return interaction.editReply({
        content: `❌ Failed to create static event: ${error.message}`
      }).catch((err) => {
        console.error('Failed to edit reply with error:', err);
      });
    }
  }
}

module.exports = { handleStaticEventModals };