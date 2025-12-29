const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

async function handleGuildPoll({ interaction, collections }) {
  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ 
      content: '❌ You need administrator permissions to create polls.', 
      flags: [64] 
    });
  }

  // Create modal for poll configuration
  const modal = new ModalBuilder()
    .setCustomId('poll_create_modal')
    .setTitle('Create Guild Poll');

  // Description input (0-1500 characters)
  const descriptionInput = new TextInputBuilder()
    .setCustomId('poll_description')
    .setLabel('Poll Description (0-1500 characters)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter the poll question or description...')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(1500);

  // Options input (newline-separated, 2-8 options)
  const optionsInput = new TextInputBuilder()
    .setCustomId('poll_options')
    .setLabel('Poll Options (one per line, 2-8 options)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Option 1\nOption 2\nOption 3\n...')
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(500);

  // Duration input (1-168 hours)
  const durationInput = new TextInputBuilder()
    .setCustomId('poll_duration')
    .setLabel('Duration in Hours (1-168)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('24')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  // Multiple choice toggle (yes/no)
  const multipleChoiceInput = new TextInputBuilder()
    .setCustomId('poll_multiple_choice')
    .setLabel('Allow Multiple Votes? (yes/no)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('no')
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(3);

  // Image URL input (optional)
  const imageInput = new TextInputBuilder()
    .setCustomId('poll_image')
    .setLabel('Image URL (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://example.com/image.png')
    .setRequired(false);

  // Add inputs to modal
  modal.addComponents(
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(optionsInput),
    new ActionRowBuilder().addComponents(durationInput),
    new ActionRowBuilder().addComponents(multipleChoiceInput),
    new ActionRowBuilder().addComponents(imageInput)
  );

  await interaction.showModal(modal);
}

module.exports = { handleGuildPoll };