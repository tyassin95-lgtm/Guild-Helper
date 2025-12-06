const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPlayerInfoEmbed } = require('../embed');
const { updatePlayerRole } = require('../roleDetection');

async function handlePartyModals({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

  // CP modal submission
  if (interaction.customId === 'party_cp_modal') {
    await interaction.deferReply({ flags: [64] }).catch(() => {});

    const cpValue = interaction.fields.getTextInputValue('cp_value');
    const cp = parseInt(cpValue.replace(/,/g, ''));

    // Validate input
    if (isNaN(cp) || cp < 0) {
      return interaction.editReply({ content: '❌ Invalid Combat Power value! Please enter a valid number.' });
    }

    if (cp > 10000000) {
      return interaction.editReply({ content: '❌ Combat Power value too high! Maximum is 10,000,000.' });
    }

    // Get guild context - for DM support
    let guildId = interaction.guildId;
    let guild = interaction.guild;

    if (!guildId) {
      // Try to get from DM context
      const { dmContexts } = collections;
      const context = await dmContexts.findOne({ 
        userId: interaction.user.id,
        expiresAt: { $gt: new Date() }
      });

      if (!context) {
        return interaction.editReply({
          content: '❌ **This DM link has expired (24 hours)**\n\nPlease return to the server and use `/myinfo` to update your Combat Power.'
        });
      }

      guildId = context.guildId;
      guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
    }

    // Update player CP
    try {
      await partyPlayers.updateOne(
        { userId: interaction.user.id, guildId: guildId },
        { $set: { cp, updatedAt: new Date() } },
        { upsert: true }
      );

      const playerInfo = await partyPlayers.findOne({
        userId: interaction.user.id,
        guildId: guildId
      });

      // Update party member CP if assigned
      if (playerInfo.partyNumber) {
        await parties.updateOne(
          { 
            guildId: guildId, 
            partyNumber: playerInfo.partyNumber,
            'members.userId': interaction.user.id
          },
          { $set: { 'members.$.cp': cp } }
        );

        const party = await parties.findOne({
          guildId: guildId,
          partyNumber: playerInfo.partyNumber
        });

        if (party) {
          const totalCP = (party.members || []).reduce((sum, m) => sum + (m.cp || 0), 0);
          await parties.updateOne(
            { _id: party._id },
            { $set: { totalCP } }
          );
        }
      }

      // Fetch member for embed
      let member = interaction.member;
      if (!member && guild) {
        try {
          member = await guild.members.fetch(interaction.user.id);
        } catch (err) {
          console.warn('Could not fetch member:', err.message);
        }
      }

      if (!member) {
        member = {
          displayName: interaction.user.username,
          user: interaction.user
        };
      }

      const embed = await createPlayerInfoEmbed(playerInfo, member, collections);

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

      return interaction.editReply({
        content: `✅ Combat Power set to **${cp.toLocaleString()}**!`,
        embeds: [embed],
        components: [row]
      });

    } catch (err) {
      console.error('Error processing CP update:', err);
      return interaction.editReply({
        content: '❌ An error occurred while setting your CP. Please try again using `/myinfo` in the server.'
      });
    }
  }
}

module.exports = { handlePartyModals };