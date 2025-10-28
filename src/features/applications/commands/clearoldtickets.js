const { EmbedBuilder } = require('discord.js');
const { closeTicket } = require('../utils/ticketManager');

async function handleClearOldTickets({ interaction, collections }) {
  const { applicationTickets, applicationPanels } = collections;

  const days = interaction.options.getInteger('days') || 30;

  await interaction.deferReply({ flags: [64] });

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Find old tickets
  const oldTickets = await applicationTickets
    .find({
      guildId: interaction.guild.id,
      status: { $in: ['closed', 'accepted', 'rejected'] },
      lastActivity: { $lt: cutoffDate }
    })
    .toArray();

  if (oldTickets.length === 0) {
    return interaction.editReply({
      content: `✅ No tickets found older than ${days} days with closed status.`
    });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const ticket of oldTickets) {
    try {
      const panel = await applicationPanels.findOne({
        _id: new (require('mongodb').ObjectId)(ticket.panelId)
      });

      const archiveChannelId = panel?.config?.archiveCategoryId || null;
      const shouldDelete = false; // Don't delete, just archive

      const result = await closeTicket({
        guild: interaction.guild,
        ticketId: ticket._id,
        archiveChannelId,
        deleteChannel: shouldDelete,
        collections
      });

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (err) {
      console.error('Error closing ticket:', err);
      errorCount++;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`🧹 Ticket Cleanup Complete`)
    .setColor(0x57F287)
    .addFields(
      {
        name: '📊 Results',
        value: `**Total Found:** ${oldTickets.length}\n**Successfully Archived:** ${successCount}\n**Errors:** ${errorCount}`,
        inline: false
      },
      {
        name: '📅 Criteria',
        value: `Tickets older than **${days} days** with closed status`,
        inline: false
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { handleClearOldTickets };