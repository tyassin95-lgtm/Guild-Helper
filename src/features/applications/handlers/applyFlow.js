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
const { ObjectId } = require('mongodb');

/**
 * Handle user clicking Apply button
 */
async function handleApplyButton({ interaction, collections }) {
  const { applicationPanels, applicationTickets } = collections;

  try {
    // Get panel
    const panel = await applicationPanels.findOne({
      guildId: interaction.guild.id,
      messageId: interaction.message.id
    });

    if (!panel || !panel.active) {
      return interaction.reply({
        content: '❌ This application panel is no longer active.',
        flags: [64]
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
        flags: [64]
      });
    }

    // Check application limit - 1 active application per user across all panels
    const activeApplicationCount = await applicationTickets.countDocuments({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      status: { $in: ['open', 'pending'] }
    });

    if (activeApplicationCount >= 1) {
      const existingTicket = await applicationTickets.findOne({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        status: { $in: ['open', 'pending'] }
      });

      const channel = interaction.guild.channels.cache.get(existingTicket.ticketChannelId);
      return interaction.reply({
        content: `❌ You can only have 1 active application at a time. Please finish or close your current application first: ${channel ? channel : 'Check your tickets'}`,
        flags: [64]
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
        content: `❌ You must wait **${formatCooldown(remaining)}** before applying to this position again.`,
        flags: [64]
      });
    }

    // Create ticket
    await interaction.deferReply({ flags: [64] });

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
  } catch (error) {
    console.error('Error in handleApplyButton:', error);
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ An error occurred while creating your application. Please contact an administrator.'
      });
    } else {
      return interaction.reply({
        content: '❌ An error occurred while creating your application. Please contact an administrator.',
        flags: [64]
      });
    }
  }
}

/**
 * Handle starting the application (showing first question)
 */
async function handleStartApplication({ interaction, collections }) {
  const { applicationTickets, applicationPanels, dmContexts } = collections;

  try {
    const ticketId = interaction.customId.split(':')[1];

    const ticket = await applicationTickets.findOne({ _id: new ObjectId(ticketId) });
    if (!ticket) {
      return interaction.reply({
        content: '❌ Ticket not found!',
        flags: [64]
      });
    }

    // Only the applicant can start
    if (ticket.userId !== interaction.user.id) {
      return interaction.reply({
        content: '❌ Only the applicant can start the application!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(ticket.panelId) });
    if (!panel) {
      return interaction.reply({
        content: '❌ Panel configuration not found!',
        flags: [64]
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
            channelId: ticket.ticketChannelId,
            answers: [],
            currentBatch: 0
          },
          expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        }
      },
      { upsert: true }
    );

    // Show first batch of questions (up to 5)
    await showQuestionBatch({ interaction, batchIndex: 0, panel, collections });
  } catch (error) {
    console.error('Error in handleStartApplication:', error);
    return interaction.reply({
      content: '❌ An error occurred while starting the application. Please try again.',
      flags: [64]
    });
  }
}

/**
 * Show a batch of questions (up to 5 at once in a modal)
 */
async function showQuestionBatch({ interaction, batchIndex, panel, collections }) {
  try {
    const QUESTIONS_PER_BATCH = 5;
    const startIdx = batchIndex * QUESTIONS_PER_BATCH;
    const endIdx = Math.min(startIdx + QUESTIONS_PER_BATCH, panel.questions.length);
    const batchQuestions = panel.questions.slice(startIdx, endIdx);

    if (batchQuestions.length === 0) {
      return interaction.reply({
        content: '❌ No questions found!',
        flags: [64]
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`app_batch_answer:${batchIndex}`)
      .setTitle(`Questions ${startIdx + 1}-${endIdx} of ${panel.questions.length}`);

    // Add up to 5 questions to the modal
    for (let i = 0; i < batchQuestions.length; i++) {
      const question = batchQuestions[i];
      const questionIndex = startIdx + i;

      const input = new TextInputBuilder()
        .setCustomId(`question_${questionIndex}`)
        .setLabel(`${questionIndex + 1}. ${question.text.substring(0, 40)}${question.text.length > 40 ? '...' : ''}`)
        .setStyle(question.type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(question.required)
        .setMaxLength(question.maxLength || 1000);
        // FIXED: Removed placeholder so fields are empty

      // Pre-fill if editing
      const { dmContexts } = collections;
      const context = await dmContexts.findOne({
        userId: interaction.user.id,
        type: 'app_filling'
      });

      if (context && context.data.answers && context.data.answers[questionIndex]) {
        input.setValue(context.data.answers[questionIndex].value);
      }

      modal.addComponents(new ActionRowBuilder().addComponents(input));
    }

    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error in showQuestionBatch:', error);
    return interaction.reply({
      content: '❌ An error occurred while showing the questions.',
      flags: [64]
    });
  }
}

/**
 * Show a question modal (for editing individual questions)
 */
async function showQuestion({ interaction, questionIndex, panel, collections, isEdit }) {
  try {
    const question = panel.questions[questionIndex];

    if (!question) {
      return interaction.reply({
        content: '❌ Question not found!',
        flags: [64]
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
  } catch (error) {
    console.error('Error in showQuestion:', error);
    return interaction.reply({
      content: '❌ An error occurred while showing the question.',
      flags: [64]
    });
  }
}

/**
 * Handle batch answer submission
 */
async function handleBatchAnswerSubmit({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  try {
    const batchIndex = parseInt(interaction.customId.split(':')[1]);

    // Get context
    const context = await dmContexts.findOne({
      userId: interaction.user.id,
      type: 'app_filling'
    });

    if (!context) {
      return interaction.reply({
        content: '❌ Application session expired. Please start over.',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({
      _id: new ObjectId(context.data.panelId)
    });

    const QUESTIONS_PER_BATCH = 5;
    const startIdx = batchIndex * QUESTIONS_PER_BATCH;
    const endIdx = Math.min(startIdx + QUESTIONS_PER_BATCH, panel.questions.length);

    // Save all answers from this batch
    const answers = context.data.answers || [];
    
    for (let i = startIdx; i < endIdx; i++) {
      const fieldId = `question_${i}`;
      try {
        const answer = interaction.fields.getTextInputValue(fieldId);
        answers[i] = {
          questionIndex: i,
          value: answer,
          answeredAt: new Date()
        };
      } catch (err) {
        // Field might not exist if it wasn't required and left empty
        console.log(`Field ${fieldId} not found or empty`);
      }
    }

    await dmContexts.updateOne(
      { userId: interaction.user.id, type: 'app_filling' },
      {
        $set: {
          'data.answers': answers,
          'data.currentBatch': batchIndex + 1
        }
      }
    );

    // Check if there are more questions
    if (endIdx >= panel.questions.length) {
      // All questions answered, show review
      await showReview({ interaction, collections });
    } else {
      // Show next batch button
      const nextBatchStart = endIdx + 1;
      const nextBatchEnd = Math.min(nextBatchStart + QUESTIONS_PER_BATCH - 1, panel.questions.length);
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`app_next_batch:${batchIndex + 1}`)
          .setLabel(`Next Questions (${nextBatchStart}-${nextBatchEnd})`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('➡️')
      );

      await interaction.reply({
        content: `✅ **Answers saved!** (${endIdx}/${panel.questions.length} questions complete)`,
        components: [row],
        flags: [64]
      });
    }
  } catch (error) {
    console.error('Error in handleBatchAnswerSubmit:', error);
    return interaction.reply({
      content: '❌ An error occurred while saving your answers.',
      flags: [64]
    });
  }
}

/**
 * Handle answer submission (single question - for editing)
 */
async function handleAnswerSubmit({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  try {
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
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({
      _id: new ObjectId(context.data.panelId)
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
      // FIXED: Auto-advance to next question by showing "Next" button
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`app_next:${questionIndex + 1}`)
          .setLabel(`Next Question`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('➡️')
      );

      await interaction.reply({
        content: `✅ **Answer saved!** (${questionIndex + 1}/${panel.questions.length} complete)`,
        components: [row],
        flags: [64]
      });
    }
  } catch (error) {
    console.error('Error in handleAnswerSubmit:', error);
    return interaction.reply({
      content: '❌ An error occurred while saving your answer.',
      flags: [64]
    });
  }
}

/**
 * Handle next batch button
 */
async function handleNextBatch({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  try {
    const batchIndex = parseInt(interaction.customId.split(':')[1]);

    const context = await dmContexts.findOne({
      userId: interaction.user.id,
      type: 'app_filling'
    });

    if (!context) {
      return interaction.reply({
        content: '❌ Application session expired.',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({
      _id: new ObjectId(context.data.panelId)
    });

    await showQuestionBatch({ interaction, batchIndex, panel, collections });
  } catch (error) {
    console.error('Error in handleNextBatch:', error);
    return interaction.reply({
      content: '❌ An error occurred. Please try again.',
      flags: [64]
    });
  }
}

/**
 * Handle next question button (legacy - for single question editing)
 */
async function handleNextQuestion({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  try {
    const questionIndex = parseInt(interaction.customId.split(':')[1]);

    const context = await dmContexts.findOne({
      userId: interaction.user.id,
      type: 'app_filling'
    });

    if (!context) {
      return interaction.reply({
        content: '❌ Application session expired.',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({
      _id: new ObjectId(context.data.panelId)
    });

    await showQuestion({ interaction, questionIndex, panel, collections, isEdit: false });
  } catch (error) {
    console.error('Error in handleNextQuestion:', error);
    return interaction.reply({
      content: '❌ An error occurred. Please try again.',
      flags: [64]
    });
  }
}

/**
 * Show review screen
 */
async function showReview({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  try {
    const context = await dmContexts.findOne({
      userId: interaction.user.id,
      type: 'app_filling'
    });

    if (!context) {
      return interaction.reply({
        content: '❌ Session expired.',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({
      _id: new ObjectId(context.data.panelId)
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
      flags: [64]
    });
  } catch (error) {
    console.error('Error in showReview:', error);
    return interaction.reply({
      content: '❌ An error occurred while showing the review.',
      flags: [64]
    });
  }
}

/**
 * Handle edit answers
 */
async function handleEditAnswers({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  try {
    const context = await dmContexts.findOne({
      userId: interaction.user.id,
      type: 'app_filling'
    });

    if (!context) {
      return interaction.reply({
        content: '❌ Session expired.',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({
      _id: new ObjectId(context.data.panelId)
    });

    const QUESTIONS_PER_BATCH = 5;
    const totalBatches = Math.ceil(panel.questions.length / QUESTIONS_PER_BATCH);

    // Show batch selector
    const options = [];
    for (let i = 0; i < totalBatches; i++) {
      const startIdx = i * QUESTIONS_PER_BATCH + 1;
      const endIdx = Math.min((i + 1) * QUESTIONS_PER_BATCH, panel.questions.length);
      
      options.push({
        label: `Questions ${startIdx}-${endIdx}`,
        description: `Edit questions ${startIdx} through ${endIdx}`,
        value: i.toString()
      });
    }

    const { StringSelectMenuBuilder } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('app_select_edit_batch')
        .setPlaceholder('Select question batch to edit')
        .addOptions(options)
    );

    await interaction.update({
      content: '✏️ **Select a batch of questions to edit:**',
      components: [row]
    });
  } catch (error) {
    console.error('Error in handleEditAnswers:', error);
    return interaction.reply({
      content: '❌ An error occurred.',
      flags: [64]
    });
  }
}

/**
 * Handle edit batch selection
 */
async function handleEditBatchSelect({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  try {
    const batchIndex = parseInt(interaction.values[0]);

    const context = await dmContexts.findOne({
      userId: interaction.user.id,
      type: 'app_filling'
    });

    const panel = await applicationPanels.findOne({
      _id: new ObjectId(context.data.panelId)
    });

    await showQuestionBatch({ interaction, batchIndex, panel, collections });
  } catch (error) {
    console.error('Error in handleEditBatchSelect:', error);
    return interaction.reply({
      content: '❌ An error occurred.',
      flags: [64]
    });
  }
}

/**
 * Handle edit question selection (legacy - kept for compatibility)
 */
async function handleEditQuestionSelect({ interaction, collections }) {
  const { dmContexts, applicationPanels } = collections;

  try {
    const questionIndex = parseInt(interaction.values[0]);

    const context = await dmContexts.findOne({
      userId: interaction.user.id,
      type: 'app_filling'
    });

    const panel = await applicationPanels.findOne({
      _id: new ObjectId(context.data.panelId)
    });

    await showQuestion({ interaction, questionIndex, panel, collections, isEdit: true });
  } catch (error) {
    console.error('Error in handleEditQuestionSelect:', error);
    return interaction.reply({
      content: '❌ An error occurred.',
      flags: [64]
    });
  }
}

module.exports = {
  handleApplyButton,
  handleStartApplication,
  handleBatchAnswerSubmit,
  handleAnswerSubmit,
  handleNextBatch,
  handleNextQuestion,
  showReview,
  handleEditAnswers,
  handleEditBatchSelect,
  handleEditQuestionSelect
};