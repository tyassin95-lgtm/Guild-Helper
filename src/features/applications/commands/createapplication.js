const { 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');

async function handleCreateApplication({ interaction, collections }) {
  // Step 1: Show basic configuration modal
  const modal = new ModalBuilder()
    .setCustomId('app_create_basic')
    .setTitle('Create Application Panel - Basic Info');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Application Title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., Guild Raider Application')
    .setRequired(true)
    .setMaxLength(100);

  const descInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Welcome message and application overview...')
    .setRequired(true)
    .setMaxLength(2000);

  const colorInput = new TextInputBuilder()
    .setCustomId('color')
    .setLabel('Embed Color (Hex)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., #5865F2 or 5865F2')
    .setRequired(false)
    .setMaxLength(7);

  const thumbnailInput = new TextInputBuilder()
    .setCustomId('thumbnail')
    .setLabel('Thumbnail URL (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://...')
    .setRequired(false);

  const imageInput = new TextInputBuilder()
    .setCustomId('image')
    .setLabel('Image URL (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://...')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(colorInput),
    new ActionRowBuilder().addComponents(thumbnailInput),
    new ActionRowBuilder().addComponents(imageInput)
  );

  await interaction.showModal(modal);
}

async function handleCreateBasicModal({ interaction, collections }) {
  const title = interaction.fields.getTextInputValue('title');
  const description = interaction.fields.getTextInputValue('description');
  const colorInput = interaction.fields.getTextInputValue('color');
  const thumbnail = interaction.fields.getTextInputValue('thumbnail');
  const image = interaction.fields.getTextInputValue('image');

  // Parse color
  let embedColor = 0x5865F2; // Default Discord blue
  if (colorInput) {
    const cleaned = colorInput.replace('#', '');
    const parsed = parseInt(cleaned, 16);
    if (!isNaN(parsed)) {
      embedColor = parsed;
    }
  }

  // Store in temporary context (we'll use a collection for this)
  const { dmContexts } = collections;

  const context = {
    userId: interaction.user.id,
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    type: 'app_creation',
    data: {
      title,
      description,
      embedColor,
      thumbnailUrl: thumbnail || null,
      imageUrl: image || null,
      questions: [],
      config: {}
    },
    expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 min expiry
  };

  await dmContexts.updateOne(
    { userId: interaction.user.id, type: 'app_creation' },
    { $set: context },
    { upsert: true }
  );

  // Show configuration menu
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('app_config_category')
      .setLabel('Set Ticket Category')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📁'),
    new ButtonBuilder()
      .setCustomId('app_config_roles')
      .setLabel('Set Staff Roles')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👥'),
    new ButtonBuilder()
      .setCustomId('app_config_naming')
      .setLabel('Ticket Naming')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏷️')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('app_config_questions')
      .setLabel('Add Questions')
      .setStyle(ButtonStyle.Success)
      .setEmoji('❓'),
    new ButtonBuilder()
      .setCustomId('app_config_advanced')
      .setLabel('Advanced Settings')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️')
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('app_config_preview')
      .setLabel('Preview')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👁️'),
    new ButtonBuilder()
      .setCustomId('app_config_finish')
      .setLabel('Finish & Create')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId('app_config_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );

  await interaction.reply({
    content: '✅ **Basic configuration saved!**\n\nNow configure the required settings:',
    components: [row1, row2, row3],
    flags: [64]
  });
}

module.exports = { 
  handleCreateApplication,
  handleCreateBasicModal
};