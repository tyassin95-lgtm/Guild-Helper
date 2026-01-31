const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

async function handleStaticEvent({ interaction, collections }) {
  const { staticEvents } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const action = interaction.options.getString('action');

  if (action === 'create') {
    // Show modal for creating a static event
    const modal = new ModalBuilder()
      .setCustomId('static_event_create')
      .setTitle('Create Static Event');

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Event Title')
      .setPlaceholder('e.g., Guild Meeting, Weekly Raid Night')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const dayInput = new TextInputBuilder()
      .setCustomId('day')
      .setLabel('Day of Week')
      .setPlaceholder('Monday, Tuesday, Wednesday, etc.')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(15);

    const timeInput = new TextInputBuilder()
      .setCustomId('time')
      .setLabel('Time (24-hour format, UK timezone)')
      .setPlaceholder('e.g., 19:00 or 21:30')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(5);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(dayInput),
      new ActionRowBuilder().addComponents(timeInput)
    );

    return interaction.showModal(modal);
  }

  if (action === 'cancel') {
    // Fetch all active static events for this guild
    const events = await staticEvents.find({ guildId: interaction.guildId }).toArray();

    if (events.length === 0) {
      return interaction.reply({
        content: '❌ There are no active static events to cancel.',
        flags: [64]
      });
    }

    // Build options for select menu
    const options = events.map(event => ({
      label: event.title,
      description: `${event.dayName} at ${event.timeDisplay}`,
      value: event._id.toString()
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('static_event_cancel_select')
        .setPlaceholder('Select event to cancel')
        .addOptions(options)
    );

    return interaction.reply({
      content: '**Cancel Static Event**\n\nSelect the event you want to remove from the calendar:',
      components: [row],
      flags: [64]
    });
  }
}

module.exports = { handleStaticEvent };
