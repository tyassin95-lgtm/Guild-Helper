const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPlayerInfoEmbed } = require('../embed');

async function handleMyInfo({ interaction, collections }) {
  const { partyPlayers } = collections;

  const playerInfo = await partyPlayers.findOne({
    userId: interaction.user.id,
    guildId: interaction.guildId
  });

  const embed = await createPlayerInfoEmbed(playerInfo, interaction.member, collections);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('party_set_weapon1')
      .setLabel('Set Primary Weapon')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚔️'),
    new ButtonBuilder()
      .setCustomId('party_set_weapon2')
      .setLabel('Set Secondary Weapon')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🗡️'),
    new ButtonBuilder()
      .setCustomId('party_set_cp')
      .setLabel('Set Combat Power')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💪')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('party_gear_check')
      .setLabel('Gear Check (mandatory)')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('📸')
  );

  return interaction.reply({ embeds: [embed], components: [row1, row2], flags: [64] });
}

module.exports = { handleMyInfo };