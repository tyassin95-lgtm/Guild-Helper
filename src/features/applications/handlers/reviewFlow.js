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

    await interaction.deferReply({ flags: [64] });

    const panel = await applicationPanels.findOne({
      _id: new ObjectId(context.data.panelId)
    });

    const ticket = await applicationTickets.findOne({
      _id: new ObjectId(context.data.ticketId)
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
      { _id: new ObjectId(context.data.ticketId) },
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

      // FIXED: Removed interview button
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
          .setEmoji('❌')
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
  } catch (error) {
    console.error('Error in handleFinalSubmit:', error);
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ An error occurred while submitting your application.'
      });
    } else {
      return interaction.reply({
        content: '❌ An error occurred while submitting your application.',
        flags: [64]
      });
    }
  }
}

/**
 * Handle accept button
 */
async function handleAccept({ interaction, collections }) {
  const { applicationResponses, applicationPanels } = collections;

  try {
    const responseId = interaction.customId.split(':')[1];

    const response = await applicationResponses.findOne({ _id: new ObjectId(responseId) });
    if (!response) {
      return interaction.reply({
        content: '❌ Application not found!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(response.panelId) });

    // Check if user is staff
    if (!isStaff(interaction.member, panel)) {
      return interaction.reply({
        content: '❌ You do not have permission to review applications!',
        flags: [64]
      });
    }

    // Show simple accept options
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`app_accept_message:${responseId}`)
        .setLabel('Accept with Custom Message')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✉️'),
      new ButtonBuilder()
        .setCustomId(`app_accept_default:${responseId}`)
        .setLabel('Accept with Default Message')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

    const roleText = panel.config.acceptRoleId 
      ? `\n\nRole <@&${panel.config.acceptRoleId}> will be assigned automatically.`
      : '\n\nNo role will be assigned.';

    await interaction.reply({
      content: '**Accept Application**' + roleText + '\n\nChoose how to proceed:',
      components: [buttons],
      flags: [64]
    });
  } catch (error) {
    console.error('Error in handleAccept:', error);
    return interaction.reply({
      content: '❌ An error occurred.',
      flags: [64]
    });
  }
}

/**
 * Handle accept with custom message button
 */
async function handleAcceptWithMessage({ interaction, collections }) {
  const responseId = interaction.customId.split(':')[1];

  const modal = new ModalBuilder()
    .setCustomId(`app_accept_confirm:${responseId}`)
    .setTitle('Accept Application');

  const messageInput = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Custom Message')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter your acceptance message...')
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(messageInput)
  );

  await interaction.showModal(modal);
}

/**
 * Handle accept with default message button
 */
async function handleAcceptDefault({ interaction, collections }) {
  const { applicationPanels, applicationResponses } = collections;

  const responseId = interaction.customId.split(':')[1];

  // Get the panel to get the pre-configured role
  const response = await applicationResponses.findOne({ _id: new ObjectId(responseId) });
  const panel = await applicationPanels.findOne({ _id: new ObjectId(response.panelId) });

  await interaction.deferReply({ flags: [64] });

  // Use the role from panel config
  const roleId = panel.config.acceptRoleId || null;

  // Call the process function with default message
  await processAccept({
    interaction,
    collections,
    responseId,
    customMessage: null, // Will use default
    roleId
  });
}

/**
 * Handle accept confirmation modal
 */
async function handleAcceptConfirm({ interaction, collections }) {
  const { applicationPanels, applicationResponses } = collections;

  const responseId = interaction.customId.split(':')[1];
  const customMessage = interaction.fields.getTextInputValue('message');

  // Get the panel to get the pre-configured role
  const response = await applicationResponses.findOne({ _id: new ObjectId(responseId) });
  const panel = await applicationPanels.findOne({ _id: new ObjectId(response.panelId) });

  await interaction.deferReply({ flags: [64] });

  // Use the role from panel config
  const roleId = panel.config.acceptRoleId || null;

  await processAccept({
    interaction,
    collections,
    responseId,
    customMessage,
    roleId
  });
}

/**
 * Process the acceptance (shared logic)
 */
async function processAccept({ interaction, collections, responseId, customMessage, roleId }) {
  const { applicationResponses, applicationPanels, applicationTickets } = collections;

  try {
    const response = await applicationResponses.findOne({ _id: new ObjectId(responseId) });
    const panel = await applicationPanels.findOne({ _id: new ObjectId(response.panelId) });
    const ticket = await applicationTickets.findOne({ _id: new ObjectId(response.ticketId) });

    // Update response
    await applicationResponses.updateOne(
      { _id: new ObjectId(responseId) },
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
      { _id: new ObjectId(response.ticketId) },
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

      // Find and update the review message
      const messages = await channel.messages.fetch({ limit: 20 });
      const reviewMsg = messages.find(m => 
        m.embeds.length > 0 && 
        m.embeds[0].title?.includes('Application') &&
        m.components.some(row => 
          row.components.some(c => c.customId?.startsWith('app_accept:') || c.customId?.startsWith('app_reject:'))
        )
      );

      if (reviewMsg) {
        const updatedEmbed = EmbedBuilder.from(reviewMsg.embeds[0])
          .setColor(0x57F287)
          .addFields({
            name: '✅ Decision',
            value: `Accepted by ${interaction.user.tag}`,
            inline: false
          });

        const disabledRow1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('app_accepted_disabled')
            .setLabel('Accepted')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(true)
        );

        // Keep the utility buttons active
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

        await reviewMsg.edit({
          embeds: [updatedEmbed],
          components: [disabledRow1, row2]
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

          const replyContent = customMessage 
            ? `✅ Application accepted with custom message and role <@&${roleId}> assigned!`
            : `✅ Application accepted and role <@&${roleId}> assigned!`;

          if (interaction.deferred) {
            await interaction.editReply({ content: replyContent });
          } else {
            await interaction.followUp({ content: replyContent, flags: [64] });
          }
        } else {
          const replyContent = customMessage
            ? '✅ Application accepted with custom message! (Role not found or member left)'
            : '✅ Application accepted! (Role not found or member left)';

          if (interaction.deferred) {
            await interaction.editReply({ content: replyContent });
          } else {
            await interaction.followUp({ content: replyContent, flags: [64] });
          }
        }
      } catch (err) {
        console.error('Error assigning role:', err);
        const replyContent = customMessage
          ? '✅ Application accepted with custom message! (Failed to assign role)'
          : '✅ Application accepted! (Failed to assign role)';

        if (interaction.deferred) {
          await interaction.editReply({ content: replyContent });
        } else {
          await interaction.followUp({ content: replyContent, flags: [64] });
        }
      }
    } else {
      const replyContent = customMessage
        ? '✅ Application accepted with custom message!'
        : '✅ Application accepted!';

      if (interaction.deferred) {
        await interaction.editReply({ content: replyContent });
      } else {
        await interaction.followUp({ content: replyContent, flags: [64] });
      }
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

  } catch (error) {
    console.error('Error in processAccept:', error);
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ An error occurred while accepting the application.'
      });
    } else {
      return interaction.followUp({
        content: '❌ An error occurred while accepting the application.',
        flags: [64]
      });
    }
  }
}

/**
 * Handle reject button
 */
async function handleReject({ interaction, collections }) {
  const { applicationResponses, applicationPanels } = collections;

  try {
    const responseId = interaction.customId.split(':')[1];

    const response = await applicationResponses.findOne({ _id: new ObjectId(responseId) });
    if (!response) {
      return interaction.reply({
        content: '❌ Application not found!',
        flags: [64]
      });
    }

    const panel = await applicationPanels.findOne({ _id: new ObjectId(response.panelId) });

    if (!isStaff(interaction.member, panel)) {
      return interaction.reply({
        content: '❌ You do not have permission to review applications!',
        flags: [64]
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
  } catch (error) {
    console.error('Error in handleReject:', error);
    return interaction.reply({
      content: '❌ An error occurred.',
      flags: [64]
    });
  }
}

/**
 * Handle reject confirmation
 */
async function handleRejectConfirm({ interaction, collections }) {
  const { applicationResponses, applicationPanels, applicationTickets, applicationNotes, applicationCooldowns } = collections;

  try {
    const responseId = interaction.customId.split(':')[1];

    await interaction.deferReply({ flags: [64] });

    const customMessage = interaction.fields.getTextInputValue('message');
    const internalReason = interaction.fields.getTextInputValue('reason');

    const response = await applicationResponses.findOne({ _id: new ObjectId(responseId) });
    const panel = await applicationPanels.findOne({ _id: new ObjectId(response.panelId) });
    const ticket = await applicationTickets.findOne({ _id: new ObjectId(response.ticketId) });

    // Update response
    await applicationResponses.updateOne(
      { _id: new ObjectId(responseId) },
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
      { _id: new ObjectId(response.ticketId) },
      {
        $set: {
          status: 'rejected',
          lastActivity: new Date()
        }
      }
    );

    // FIXED: Create cooldown record if configured
    if (panel.config.cooldownMs && panel.config.cooldownMs > 0) {
      const expiresAt = new Date(Date.now() + panel.config.cooldownMs);

      await applicationCooldowns.insertOne({
        guildId: interaction.guild.id,
        userId: response.userId,
        panelId: panel._id.toString(),
        createdAt: new Date(),
        expiresAt: expiresAt
      });

      console.log(`Cooldown set for user ${response.userId} on panel ${panel._id} until ${expiresAt}`);
    }

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

      // FIXED: Keep close button after decision
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xED4245)
        .addFields({
          name: '❌ Decision',
          value: `Rejected by ${interaction.user.tag}`,
          inline: false
        });

      const disabledRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('app_rejected_disabled')
          .setLabel('Rejected')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
          .setDisabled(true)
      );

      // Keep the utility buttons active
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

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [disabledRow1, row2]
      });
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
  } catch (error) {
    console.error('Error in handleRejectConfirm:', error);
    if (interaction.deferred) {
      return interaction.editReply({
        content: '❌ An error occurred while rejecting the application.'
      });
    }
  }
}

module.exports = {
  handleFinalSubmit,
  handleAccept,
  handleAcceptWithMessage,
  handleAcceptDefault,
  handleAcceptConfirm,
  handleReject,
  handleRejectConfirm
};