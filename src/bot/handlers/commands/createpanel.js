const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { PANEL_BANNER_URL } = require('../../../config');

async function handleCreatePanel({ interaction, collections }) {
  const { panels } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to create panels.', flags: [64] });
  }

  const embed = new EmbedBuilder()
    .setColor('#3498db')
    .setTitle('🎯 Guild Wishlist System')
    .setDescription(
      '# Welcome to the Throne and Liberty Guild Wishlist for Oath Guild!\n\n' +
      '**## How it works:**\n' +
      '### - You have **1 Weapon Token**, **4 Armor Tokens**, and **1 Accessory Token**\n' +
      '### - Use these tokens to add items from Tier 2 or Tier 3 bosses to your wishlist\n' +
      '### - You can change your selections until you finalize\n' +
      '### - Once finalized, only admins can make changes\n\n' +
      '### - Click **"View/Edit My Wishlist"** below to get started!'
    )
    .setFooter({ text: '### Make your choices wisely!' })
    .setTimestamp()
    .setImage(PANEL_BANNER_URL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_wishlist').setLabel('View/Edit My Wishlist').setStyle(ButtonStyle.Primary).setEmoji('📋')
  );

  const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

  await panels.insertOne({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageId: message.id
  });
}

module.exports = { handleCreatePanel };
