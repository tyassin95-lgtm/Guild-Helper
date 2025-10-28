const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function handleRaidModals({ interaction, collections }) {
  const customId = interaction.customId;

  if (customId.startsWith('raid_add_time_modal:')) {
    return handleAddTimeModal({ interaction, collections });
  }
}

async function handleAddTimeModal({ interaction, collections }) {
  const tempRaidId = interaction.customId.split(':')[1];

  if (!global.tempRaids || !global.tempRaids.has(tempRaidId)) {
    return interaction.reply({
      content: '❌ Raid setup expired. Please start over.',
      flags: [64]
    });
  }

  const datetimeStr = interaction.fields.getTextInputValue('datetime');
  const capacityStr = interaction.fields.getTextInputValue('capacity');

  // Parse datetime (YYYY-MM-DD HH:MM)
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/;
  const match = datetimeStr.match(dateRegex);

  if (!match) {
    return interaction.reply({
      content: '❌ Invalid date format. Use: YYYY-MM-DD HH:MM (e.g., 2025-11-01 19:00)',
      flags: [64]
    });
  }

  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute)
  ));

  if (isNaN(date.getTime())) {
    return interaction.reply({
      content: '❌ Invalid date. Please check your input.',
      flags: [64]
    });
  }

  const timestamp = Math.floor(date.getTime() / 1000);

  // Parse capacity
  const capacity = parseInt(capacityStr);
  if (isNaN(capacity) || capacity < 1 || capacity > 1000) {
    return interaction.reply({
      content: '❌ Invalid capacity. Must be between 1 and 1000.',
      flags: [64]
    });
  }

  // Add time slot
  const tempRaid = global.tempRaids.get(tempRaidId);
  tempRaid.timeSlots.push({
    id: timestamp.toString(),
    timestamp,
    maxCapacity: capacity,
    attendees: []
  });

  // Sort time slots by timestamp
  tempRaid.timeSlots.sort((a, b) => a.timestamp - b.timestamp);

  // Update the setup embed
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗡️ Raid Event Setup')
    .setDescription('Configure your raid event. Add time slots below.')
    .addFields(
      { name: 'Name', value: tempRaid.name, inline: true },
      { name: 'Difficulty', value: tempRaid.difficulty, inline: true },
      { name: 'Description', value: tempRaid.description },
      { 
        name: 'Time Slots', 
        value: tempRaid.timeSlots.map(slot => 
          `• <t:${slot.timestamp}:F> - Max ${slot.maxCapacity} players`
        ).join('\n') || 'None added yet'
      }
    );

  if (tempRaid.imageUrl) {
    embed.setThumbnail(tempRaid.imageUrl);
  }

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`raid_add_time:${tempRaidId}`)
      .setLabel('Add Time Slot')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('➕'),
    new ButtonBuilder()
      .setCustomId(`raid_finish:${tempRaidId}`)
      .setLabel('Finish & Post')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
      .setDisabled(tempRaid.timeSlots.length === 0),
    new ButtonBuilder()
      .setCustomId(`raid_cancel:${tempRaidId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );

  await interaction.update({
    embeds: [embed],
    components: [buttons]
  });
}

module.exports = { handleRaidModals };