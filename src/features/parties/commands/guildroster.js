const { PermissionFlagsBits } = require('discord.js');
const RosterBuilder = require('../rosterBuilder');

/**
 * Update or create guild roster messages
 */
async function updateGuildRoster(guild, channelId, collections) {
  const { partyPlayers, guildRosters } = collections;

  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.error('Guild roster channel not found or not text-based:', channelId);
      return;
    }

    // Get all players with info submitted
    const players = await partyPlayers.find({
      guildId: guild.id,
      weapon1: { $exists: true },
      weapon2: { $exists: true }
    }).toArray();

    // Build roster messages
    const messageContents = players.length > 0
      ? await RosterBuilder.buildRosterMessages(guild, players, collections)
      : RosterBuilder.buildEmptyRosterMessage();

    // Get existing roster record
    const rosterRecord = await guildRosters.findOne({ guildId: guild.id });

    if (rosterRecord && rosterRecord.messageIds && rosterRecord.messageIds.length > 0) {
      // Update existing messages
      const existingMessages = [];

      // Try to fetch all existing messages
      for (const msgId of rosterRecord.messageIds) {
        try {
          const msg = await channel.messages.fetch(msgId).catch(() => null);
          if (msg) existingMessages.push(msg);
        } catch (err) {
          console.warn(`Could not fetch roster message ${msgId}:`, err.message);
        }
      }

      const newMessageIds = [];

      // Update or create messages
      for (let i = 0; i < messageContents.length; i++) {
        if (i < existingMessages.length) {
          // Edit existing message
          try {
            await existingMessages[i].edit(messageContents[i]);
            newMessageIds.push(existingMessages[i].id);
          } catch (err) {
            console.error('Error editing roster message:', err);
            // If edit fails, create new message
            const newMsg = await channel.send(messageContents[i]);
            newMessageIds.push(newMsg.id);
          }
        } else {
          // Create new message for additional pages
          const newMsg = await channel.send(messageContents[i]);
          newMessageIds.push(newMsg.id);
        }
      }

      // Delete extra messages if roster shrunk
      for (let i = messageContents.length; i < existingMessages.length; i++) {
        try {
          await existingMessages[i].delete();
        } catch (err) {
          console.warn('Could not delete old roster message:', err.message);
        }
      }

      // Update database with new message IDs
      await guildRosters.updateOne(
        { guildId: guild.id },
        {
          $set: {
            messageIds: newMessageIds,
            channelId: channelId,
            lastUpdated: new Date()
          }
        }
      );
    } else {
      // Create new messages
      const messageIds = [];

      for (const msgContent of messageContents) {
        const msg = await channel.send(msgContent);
        messageIds.push(msg.id);
      }

      // Store in database
      await guildRosters.updateOne(
        { guildId: guild.id },
        {
          $set: {
            channelId: channelId,
            messageIds: messageIds,
            createdAt: new Date(),
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error('Error updating guild roster:', err);
    throw err;
  }
}

/**
 * Handle /guildroster command
 */
async function handleGuildRoster({ interaction, collections }) {
  const { guildRosters } = collections;

  // Check if user has admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to use this command.',
      flags: [64]
    });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    const channelId = interaction.channelId;
    const guild = interaction.guild;

    // Update/create roster
    await updateGuildRoster(guild, channelId, collections);

    return interaction.editReply({
      content: '✅ Guild roster has been created/updated in this channel! It will auto-update when members change their info.'
    });
  } catch (err) {
    console.error('Error in handleGuildRoster:', err);
    return interaction.editReply({
      content: '❌ An error occurred while creating the roster. Please try again.'
    });
  }
}

module.exports = { handleGuildRoster, updateGuildRoster };