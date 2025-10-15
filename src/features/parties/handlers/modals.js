const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPlayerInfoEmbed } = require('../embed');
const { autoAssignPlayer } = require('../autoAssignment');
const { schedulePartyPanelUpdate } = require('../panelUpdater');
const { getGuildContext } = require('./buttons');

async function handlePartyModals({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

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

    try {
      // Get guild context (works in both DM and guild)
      const { guildId, guild } = await getGuildContext(interaction, collections);

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

        // Recalculate total CP
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

        // Schedule panel update
        schedulePartyPanelUpdate(guildId, interaction.client, collections);
      } else {
        // Try auto-assignment if player has complete info
        if (playerInfo.weapon1 && playerInfo.weapon2) {
          const result = await autoAssignPlayer(
            interaction.user.id,
            guildId,
            interaction.client,
            collections
          );

          if (result.success) {
            // Schedule panel update
            schedulePartyPanelUpdate(guildId, interaction.client, collections);
          }
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

      const embed = createPlayerInfoEmbed(playerInfo, member);

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
    } catch (err) {
      console.error('Error in party_cp_modal:', err);

      if (err.message === 'DM_CONTEXT_EXPIRED') {
        return interaction.reply({ 
          content: '❌ This DM link has expired (24 hours). Please use `/myinfo` in the server to set up your party info.', 
          flags: [64] 
        });
      }

      return interaction.reply({ 
        content: '❌ An error occurred while setting your CP. Please try again.', 
        flags: [64] 
      });
    }
  }
}

module.exports = { handlePartyModals };