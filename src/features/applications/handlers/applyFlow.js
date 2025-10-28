const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { createTicket } = require('../utils/ticketManager');
const { formatWelcomeEmbed } = require('../utils/applicationFormatter');
const { isBlacklisted, hasCooldown, getRemainingCooldown, formatCooldown } = require('../utils/permissions');

/**
 * Handle user clicking Apply button
 */
async function handleApplyButton({ interaction, collections }) {
  const { applicationPanels, applicationTickets } = collections;

  // Get panel
  const panel = await applicationPanels.findOne({
    guildId: interaction.guild.id,
    messageId: interaction.message.id
  });

  if (!panel || !panel.active) {
    return interaction.reply({
      content: '❌ This application panel is no longer active.',
      ephemeral: true
    });
  }

  // Check if blacklisted
  const blacklisted = await isBlacklisted({
    userId: interaction.user.id,
    guildId: interaction.guild.id,
    collections
  });

  if (blacklisted) {
    return interaction.reply({
      content: '❌ You are not eligible to apply at this time.',
      ephemeral: true
    });
  }

  // Check cooldown
  const onCooldown = await hasCooldown({
    userId: interaction.user.id,
    guildId: interaction.guild.id,
    panelId: panel._id.toString(),
    cooldownMs: panel.config.cooldownMs,
    collections
  });

  if (onCooldown) {
    const remaining = await getRemainingCooldown({
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      panelId: panel._id.toString(),
      cooldownMs: panel.config.cooldownMs,
      collections
    });

    return interaction.reply({
      content: `❌ You must wait **${formatCooldown(remaining)}** before applying again.`,
      ephemeral: true
    });
  }

  // Check for existing open ticket
  const existingTicket = await applicationTickets.findOne({
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    panelId: panel._id.toString(),
    status: { $in: ['open', 'pending'] }
  });

  if (existingTicket) {
    const channel = interaction.guild.channels.cache.get(existingTicket.ticketChannelId);
    if (channel) {
      return interaction.reply({
        content: `❌ You already have an open application! ${channel}`,
        ephemeral: true
      });
    }
  }

  // Create ticket
  await interaction.deferReply({ ephemeral: true });

  const result = await createTicket({
    guild: interaction.guild,
    user: interaction.user,
    panel,
    collections
  });

  if (result.error) {
    return interaction.editReply({ content: `❌ ${result.error}` });
  }

  const { ticket, channel } = result;

  // Send welcome message in ticket
  const welcomeEmbed = formatWelcomeEmbed(panel, interaction.user);

  const button = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`app_start:${ticket._id}`)
      .setLabel('Start Application')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📝')
  );

  await channel.send({
    content: `${interaction.user}`,
    embeds: [welcomeEmbed],
    components: [button]
  });

  // Notify staff if configured
  if (panel.config.notifyRoleId) {
    await channel.send({
      content: `<@&${panel.config.notifyRoleId}> New application started!`
    });
  }

  await interaction.editReply({
    content: `✅ Your application ticket has been created! ${channel}`
  });
}

/**
 * Handle starting the application (showing first question)
 */
async function handleStartApplication({ interaction, collections }) {
  const { applicationTickets, applicationPanels, dmContexts } = collections;

  const ticketId = interaction.customId.split(':')[1];

  const ticket = await applicationTickets.findOne({ _id: new (require('mongodb').ObjectId)(ticketId) });
  if (!ticket) {
    return interaction.reply({
      content: '❌ Ticket not found!',
      ephemeral: true
    });
  }

  // Only the applicant can start
  if (ticket.userId !== interaction.user.id) {
    return interaction.reply({
      content: '❌ Only the applicant can start the application!',
      ephemeral: true
    });
  }

  const panel = await applicationPanels.findOne({ _id: new (require('mongodb').ObjectId)(ticket.panelId) });
  if (!panel) {
    return interaction.reply({
      content: '❌ Panel configuration not found!',
      ephemeral: true
    });
  }

  // Initialize application context
  await dmContexts.updateOne(
    { userId: interaction.user.id, type: 'app_filling' },
    {
      $set: {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
        type: 'app_filling',
        data: {
          ticketId: ticketId,
          panelId: ticket.panelId,
          answers: [],
          currentQuestion: 0
        },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      }
    },
    { upsert: true }
  );

  // Show first question
  await showQuestion({ interaction, questionIndex: 0, panel, collections, isEdit: false });
}

/**
 * Show a question modal
 */
async function showQuestion({ interaction, questionIndex, panel, collections, isEdit }) {
  const question = panel.questions[questionIndex];

  if (!question) {
    return interaction.reply({
      content: '❌ Question not found!',
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`app_answer:${questionIndex}:${isEdit ? 'edit' : 'new'}`)
    .setTitle(`Question ${questionIndex + 1} of ${panel.questions.length}`);

  const input = new TextInputBuilder()
    .setCustomId('answer')
    .setLabel(question.text.substring(0, 45)) // Discord limit
    .setStyle(question.type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(question.required)
    .setMaxLength(question.maxLength || 1000);

  // If editing, pre-fill with existing answer
  if (isEdit) {
    const { dmContexts } = collections;
    const context = await dmContexts.findOne({
      userId: interaction.user.id,
      type: 'app_filling'
    });

    if (context && context.data.answers[questionIndex]) {
      input.setValue(context.data.answers[questionIndex].value);
    }
  }

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
}

/**
 * Handle answer submission
 */
async function handleAnswerSubmit({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  const [_, questionIndexStr, editMode] = interaction.customId.split(':');
  const questionIndex = parseInt(questionIndexStr);

  const answer = interaction.fields.getTextInputValue('answer');

  // Get context
  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_filling'
  });

  if (!context) {
    return interaction.reply({
      content: '❌ Application session expired. Please start over.',
      ephemeral: true
    });
  }

  const panel = await applicationPanels.findOne({
    _id: new (require('mongodb').ObjectId)(context.data.panelId)
  });

  // Save answer
  const answerDoc = {
    questionIndex,
    value: answer,
    answeredAt: new Date()
  };

  await dmContexts.updateOne(
    { userId: interaction.user.id, type: 'app_filling' },
    {
      $set: {
        [`data.answers.${questionIndex}`]: answerDoc,
        'data.currentQuestion': questionIndex + 1
      }
    }
  );

  // Check if this was the last question
  if (questionIndex + 1 >= panel.questions.length) {
    // Show review
    await showReview({ interaction, collections });
  } else {
    // Show next question button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_next:${questionIndex + 1}`)
        .setLabel(`Next Question (${questionIndex + 2}/${panel.questions.length})`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('➡️')
    );

    await interaction.reply({
      content: `✅ Answer saved! Click below to continue.`,
      components: [row],
      ephemeral: true
    });
  }
}

/**
 * Handle next question button
 */
async function handleNextQuestion({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  const questionIndex = parseInt(interaction.customId.split(':')[1]);

  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_filling'
  });

  if (!context) {
    return interaction.reply({
      content: '❌ Application session expired.',
      ephemeral: true
    });
  }

  const panel = await applicationPanels.findOne({
    _id: new (require('mongodb').ObjectId)(context.data.panelId)
  });

  await showQuestion({ interaction, questionIndex, panel, collections, isEdit: false });
}

/**
 * Show review screen
 */
async function showReview({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_filling'
  });

  if (!context) {
    return interaction.reply({
      content: '❌ Session expired.',
      ephemeral: true
    });
  }

  const panel = await applicationPanels.findOne({
    _id: new (require('mongodb').ObjectId)(context.data.panelId)
  });

  let reviewText = '**📋 Review Your Answers:**\n\n';

  for (let i = 0; i < panel.questions.length; i++) {
    const question = panel.questions[i];
    const answer = context.data.answers[i];

    reviewText += `**${i + 1}. ${question.text}**\n`;
    reviewText += `${answer?.value || '*Not answered*'}\n\n`;
  }

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('app_submit_final')
      .setLabel('Submit Application')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId('app_review_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('app_edit_answers')
      .setLabel('Edit Answers')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
  );

  await interaction.reply({
    content: reviewText.length > 2000 ? reviewText.substring(0, 1997) + '...' : reviewText,
    components: [row1, row2],
    ephemeral: true
  });
}

/**
 * Handle edit answers
 */
async function handleEditAnswers({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_filling'
  });

  if (!context) {
    return interaction.reply({
      content: '❌ Session expired.',
      ephemeral: true
    });
  }

  const panel = await applicationPanels.findOne({
    _id: new (require('mongodb').ObjectId)(context.data.panelId)
  });

  // Show question selector
  const options = panel.questions.slice(0, 25).map((q, i) => ({
    label: `Question ${i + 1}`,
    description: q.text.substring(0, 100),
    value: i.toString()
  }));

  const selectMenu = require('discord.js').StringSelectMenuBuilder;
  const row = new ActionRowBuilder().addComponents(
    new selectMenu()
      .setCustomId('app_select_edit_question')
      .setPlaceholder('Select question to edit')
      .addOptions(options)
  );

  await interaction.update({
    content: '✏️ **Select a question to edit:**',
    components: [row]
  });
}

/**
 * Handle edit question selection
 */
async function handleEditQuestionSelect({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  const questionIndex = parseInt(interaction.values[0]);

  const context = await dmContexts.findOne({
    userId: interaction.user.id,
    type: 'app_filling'
  });

  const panel = await applicationPanels.findOne({
    _id: new (require('mongodb').ObjectId)(context.data.panelId)
  });

  await showQuestion({ interaction, questionIndex, panel, collections, isEdit: true });
}

module.exports = {
  handleApplyButton,
  handleStartApplication,
  handleAnswerSubmit,
  handleNextQuestion,
  showReview,
  handleEditAnswers,
  handleEditQuestionSelect
};