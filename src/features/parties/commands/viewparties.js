const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPartiesOverviewEmbed } = require('../embed');

async function handleViewParties({ interaction, collections }) {
  const { parties } = collections;

  const allParties = await parties.find({ guildId: interaction.guildId })
    .sort({ isReserve: 1, partyNumber: 1 })
    .toArray();

  const embed = createPartiesOverviewEmbed(allParties, interaction.guild);

  const components = [];

  // Admin controls
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const hasReserve = allParties.some(p => p.isReserve);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('party_create')
        .setLabel('Create Party')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId('party_create_reserve')
        .setLabel('Create Reserve')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📦')
        .setDisabled(hasReserve), // Disable if reserve already exists
      new ButtonBuilder()
        .setCustomId('party_manage')
        .setLabel('Manage Parties')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚙️'),
      new ButtonBuilder()
        .setCustomId('party_delete')
        .setLabel('Delete Party')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
    );

    components.push(row);
  }

  return interaction.reply({ embeds: [embed], components, flags: [64] });
}

module.exports = { handleViewParties };