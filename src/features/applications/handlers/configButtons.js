const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { formatPanelEmbed } = require('../utils/applicationFormatter');
const { ObjectId } = require('mongodb');

/**
 * Handle ticket category selection
 */
async function handleConfigCategory({ interaction, collections }) {
  const { dmContexts } = collections;

  // Get all categories in guild
  const categories = interaction.guild.channels.cache.filter(
    c => c.type === ChannelType.GuildCategory
  );

  if (categories.size === 0) {
    return interaction.reply({
      content: '❌ No categories found! Please create a category first.',
      flags: [64]
    });
  }

  const options = categories.map(cat => ({
    label: cat.name,
    value: cat.id,
    description: `${cat.children.cache.size} channels`
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('app_select_category')
    .setPlaceholder('Select ticket category')
    .addOptions(options.slice(0, 25)); // Discord limit

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({
    content: '📁 **Select the category where application tickets will be created:**',
    components: [row],
    flags: [64]
  });
}

/**
 * Handle category selection
 */
async function handleSelectCategory({ interaction, collections }) {
  const { dmContexts } = collections;
  const categoryId = interaction.values[0];

  await dmContexts.updateOne(
    { userId: interaction.user.id, type: 'app_creation' },
    { $set: { 'data.config.ticketCategoryId': categoryId } }
  );

  const category = interaction.guild.channels.cache.get(categoryId);

  await interaction.update({
    content: `✅ **Ticket category set to:** ${category.name}\n\nContinue with other settings or finish.`,
    components: []
  });
}

/**
 * Handle staff roles configuration
 */
async function handleConfigRoles({ interaction, collections }) {
  const row = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('app_select_roles')
      .setPlaceholder('Select staff roles (can view tickets)')
      .setMinValues(1)
      .setMaxValues(10)
  );

  await interaction.reply({
    content: '👥 **Select roles that should have access to application tickets:**\n*These roles will be able to view and respond to applications.*',
    components: [row],
    flags: [64]
  });
}

/**
 * Handle role selection
 */
async function handleSelectRoles({ interaction, collections }) {
  const { dmContexts } = collections;
  const roleIds = interaction.values;

  await dmContexts.updateOne(
    { userId: interaction.user.id, type: 'app_creation' },
    { $set: { 'data.config.staffRoleIds': roleIds } }
  );

  const roleNames = roleIds.map(id => {
    const role = interaction.guild.roles.cache.get(id);
    return role ? role.name : 'Unknown';
  }).join(', ');

  await interaction.update({
    content: `✅ **Staff roles set to:** ${roleNames}\n\nContinue with other settings or finish.`,
    components: []
  });
}

/**
 * Handle ticket naming configuration
 */
async function handleConfigNaming({ interaction, collections }) {
  const modal = new ModalBuilder()
    .setCustomId('app_modal_naming')
    .setTitle('Ticket Naming Format');

  const formatInput = new TextInputBuilder()
    .setCustomId('format')
    .setLabel('Ticket Name Format')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('application-{username}-{number}')
    .setValue('application-{username}-{number}')
    .setRequired(true)
    .setMaxLength(50);

  const helpText = new TextInputBuilder()
    .setCustomId('help')
    .setLabel('Available placeholders:')
    .setStyle(TextInputStyle.Paragraph)
    .setValue('{username} - User\'s username\n{displayName} - User\'s display name\n{number} - Sequential number (0001, 0002, etc.)')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(formatInput),
    new ActionRowBuilder().addComponents(helpText)
  );

  await interaction.showModal(modal);
}

/**
 * Handle naming modal submission
 */
async function handleNamingModal({ interaction, collections }) {
  const { dmContexts } = collections;
  const format = interaction.fields.getTextInputValue('format');

  await dmContexts.updateOne(
    { userId: interaction.user.id, type: 'app_creation' },
    { $set: { 'data.config.ticketNameFormat': format } }
  );

  await interaction.reply({
    content: `✅ **Ticket naming format set to:** \`${format}\`\n\nExample: \`${format.replace('{username}', 'johndoe').replace('{displayName}', 'JohnDoe').replace('{number}', '0042')}\``,
    flags: [64]
  });
}

/**
 * Handle add questions
 */
async function handleConfigQuestions({ interaction, collections }) {
  const { dmContexts } = collections;

  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_creation'
  });

  if (!context) {
    return interaction.reply({
      content: '❌ Configuration session expired. Please start over.',
      flags: [64]
    });
  }

  const currentCount = context.data.questions?.length || 0;

  if (currentCount >= 15) {
    return interaction.reply({
      content: '❌ Maximum of 15 questions reached!',
      flags: [64]
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('app_modal_question')
    .setTitle(`Add Question ${currentCount + 1}`);

  const questionInput = new TextInputBuilder()
    .setCustomId('question')
    .setLabel('Question Text')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('What is your in-game experience?')
    .setRequired(true)
    .setMaxLength(200);

  const typeInput = new TextInputBuilder()
    .setCustomId('type')
    .setLabel('Input Type')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('short, paragraph, or select')
    .setValue('short')
    .setRequired(true);

  const requiredInput = new TextInputBuilder()
    .setCustomId('required')
    .setLabel('Required? (yes/no)')
    .setStyle(TextInputStyle.Short)
    .setValue('yes')
    .setRequired(true);

  const maxLengthInput = new TextInputBuilder()
    .setCustomId('maxlength')
    .setLabel('Max Characters (for text input)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 500')
    .setValue('1000')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(questionInput),
    new ActionRowBuilder().addComponents(typeInput),
    new ActionRowBuilder().addComponents(requiredInput),
    new ActionRowBuilder().addComponents(maxLengthInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handle question modal submission
 */
async function handleQuestionModal({ interaction, collections }) {
  const { dmContexts } = collections;

  const questionText = interaction.fields.getTextInputValue('question');
  const type = interaction.fields.getTextInputValue('type').toLowerCase();
  const required = interaction.fields.getTextInputValue('required').toLowerCase() === 'yes';
  const maxLengthStr = interaction.fields.getTextInputValue('maxlength');

  if (!['short', 'paragraph', 'select'].includes(type)) {
    return interaction.reply({
      content: '❌ Invalid type! Must be: short, paragraph, or select',
      flags: [64]
    });
  }

  const maxLength = maxLengthStr ? parseInt(maxLengthStr) : (type === 'short' ? 200 : 1000);

  const question = {
    text: questionText,
    type,
    required,
    maxLength,
    options: [] // For select type, will be added later if needed
  };

  await dmContexts.updateOne(
    { userId: interaction.user.id, type: 'app_creation' },
    { $push: { 'data.questions': question } }
  );

  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_creation'
  });

  const questionCount = context.data.questions.length;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('app_config_questions')
      .setLabel('Add Another Question')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕')
      .setDisabled(questionCount >= 15),
    new ButtonBuilder()
      .setCustomId('app_question_remove_last')
      .setLabel('Remove Last')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️')
      .setDisabled(questionCount === 0),
    new ButtonBuilder()
      .setCustomId('app_config_finish')
      .setLabel('Done with Questions')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅')
  );

  await interaction.reply({
    content: `✅ **Question ${questionCount} added!**\n\n**Current questions:**\n${context.data.questions.map((q, i) => `${i + 1}. ${q.text} (${q.type}${q.required ? ', required' : ''})`).join('\n')}`,
    components: [row],
    flags: [64]
  });
}

/**
 * Remove last question
 */
async function handleRemoveLastQuestion({ interaction, collections }) {
  const { dmContexts } = collections;

  await dmContexts.updateOne(
    { userId: interaction.user.id, type: 'app_creation' },
    { $pop: { 'data.questions': 1 } }
  );

  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_creation'
  });

  const questionCount = context.data.questions?.length || 0;

  await interaction.update({
    content: `✅ **Last question removed!**\n\n**Remaining questions:** ${questionCount}`,
    components: []
  });
}

/**
 * Handle advanced settings
 */
async function handleConfigAdvanced({ interaction, collections }) {
  const modal = new ModalBuilder()
    .setCustomId('app_modal_advanced')
    .setTitle('Advanced Settings');

  const cooldownInput = new TextInputBuilder()
    .setCustomId('cooldown')
    .setLabel('Cooldown Days (after rejection)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 7 (0 for no cooldown)')
    .setValue('7')
    .setRequired(false);

  const roleIdInput = new TextInputBuilder()
    .setCustomId('roleid')
    .setLabel('Role ID to assign on acceptance')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Right-click role > Copy ID (leave blank for none)')
    .setRequired(false);

  const acceptMsgInput = new TextInputBuilder()
    .setCustomId('acceptmsg')
    .setLabel('Acceptance Message')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Congratulations! Your application has been accepted...')
    .setRequired(false);

  const rejectMsgInput = new TextInputBuilder()
    .setCustomId('rejectmsg')
    .setLabel('Rejection Message')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Thank you for applying. Unfortunately...')
    .setRequired(false);

  const notifyInput = new TextInputBuilder()
    .setCustomId('notify')
    .setLabel('Notify User via DM? (yes/no)')
    .setStyle(TextInputStyle.Short)
    .setValue('yes')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(cooldownInput),
    new ActionRowBuilder().addComponents(roleIdInput),
    new ActionRowBuilder().addComponents(acceptMsgInput),
    new ActionRowBuilder().addComponents(rejectMsgInput),
    new ActionRowBuilder().addComponents(notifyInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handle advanced settings modal
 */
async function handleAdvancedModal({ interaction, collections }) {
  const { dmContexts } = collections;

  const cooldownDays = parseInt(interaction.fields.getTextInputValue('cooldown')) || 0;
  const roleId = interaction.fields.getTextInputValue('roleid') || null;
  const acceptMsg = interaction.fields.getTextInputValue('acceptmsg') || 
    'Congratulations! Your application has been accepted. Welcome to the guild!';
  const rejectMsg = interaction.fields.getTextInputValue('rejectmsg') || 
    'Thank you for your interest. Unfortunately, your application was not accepted at this time.';
  const notify = interaction.fields.getTextInputValue('notify').toLowerCase() === 'yes';

  await dmContexts.updateOne(
    { userId: interaction.user.id, type: 'app_creation' },
    {
      $set: {
        'data.config.cooldownMs': cooldownDays * 24 * 60 * 60 * 1000,
        'data.config.acceptRoleId': roleId,
        'data.config.acceptanceMessage': acceptMsg,
        'data.config.rejectionMessage': rejectMsg,
        'data.config.notifyUserOnDecision': notify
      }
    }
  );

  await interaction.reply({
    content: '✅ **Advanced settings saved!**\n' +
      `• Cooldown: ${cooldownDays} days\n` +
      `• Role on acceptance: ${roleId ? `<@&${roleId}>` : 'None'}\n` +
      `• DM notifications: ${notify ? 'Enabled' : 'Disabled'}`,
    flags: [64]
  });
}

/**
 * Handle preview
 */
async function handleConfigPreview({ interaction, collections }) {
  const { dmContexts } = collections;

  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_creation'
  });

  if (!context) {
    return interaction.reply({
      content: '❌ Configuration session expired.',
      flags: [64]
    });
  }

  const panel = context.data;
  const embed = formatPanelEmbed(panel);

  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('app_apply_preview')
      .setLabel('Apply')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝')
      .setDisabled(true)
  );

  await interaction.reply({
    content: '👁️ **Preview of your application panel:**',
    embeds: [embed],
    components: [button],
    flags: [64]
  });
}

/**
 * Handle finish and create panel
 */
async function handleConfigFinish({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_creation'
  });

  if (!context) {
    return interaction.reply({
      content: '❌ Configuration session expired.',
      flags: [64]
    });
  }

  const panel = context.data;

  // Validate required fields
  if (!panel.config?.ticketCategoryId) {
    return interaction.reply({
      content: '❌ Please set the ticket category first!',
      flags: [64]
    });
  }

  if (!panel.config?.staffRoleIds || panel.config.staffRoleIds.length === 0) {
    return interaction.reply({
      content: '❌ Please set at least one staff role!',
      flags: [64]
    });
  }

  if (!panel.questions || panel.questions.length === 0) {
    return interaction.reply({
      content: '❌ Please add at least one question!',
      flags: [64]
    });
  }

  // Set defaults
  if (!panel.config.ticketNameFormat) {
    panel.config.ticketNameFormat = 'application-{username}-{number}';
  }

  if (!panel.config.acceptanceMessage) {
    panel.config.acceptanceMessage = 'Congratulations! Your application has been accepted. Welcome!';
  }

  if (!panel.config.rejectionMessage) {
    panel.config.rejectionMessage = 'Thank you for applying. Unfortunately, your application was not accepted at this time.';
  }

  if (panel.config.notifyUserOnDecision === undefined) {
    panel.config.notifyUserOnDecision = true;
  }

  // Create panel in channel
  await interaction.deferReply({ flags: [64] });

  const embed = formatPanelEmbed(panel);

  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('app_apply')
      .setLabel('Apply')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝')
  );

  const message = await interaction.channel.send({
    embeds: [embed],
    components: [button]
  });

  // Save panel to database
  const panelDoc = {
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    messageId: message.id,
    title: panel.title,
    description: panel.description,
    embedColor: panel.embedColor,
    thumbnailUrl: panel.thumbnailUrl,
    imageUrl: panel.imageUrl,
    questions: panel.questions,
    config: panel.config,
    active: true,
    createdBy: interaction.user.id,
    createdAt: new Date()
  };

  await applicationPanels.insertOne(panelDoc);

  // Clean up context
  await dmContexts.deleteOne({ userId: interaction.user.id, type: 'app_creation' });

  await interaction.editReply({
    content: `✅ **Application panel created successfully!**\n\nUsers can now click the "Apply" button to start their application.`
  });
}

/**
 * Handle cancel
 */
async function handleConfigCancel({ interaction, collections }) {
  const { dmContexts } = collections;

  await dmContexts.deleteOne({ userId: interaction.user.id, type: 'app_creation' });

  await interaction.update({
    content: '❌ Application panel creation cancelled.',
    components: []
  });
}

module.exports = {
  handleConfigCategory,
  handleSelectCategory,
  handleConfigRoles,
  handleSelectRoles,
  handleConfigNaming,
  handleNamingModal,
  handleConfigQuestions,
  handleQuestionModal,
  handleRemoveLastQuestion,
  handleConfigAdvanced,
  handleAdvancedModal,
  handleConfigPreview,
  handleConfigFinish,
  handleConfigCancel
};