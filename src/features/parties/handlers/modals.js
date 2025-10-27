const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPlayerInfoEmbed } = require('../embed');
const { autoAssignPlayer } = require('../autoAssignment');
const { schedulePartyPanelUpdate } = require('../panelUpdater');
const { getGuildContext } = require('./buttons');
const { attemptReserveAssignment } = require('../reserve');

async function handlePartyModals({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

  // CP modal submission
  if (interaction.customId === 'party_cp_modal') {
    // Defer the reply once
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

    // Get guild context
    let guildId, guild;
    try {
      const context = await getGuildContext(interaction, collections);
      guildId = context.guildId;
      guild = context.guild;
    } catch (err) {
      if (err.message === 'DM_CONTEXT_EXPIRED') {
        return interaction.editReply({
          content:
            '❌ **This DM link has expired (24 hours)**\n\n' +
            'Please return to the server and use `/myinfo` to update your Combat Power.\n\n' +
            '**Your CP value was not saved.**'
        });
      }

      console.error('Error getting guild context:', err);
      return interaction.editReply({
        content: '❌ Could not determine your server. Please use `/myinfo` in the server to update your CP.'
      });
    }

    // Update player CP
    try {
      const oldPlayer = await partyPlayers.findOne({
        userId: interaction.user.id,
        guildId: guildId
      });

      const oldCP = oldPlayer?.cp || 0;

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

        schedulePartyPanelUpdate(guildId, interaction.client, collections);

      } else if (playerInfo.inReserve) {
        // Player is in reserve - check if CP increase makes them competitive
        const cpIncrease = cp - oldCP;

        if (cpIncrease > 0) {
          console.log(`[CP Update] Reserve player ${interaction.user.id} increased CP by ${cpIncrease} (${oldCP} → ${cp})`);

          const result = await attemptReserveAssignment(playerInfo, guildId, interaction.client, collections);

          if (result.success) {
            console.log(`[CP Update] Reserve player ${interaction.user.id} promoted to Party ${result.partyNumber}`);

            const { sendReservePromotionDM } = require('../notifications');
            try {
              await sendReservePromotionDM(
                interaction.user.id,
                result.partyNumber,
                playerInfo.role,
                guildId,
                interaction.client,
                collections
              );
            } catch (err) {
              console.error('Failed to send promotion DM:', err.message);
            }

            schedulePartyPanelUpdate(guildId, interaction.client, collections);
          }
        }
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
