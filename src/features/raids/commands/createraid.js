const { 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

async function handleCreateRaid({ interaction, collections }) {
  const modal = new ModalBuilder()
    .setCustomId('raid_create_basic')
    .setTitle('Create Raid Event');

  const nameInput = new TextInputBuilder()
    .setCustomId('raid_name')
    .setLabel('Raid Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Temple of Slaughter')
    .setRequired(true)
    .setMaxLength(100);

  const difficultyInput = new TextInputBuilder()
    .setCustomId('raid_difficulty')
    .setLabel('Difficulty')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Normal, Hard, Nightmare')
    .setRequired(true)
    .setMaxLength(50);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('raid_description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Event details, requirements, etc.')
    .setRequired(true)
    .setMaxLength(1000);

  const imageInput = new TextInputBuilder()
    .setCustomId('raid_image')
    .setLabel('Image URL (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/image.png')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(difficultyInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(imageInput)
  );

  await interaction.showModal(modal);
}

async function handleCreateBasicModal({ interaction, collections }) {
  const { raidEvents } = collections;

  const name = interaction.fields.getTextInputValue('raid_name');
  const difficulty = interaction.fields.getTextInputValue('raid_difficulty');
  const description = interaction.fields.getTextInputValue('raid_description');
  const imageUrl = interaction.fields.getTextInputValue('raid_image') || null;

  // Store temporary raid data in memory (we'll save to DB when finalized)
  const tempRaidId = `temp_${interaction.user.id}_${Date.now()}`;

  // Store in a global Map (you could also use a temporary collection)
  if (!global.tempRaids) global.tempRaids = new Map();

  global.tempRaids.set(tempRaidId, {
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    name,
    difficulty,
    description,
    imageUrl,
    timeSlots: [],
    createdBy: interaction.user.id
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗡️ Raid Event Setup')
    .setDescription('Configure your raid event. Add time slots below.')
    .addFields(
      { name: 'Name', value: name, inline: true },
      { name: 'Difficulty', value: difficulty, inline: true },
      { name: 'Description', value: description },
      { name: 'Time Slots', value: 'None added yet' }
    );

  if (imageUrl) {
    embed.setThumbnail(imageUrl);
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
      .setDisabled(true), // Disabled until at least one time slot added
    new ButtonBuilder()
      .setCustomId(`raid_cancel:${tempRaidId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );

  await interaction.reply({
    embeds: [embed],
    components: [buttons],
    flags: [64]
  });
}

module.exports = { 
  handleCreateRaid,
  handleCreateBasicModal
};