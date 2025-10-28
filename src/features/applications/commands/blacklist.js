const { EmbedBuilder } = require('discord.js');
const { addToBlacklist, removeFromBlacklist } = require('../utils/permissions');

async function handleBlacklist({ interaction, collections }) {
  const action = interaction.options.getString('action');

  if (action === 'add') {
    return handleBlacklistAdd({ interaction, collections });
  } else if (action === 'remove') {
    return handleBlacklistRemove({ interaction, collections });
  } else if (action === 'list') {
    return handleBlacklistList({ interaction, collections });
  }
}

async function handleBlacklistAdd({ interaction, collections }) {
  const { applicationBlacklist } = collections;

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'No reason provided';
  const days = interaction.options.getInteger('days') || 0; // 0 = permanent

  await interaction.deferReply({ flags: [64] });

  const duration = days > 0 ? days * 24 * 60 * 60 * 1000 : null;

  await addToBlacklist({
    userId: user.id,
    guildId: interaction.guild.id,
    reason,
    duration,
    addedBy: interaction.user.id,
    collections
  });

  const durationText = days > 0 ? `for ${days} days` : 'permanently';

  await interaction.editReply({
    content: `✅ **${user.tag}** has been blacklisted ${durationText}.\n**Reason:** ${reason}`
  });
}

async function handleBlacklistRemove({ interaction, collections }) {
  const user = interaction.options.getUser('user');

  await interaction.deferReply({ flags: [64] });

  await removeFromBlacklist({
    userId: user.id,
    guildId: interaction.guild.id,
    collections
  });

  await interaction.editReply({
    content: `✅ **${user.tag}** has been removed from the blacklist.`
  });
}

async function handleBlacklistList({ interaction, collections }) {
  const { applicationBlacklist } = collections;

  await interaction.deferReply({ flags: [64] });

  const entries = await applicationBlacklist
    .find({ guildId: interaction.guild.id })
    .toArray();

  if (entries.length === 0) {
    return interaction.editReply({
      content: '✅ No users are currently blacklisted.'
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('🚫 Application Blacklist')
    .setColor(0xED4245)
    .setTimestamp();

  let description = '';

  for (const entry of entries.slice(0, 25)) {
    const expiresText = entry.expiresAt 
      ? `Expires: <t:${Math.floor(entry.expiresAt.getTime() / 1000)}:R>`
      : 'Permanent';

    description += `**<@${entry.userId}>**\n`;
    description += `Reason: ${entry.reason}\n`;
    description += `Added by: <@${entry.addedBy}>\n`;
    description += `${expiresText}\n\n`;
  }

  embed.setDescription(description);

  if (entries.length > 25) {
    embed.setFooter({ text: `Showing 25 of ${entries.length} entries` });
  }

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { handleBlacklist };