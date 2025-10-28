const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require('discord.js');
const { ObjectId } = require('mongodb');
const { formatResponseEmbed } = require('../utils/applicationFormatter');
const { updateTicketActivity } = require('../utils/ticketManager');
const { isStaff } = require('../utils/permissions');

/**
 * Handle final submission of application
 */
async function handleFinalSubmit({ interaction, collections }) {
  const { dmContexts, applicationPanels, applicationTickets, applicationResponses } = collections;

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

  await interaction.deferReply({ ephemeral: true });

  const panel = await applicationPanels.findOne({
    _id: ObjectId(context.data.panelId)
  });

  const ticket = await applicationTickets.findOne({
    _id: ObjectId(context.data.ticketId)
  });

  // Create response document
  const responseDoc = {
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    ticketId: context.data.ticketId,
    panelId: context.data.panelId,
    panelTitle: panel.title,
    answers: context.data.answers,
    status: 'pending',
    submittedAt: new Date()
  };

  await applicationResponses.insertOne(responseDoc);

  // Update ticket status
  await applicationTickets.updateOne(
    { _id: ObjectId(context.data.ticketId) },
    {
      $set: {
        status: 'pending',
        lastActivity: new Date()
      }
    }
  );

  // Send application to ticket channel
  const channel = interaction.guild.channels.cache.get(ticket.ticketChannelId);

  if (channel) {
    const embed = formatResponseEmbed(responseDoc, interaction.user, panel);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_accept:${responseDoc._id}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`app_reject:${responseDoc._id}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌'),
      new ButtonBuilder()
        .setCustomId(`app_interview:${responseDoc._id}`)
        .setLabel('Request Interview')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('💬')
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_add_note:${ticket._id}`)
        .setLabel('Add Note')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setCustomId(`app_view_notes:${ticket._id}`)
        .setLabel('View Notes')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👁️'),
      new ButtonBuilder()
        .setCustomId(`app_close:${ticket._id}`)
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔒')
    );

    await channel.send({
      content: '📋 **New Application Submitted!**',
      embeds: [embed],
      components: [row1, row2]
    });

    // Disable the start button
    const messages = await channel.messages.fetch({ limit: 10 });
    const welcomeMsg = messages.find(m => 
      m.components.some(row => 
        row.components.some(c => c.customId?.startsWith('app_start:'))
      )
    );

    if (welcomeMsg) {
      const disabledButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('app_start_disabled')
          .setLabel('Application Submitted')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
          .setDisabled(true)
      );

      await welcomeMsg.edit({ components: [disabledButton] });
    }
  }

  // Clean up context
  await dmContexts.deleteOne({ userId: interaction.user.id, type: 'app_filling' });

  await interaction.editReply({
    content: '✅ **Application submitted successfully!**\n\nStaff will review your application and respond soon.'
  });
}

/**
 * Handle accept button
 */
async function handleAccept({ interaction, collections }) {
  const { applicationResponses, applicationPanels, applicationTickets } = collections;

  const responseId = interaction.customId.split(':')[1];

  const response = await applicationResponses.findOne({ _id: ObjectId(responseId) });
  if (!response) {
    return interaction.reply({
      content: '❌ Application not found!',
      ephemeral: true
    });
  }

  const panel = await applicationPanels.findOne({ _id: ObjectId(response.panelId) });

  // Check if user is staff
  if (!isStaff(interaction.member, panel)) {
    return interaction.reply({
      content: '❌ You do not have permission to review applications!',
      ephemeral: true
    });
  }

  // Show confirmation modal with optional message
  const modal = new ModalBuilder()
    .setCustomId(`app_accept_confirm:${responseId}`)
    .setTitle('Accept Application');

  const messageInput = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Custom Message (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Leave blank to use default acceptance message...')
    .setRequired(false)
    .setMaxLength(1000);

  const roleInput = new TextInputBuilder()
    .setCustomId('role')
    .setLabel('Role ID to assign (optional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Leave blank to not assign a role')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(messageInput),
    new ActionRowBuilder().addComponents(roleInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handle accept confirmation
 */
async function handleAcceptConfirm({ interaction, collections }) {
  const { applicationResponses, applicationPanels, applicationTickets } = collections;

  const responseId = interaction.customId.split(':')[1];

  await interaction.deferReply({ ephemeral: true });

  const customMessage = interaction.fields.getTextInputValue('message');
  const roleId = interaction.fields.getTextInputValue('role');

  const response = await applicationResponses.findOne({ _id: ObjectId(responseId) });
  const panel = await applicationPanels.findOne({ _id: ObjectId(response.panelId) });
  const ticket = await applicationTickets.findOne({ _id: ObjectId(response.ticketId) });

  // Update response
  await applicationResponses.updateOne(
    { _id: ObjectId(responseId) },
    {
      $set: {
        status: 'accepted',
        reviewedBy: interaction.user.id,
        reviewedAt: new Date()
      }
    }
  );

  // Update ticket
  await applicationTickets.updateOne(
    { _id: ObjectId(response.ticketId) },
    {
      $set: {
        status: 'accepted',
        lastActivity: new Date()
      }
    }
  );

  const message = customMessage || panel.config.acceptanceMessage;

  // Send acceptance message in ticket
  const channel = interaction.guild.channels.cache.get(ticket.ticketChannelId);
  if (channel) {
    const acceptEmbed = new EmbedBuilder()
      .setTitle('✅ Application Accepted!')
      .setDescription(message)
      .setColor(0x57F287)
      .setTimestamp();

    await channel.send({
      content: `<@${response.userId}>`,
      embeds: [acceptEmbed]
    });

    // Update the review message
    const reviewMsg = interaction.message;
    if (reviewMsg) {
      const updatedEmbed = EmbedBuilder.from(reviewMsg.embeds[0])
        .setColor(0x57F287)
        .addFields({
          name: '✅ Decision',
          value: `Accepted by ${interaction.user.tag}`,
          inline: false
        });

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('app_accepted_disabled')
          .setLabel('Accepted')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
          .setDisabled(true)
      );

      await reviewMsg.edit({
        embeds: [updatedEmbed],
        components: [disabledRow]
      });
    }
  }

  // Assign role if specified
  if (roleId) {
    try {
      const member = await interaction.guild.members.fetch(response.userId);
      const role = interaction.guild.roles.cache.get(roleId);

      if (member && role) {
        await member.roles.add(role);
        await interaction.editReply({
          content: `✅ Application accepted and role <@&${roleId}> assigned!`
        });
      } else {
        await interaction.editReply({
          content: '✅ Application accepted! (Role not found or member left)'
        });
      }
    } catch (err) {
      console.error('Error assigning role:', err);
      await interaction.editReply({
        content: '✅ Application accepted! (Failed to assign role)'
      });
    }
  } else {
    await interaction.editReply({
      content: '✅ Application accepted!'
    });
  }

  // Send DM if configured
  if (panel.config.notifyUserOnDecision) {
    try {
      const user = await interaction.client.users.fetch(response.userId);
      const dmEmbed = new EmbedBuilder()
        .setTitle(`✅ ${panel.title} - Application Accepted!`)
        .setDescription(message)
        .setColor(0x57F287)
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] });
    } catch (err) {
      console.error('Failed to send DM:', err);
    }
  }
}

/**
 * Handle reject button
 */
async function handleReject({ interaction, collections }) {
  const { applicationResponses, applicationPanels } = collections;

  const responseId = interaction.customId.split(':')[1];

  const response = await applicationResponses.findOne({ _id: ObjectId(responseId) });
  if (!response) {
    return interaction.reply({
      content: '❌ Application not found!',
      ephemeral: true
    });
  }

  const panel = await applicationPanels.findOne({ _id: ObjectId(response.panelId) });

  if (!isStaff(interaction.member, panel)) {
    return interaction.reply({
      content: '❌ You do not have permission to review applications!',
      ephemeral: true
    });
  }

  // Show rejection modal
  const modal = new ModalBuilder()
    .setCustomId(`app_reject_confirm:${responseId}`)
    .setTitle('Reject Application');

  const messageInput = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Custom Message (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Leave blank to use default rejection message...')
    .setRequired(false)
    .setMaxLength(1000);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Internal Reason (staff only)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Why was this rejected? (not sent to applicant)')
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(messageInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handle reject confirmation
 */
async function handleRejectConfirm({ interaction, collections }) {
  const { applicationResponses, applicationPanels, applicationTickets, applicationNotes } = collections;

  const responseId = interaction.customId.split(':')[1];

  await interaction.deferReply({ ephemeral: true });

  const customMessage = interaction.fields.getTextInputValue('message');
  const internalReason = interaction.fields.getTextInputValue('reason');

  const response = await applicationResponses.findOne({ _id: ObjectId(responseId) });
  const panel = await applicationPanels.findOne({ _id: ObjectId(response.panelId) });
  const ticket = await applicationTickets.findOne({ _id: ObjectId(response.ticketId) });

  // Update response
  await applicationResponses.updateOne(
    { _id: ObjectId(responseId) },
    {
      $set: {
        status: 'rejected',
        reviewedBy: interaction.user.id,
        reviewedAt: new Date(),
        rejectionReason: internalReason || null
      }
    }
  );

  // Update ticket
  await applicationTickets.updateOne(
    { _id: ObjectId(response.ticketId) },
    {
      $set: {
        status: 'rejected',
        lastActivity: new Date()
      }
    }
  );

  // Add internal note if reason provided
  if (internalReason) {
    await applicationNotes.insertOne({
      guildId: interaction.guild.id,
      ticketId: response.ticketId,
      staffId: interaction.user.id,
      noteText: `**Rejection Reason:** ${internalReason}`,
      createdAt: new Date()
    });
  }

  const message = customMessage || panel.config.rejectionMessage;

  // Send rejection message in ticket
  const channel = interaction.guild.channels.cache.get(ticket.ticketChannelId);
  if (channel) {
    const rejectEmbed = new EmbedBuilder()
      .setTitle('❌ Application Rejected')
      .setDescription(message)
      .setColor(0xED4245)
      .setTimestamp();

    if (panel.config.cooldownMs && panel.config.cooldownMs > 0) {
      const days = Math.floor(panel.config.cooldownMs / (24 * 60 * 60 * 1000));
      rejectEmbed.setFooter({ text: `You may reapply in ${days} days` });
    }

    await channel.send({
      content: `<@${response.userId}>`,
      embeds: [rejectEmbed]
    });

    // Update review message
    const reviewMsg = interaction.message;
    if (reviewMsg) {
      const updatedEmbed = EmbedBuilder.from(reviewMsg.embeds[0])
        .setColor(0xED4245)
        .addFields({
          name: '❌ Decision',
          value: `Rejected by ${interaction.user.tag}`,
          inline: false
        });

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('app_rejected_disabled')
          .setLabel('Rejected')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
          .setDisabled(true)
      );

      await reviewMsg.edit({
        embeds: [updatedEmbed],
        components: [disabledRow]
      });
    }
  }

  await interaction.editReply({
    content: '✅ Application rejected!'
  });

  // Send DM if configured
  if (panel.config.notifyUserOnDecision) {
    try {
      const user = await interaction.client.users.fetch(response.userId);
      const dmEmbed = new EmbedBuilder()
        .setTitle(`${panel.title} - Application Update`)
        .setDescription(message)
        .setColor(0xED4245)
        .setTimestamp();

      if (panel.config.cooldownMs && panel.config.cooldownMs > 0) {
        const days = Math.floor(panel.config.cooldownMs / (24 * 60 * 60 * 1000));
        dmEmbed.setFooter({ text: `You may reapply in ${days} days` });
      }

      await user.send({ embeds: [dmEmbed] });
    } catch (err) {
      console.error('Failed to send DM:', err);
    }
  }
}

/**
 * Handle interview request
 */
async function handleInterview({ interaction, collections }) {
  const { applicationTickets } = collections;

  const responseId = interaction.customId.split(':')[1];

  const modal = new ModalBuilder()
    .setCustomId(`app_interview_msg:${responseId}`)
    .setTitle('Request Interview');

  const messageInput = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Message to Applicant')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('We would like to schedule an interview...')
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

  await interaction.showModal(modal);
}

/**
 * Handle interview message
 */
async function handleInterviewMessage({ interaction, collections }) {
  const { applicationResponses, applicationTickets } = collections;

  const responseId = interaction.customId.split(':')[1];
  const message = interaction.fields.getTextInputValue('message');

  const response = await applicationResponses.findOne({ _id: ObjectId(responseId) });
  const ticket = await applicationTickets.findOne({ _id: ObjectId(response.ticketId) });

  const channel = interaction.guild.channels.cache.get(ticket.ticketChannelId);
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle('💬 Interview Request')
      .setDescription(message)
      .setColor(0x5865F2)
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    await channel.send({
      content: `<@${response.userId}>`,
      embeds: [embed]
    });
  }

  await updateTicketActivity({ ticketChannelId: ticket.ticketChannelId, collections });

  await interaction.reply({
    content: '✅ Interview request sent!',
    ephemeral: true
  });
}

module.exports = {
  handleFinalSubmit,
  handleAccept,
  handleAcceptConfirm,
  handleReject,
  handleRejectConfirm,
  handleInterview,
  handleInterviewMessage
};