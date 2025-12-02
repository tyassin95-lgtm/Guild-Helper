const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { PANEL_BANNER_URL } = require('../../../config');

async function handleCreatePanel({ interaction, collections }) {
  const { panels } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions to create panels.', flags: [64] });
  }

  const embed = new EmbedBuilder()
    .setColor('#8B5CF6')
    .setTitle('⚔️ Guild Wishlist System')
    .setDescription(
      '╔═══════════════════════════════════╗\n' +
      '    **Welcome to the Guild\'s Wishlist**\n' +
      '╚═══════════════════════════════════╝\n\n' +

      '**📋 Token Allocation**\n' +
      '```\n' +
      '⚔️  1x Weapon Token\n' +
      '💍  1x Accessory Token\n' +
      '🛡️  4x Armor Tokens\n' +
      '```\n\n' +

      '**✨ How It Works**\n' +
      '> 🎯 Select items from **Tier 2** or **Tier 3** bosses\n' +
      '> 🔄 Modify your selections anytime before finalizing\n' +
      '> 🔒 Once finalized, contact an admin for changes\n' +
      '> ⏰ Tokens regenerate 7 days after receiving items\n\n' +

      '**🚀 Get Started**\n' +
      '> Click the button below to view and edit your wishlist!\n'
    )
    .setFooter({ 
      text: '💎 Choose wisely • Plan ahead', 
      iconURL: interaction.guild.iconURL()
    })
    .setTimestamp()
    .setImage(PANEL_BANNER_URL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_wishlist')
      .setLabel('View/Edit My Wishlist')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝')
  );

  const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

  await panels.insertOne({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageId: message.id
  });
}

module.exports = { handleCreatePanel };