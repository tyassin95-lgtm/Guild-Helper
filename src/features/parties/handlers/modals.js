const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPlayerInfoEmbed } = require('../embed');

async function handlePartyModals({ interaction, collections }) {
  const { partyPlayers } = collections;

  // CP modal submission
  if (interaction.customId === 'party_cp_modal') {
    const cpValue = interaction.fields.getTextInputValue('cp_value');
    const cp = parseInt(cpValue.replace(/,/g, ''));

    if (isNaN(cp) || cp < 0) {
      return interaction.reply({ 
        content: '❌ Invalid Combat Power value! Please enter a valid number.', 
        flags: [64] 
      });
    }

    if (cp > 10000000) {
      return interaction.reply({ 
        content: '❌ Combat Power value too high! Maximum is 10,000,000.', 
        flags: [64] 
      });
    }

    await partyPlayers.updateOne(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $set: { cp, updatedAt: new Date() } },
      { upsert: true }
    );

    const playerInfo = await partyPlayers.findOne({
      userId: interaction.user.id,
      guildId: interaction.guildId
    });

    // Update party member CP if assigned
    if (playerInfo.partyNumber) {
      const { parties } = collections;
      await parties.updateOne(
        { 
          guildId: interaction.guildId, 
          partyNumber: playerInfo.partyNumber,
          'members.userId': interaction.user.id
        },
        { $set: { 'members.$.cp': cp } }
      );
    }

    const embed = createPlayerInfoEmbed(playerInfo, interaction.member);

    const row = new ActionRowBuilder().addComponents(
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

    return interaction.reply({ 
      content: `✅ Combat Power set to **${cp.toLocaleString()}**!`, 
      embeds: [embed], 
      components: [row],
      flags: [64] 
    });
  }
}

module.exports = { handlePartyModals };