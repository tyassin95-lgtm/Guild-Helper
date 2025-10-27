const { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { schedulePartyPanelUpdate } = require('../panelUpdater');

async function handleResetParties({ interaction, collections }) {
  const { partyPlayers, parties } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  const action = interaction.options.getString('action');

  if (action === 'all') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_reset_parties_yes')
        .setLabel('Yes, reset everything')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚠️'),
      new ButtonBuilder()
        .setCustomId('confirm_reset_parties_no')
        .setLabel('No, cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const playerCount = await partyPlayers.countDocuments({ guildId: interaction.guildId });
    const partyCount = await parties.countDocuments({ guildId: interaction.guildId });

    return interaction.reply({
      content: `⚠️ **WARNING: This will completely reset all party data!**\n\n` +
               `This will delete:\n` +
               `• **${playerCount}** player record(s)\n` +
               `• **${partyCount}** party/parties\n` +
               `• All party assignments\n` +
               `• Party panel configuration\n\n` +
               `**This action cannot be undone!**\n\n` +
               `Players will need to use \`/myinfo\` again to set up their info.`,
      components: [row],
      flags: [64]
    });
  }

  if (action === 'user') {
    const user = interaction.options.getUser('target');
    if (!user) return interaction.reply({ content: '❌ You must specify a user to reset.', flags: [64] });

    const playerRecord = await partyPlayers.findOne({ guildId: interaction.guildId, userId: user.id });
    if (!playerRecord) return interaction.reply({ content: `❌ ${user.tag} has no party info to reset.`, flags: [64] });

    // Delete the player's info
    await partyPlayers.deleteOne({ guildId: interaction.guildId, userId: user.id });

    // Remove the user from all parties
    await parties.updateMany(
      { guildId: interaction.guildId },
      { $pull: { members: { userId: user.id } } }
    );

    // Correct argument order: guildId, client, collections
    await schedulePartyPanelUpdate(interaction.guildId, interaction.client, collections);

    return interaction.reply({ content: `✅ **${user.tag}’s party info has been reset.**`, flags: [64] });
  }

  return interaction.reply({ content: 'Unknown action.', flags: [64] });
}

async function handleResetPartiesConfirmation({ interaction, collections }) {
  const { partyPlayers, parties, partyPanels } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.update({ content: '❌ You need administrator permissions.', components: [] });
  }

  if (interaction.customId === 'confirm_reset_parties_no') {
    return interaction.update({ content: '❎ Reset cancelled. No changes made.', components: [] });
  }

  if (interaction.customId === 'confirm_reset_parties_yes') {
    await interaction.deferUpdate();

    try {
      const playersResult = await partyPlayers.deleteMany({ guildId: interaction.guildId });
      const partiesResult = await parties.deleteMany({ guildId: interaction.guildId });
      const panelInfo = await partyPanels.findOne({ guildId: interaction.guildId });

      if (panelInfo) {
        try {
          const channel = await interaction.client.channels.fetch(panelInfo.channelId).catch(() => null);
          if (channel) {
            const message = await channel.messages.fetch(panelInfo.messageId).catch(() => null);
            if (message) await message.delete().catch(() => {});
          }
        } catch (err) {
          console.error('Failed to delete party panel message:', err);
        }

        await partyPanels.deleteOne({ guildId: interaction.guildId });
      }

      // Schedule panel update with correct argument order
      await schedulePartyPanelUpdate(interaction.guildId, interaction.client, collections);

      return interaction.editReply({
        content: `✅ **Party system reset complete!**\n\n` +
                 `• Deleted **${playersResult.deletedCount}** player record(s)\n` +
                 `• Deleted **${partiesResult.deletedCount}** party/parties\n` +
                 `• Cleared party panel\n\n` +
                 `All players can now use \`/myinfo\` to set up their party info again.`,
        components: []
      });
    } catch (err) {
      console.error('Failed to reset parties:', err);
      return interaction.editReply({
        content: '❌ Failed to reset party system. Please try again.',
        components: []
      });
    }
  }
}

module.exports = { handleResetParties, handleResetPartiesConfirmation };