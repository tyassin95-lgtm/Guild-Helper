const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

async function handlePvPEvent({ interaction, collections }) {
  const { pvpEvents } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  // Show event type selection
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('pvp_select_event_type')
      .setPlaceholder('Select event type')
      .addOptions([
        { label: 'Siege', value: 'siege', emoji: '🏰' },
        { label: 'Riftstone Fight', value: 'riftstone', emoji: '💎' },
        { label: 'Boonstone Fight', value: 'boonstone', emoji: '🔮' }
      ])
  );

  return interaction.reply({
    content: '**Creating PvP Event**\n\nStep 1: Select the event type',
    components: [row],
    flags: [64]
  });
}

module.exports = { handlePvPEvent };