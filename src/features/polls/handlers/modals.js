const { buildPollEmbed } = require('../utils/pollEmbed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function handlePollModal({ interaction, collections }) {
  const { guildPolls } = collections;

  await interaction.deferReply({ flags: [64] });

  try {
    // Extract modal inputs
    const description = interaction.fields.getTextInputValue('poll_description').trim();
    const optionsRaw = interaction.fields.getTextInputValue('poll_options').trim();
    const durationRaw = interaction.fields.getTextInputValue('poll_duration').trim();
    const multipleChoiceRaw = interaction.fields.getTextInputValue('poll_multiple_choice').trim().toLowerCase();
    const imageUrl = interaction.fields.getTextInputValue('poll_image')?.trim() || null;

    // Validate duration
    const durationHours = parseInt(durationRaw, 10);
    if (isNaN(durationHours) || durationHours < 1 || durationHours > 168) {
      return interaction.editReply({ 
        content: '❌ Duration must be a number between 1 and 168 hours.', 
        flags: [64] 
      });
    }

    // Validate multiple choice
    const allowMultipleVotes = multipleChoiceRaw === 'yes' || multipleChoiceRaw === 'y';

    // Parse options (split by newline, filter empty)
    const optionTexts = optionsRaw
      .split('\n')
      .map(opt => opt.trim())
      .filter(opt => opt.length > 0);

    // Validate option count
    if (optionTexts.length < 2) {
      return interaction.editReply({ 
        content: '❌ You must provide at least 2 options.', 
        flags: [64] 
      });
    }
    if (optionTexts.length > 8) {
      return interaction.editReply({ 
        content: '❌ You can provide a maximum of 8 options.', 
        flags: [64] 
      });
    }

    // Validate image URL if provided
    if (imageUrl) {
      try {
        const url = new URL(imageUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return interaction.editReply({ 
            content: '❌ Image URL must start with http:// or https://', 
            flags: [64] 
          });
        }
      } catch (err) {
        return interaction.editReply({ 
          content: '❌ Invalid image URL format.', 
          flags: [64] 
        });
      }
    }

    // Build options array
    const options = optionTexts.map((text, index) => ({
      id: `option_${index}`,
      text: text,
      voters: []
    }));

    // Calculate end time
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    // Create poll document
    const pollDoc = {
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      creatorId: interaction.user.id,
      description,
      imageUrl,
      options,
      createdAt: now,
      endsAt,
      durationHours,
      closed: false,
      active: true,
      allowMultipleVotes
    };

    // Create poll embed
    const embed = buildPollEmbed(pollDoc, interaction.guild);

    // Create buttons for each option
    const buttons = options.map(option => 
      new ButtonBuilder()
        .setCustomId(`poll_vote:${option.id}`)
        .setLabel(option.text.substring(0, 80)) // Discord button label max 80 chars
        .setStyle(ButtonStyle.Primary)
    );

    // Split buttons into rows (max 5 per row)
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(
        new ActionRowBuilder().addComponents(buttons.slice(i, i + 5))
      );
    }

    // Send poll message with @everyone ping
    const pollMessage = await interaction.channel.send({
      content: '📊 @everyone **New Poll Created!** Cast your vote below:',
      embeds: [embed],
      components: rows,
      allowedMentions: { parse: ['everyone'] }
    });

    // Update poll document with message ID
    pollDoc.messageId = pollMessage.id;
    await guildPolls.insertOne(pollDoc);

    await interaction.editReply({ 
      content: `✅ Poll created successfully! Voters have ${durationHours} hour(s) to participate.`,
      flags: [64] 
    });

  } catch (error) {
    console.error('Error creating poll:', error);
    await interaction.editReply({ 
      content: '❌ An error occurred while creating the poll. Please try again.',
      flags: [64] 
    });
  }
}

module.exports = { handlePollModal };