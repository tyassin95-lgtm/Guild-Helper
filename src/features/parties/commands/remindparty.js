const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPlayerInfoEmbed } = require('../embed');

async function handleRemindParty({ interaction, collections }) {
  const { partyPlayers, guildSettings, dmContexts } = collections;

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ You need administrator permissions.', flags: [64] });
  }

  await interaction.deferReply({ flags: [64] });

  // Get excluded roles
  const settings = await guildSettings.findOne({ guildId: interaction.guildId });
  const excludedRoles = settings?.excludedRoles || [];

  // Fetch all guild members
  await interaction.guild.members.fetch();

  // Filter out bots and excluded roles
  const humans = interaction.guild.members.cache.filter(m => {
    if (m.user.bot) return false;

    // Check if member has any excluded roles
    if (excludedRoles.length > 0) {
      const hasExcludedRole = m.roles.cache.some(role => excludedRoles.includes(role.id));
      if (hasExcludedRole) return false;
    }

    return true;
  });

  // Get all players who have complete party info
  const playersWithInfo = await partyPlayers.find({ 
    guildId: interaction.guildId,
    weapon1: { $exists: true },
    weapon2: { $exists: true },
    cp: { $exists: true }
  }).toArray();

  const playersWithCompleteInfo = new Set(playersWithInfo.map(p => p.userId));

  // Find users who haven't set up their party info
  const needsSetup = humans.filter(m => !playersWithCompleteInfo.has(m.id));

  if (needsSetup.size === 0) {
    let message = '✅ All members have already set up their party info!';

    if (excludedRoles.length > 0) {
      const roleNames = [];
      for (const roleId of excludedRoles) {
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (role) roleNames.push(role.name);
      }

      if (roleNames.length > 0) {
        message += `\n\n*Excluding members with: ${roleNames.join(', ')}*`;
      }
    }

    return interaction.editReply({ content: message });
  }

  // Prepare reminder embed and buttons
  const reminderEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('⚔️ Party Info Setup Required')
    .setDescription(
      `Hello! This is a reminder from **${interaction.guild.name}**.\n\n` +
      `You haven't set up your party information yet! This information is needed for raid party assignments.\n\n` +
      `**What you need to provide:**\n` +
      `• ⚔️ Primary Weapon\n` +
      `• 🗡️ Secondary Weapon\n` +
      `• 💪 Combat Power (CP)\n\n` +
      `**Please use the buttons below to set up your info now!**\n\n` +
      `This will only take a moment and helps us organize better raid parties. Thank you! 🎯`
    )
    .setFooter({ text: `Message sent by ${interaction.user.tag}` })
    .setTimestamp();

  const buttonRow = new ActionRowBuilder().addComponents(
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

  // Send DMs with delay
  let successCount = 0;
  let failCount = 0;
  const failedUsers = [];

  for (const member of needsSetup.values()) {
    try {
      // Get their current info (if any)
      const playerInfo = await partyPlayers.findOne({
        userId: member.id,
        guildId: interaction.guildId
      });

      const infoEmbed = createPlayerInfoEmbed(playerInfo, member);

      await member.send({ 
        embeds: [reminderEmbed, infoEmbed], 
        components: [buttonRow] 
      });

      // NEW: Store DM context mapping so we know which guild this DM is for
      await dmContexts.updateOne(
        { userId: member.id },
        { 
          $set: { 
            guildId: interaction.guildId,
            guildName: interaction.guild.name,
            sentAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          } 
        },
        { upsert: true }
      );

      successCount++;

      // Delay between DMs (1 second) to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      failCount++;
      failedUsers.push(member.displayName);
      console.error(`Failed to DM ${member.user.tag}:`, err.message);
    }
  }

  // Build response
  let response = `📨 **Party Info Reminder sent!**\n\n`;
  response += `✅ Successfully sent to: **${successCount}** user(s)\n`;

  if (failCount > 0) {
    response += `❌ Failed to send to: **${failCount}** user(s)\n\n`;
    response += `**Failed users (DMs may be disabled):**\n`;
    response += failedUsers.slice(0, 10).map(name => `• ${name}`).join('\n');

    if (failedUsers.length > 10) {
      response += `\n... and ${failedUsers.length - 10} more`;
    }
  }

  // Add note about excluded roles if any
  if (excludedRoles.length > 0) {
    const roleNames = [];
    for (const roleId of excludedRoles) {
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (role) roleNames.push(role.name);
    }

    if (roleNames.length > 0) {
      response += `\n\n*Excluded roles from reminders: ${roleNames.join(', ')}*`;
    }
  }

  return interaction.editReply({ content: response });
}

module.exports = { handleRemindParty };