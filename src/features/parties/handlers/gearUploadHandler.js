const { updateGuildRoster } = require('../commands/guildroster');
const { uploadToDiscordStorage } = require('../../../utils/discordStorage');

/**
 * Handle gear screenshot uploads via message attachments
 */
async function handleGearUpload({ message, collections }) {
  const { dmContexts, partyPlayers, guildRosters, guildSettings } = collections;

  // Check if user has an active gear upload context
  const context = await dmContexts.findOne({
    userId: message.author.id,
    type: 'gear_upload',
    expiresAt: { $gt: new Date() }
  });

  if (!context) {
    return; // Not waiting for gear upload, ignore
  }

  // Validate that message has an image attachment
  const attachment = message.attachments.find(att => 
    att.contentType?.startsWith('image/')
  );

  if (!attachment) {
    return message.reply({
      content: '❌ Please send an **image file** (PNG, JPG, JPEG, WEBP).\n\n' +
               'You can try again by using `/myinfo` and clicking "Upload Gear Screenshot".'
    });
  }

  // Validate file size (8MB limit)
  if (attachment.size > 8 * 1024 * 1024) {
    return message.reply({
      content: '❌ Image too large! Maximum size is 8MB.\n\n' +
               'Please compress your image and try again using `/myinfo`.'
    });
  }

  // Send processing message
  const processingMsg = await message.reply('📤 Processing your gear screenshot...');

  try {
    // Get guild context
    const guildId = context.guildId;
    const guild = await message.client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      throw new Error('Could not fetch guild');
    }

    // Check if user already has a stored gear screenshot
    const existingPlayer = await partyPlayers.findOne({
      userId: message.author.id,
      guildId: guildId
    });

    // Get custom storage channel if set
    const settings = await guildSettings.findOne({ guildId: guildId });
    const customChannelId = settings?.gearStorageChannelId || null;

    // Upload to Discord storage channel
    console.log(`Uploading gear for user ${message.author.id} in guild ${guild.name}`);
    const storageData = await uploadToDiscordStorage(
      guild,
      attachment.url,
      message.author.id,
      customChannelId
    );

    // If user had a previous gear screenshot, delete it (optional - saves space)
    if (existingPlayer?.gearStorageMessageId && existingPlayer?.gearStorageChannelId) {
      const { deleteFromDiscordStorage } = require('../../../utils/discordStorage');
      await deleteFromDiscordStorage(
        guild,
        existingPlayer.gearStorageChannelId,
        existingPlayer.gearStorageMessageId
      ).catch(err => {
        console.warn('Could not delete old gear screenshot:', err.message);
      });
    }

    // Store the permanent Discord URL in database
    await partyPlayers.updateOne(
      { userId: message.author.id, guildId: guildId },
      { 
        $set: { 
          gearScreenshotUrl: storageData.url,
          gearStorageMessageId: storageData.messageId,
          gearStorageChannelId: storageData.channelId,
          gearScreenshotUpdatedAt: new Date(),
          gearScreenshotSource: 'discord_storage'
        } 
      },
      { upsert: true }
    );

    // Clear the upload context
    await dmContexts.deleteOne({ 
      userId: message.author.id, 
      type: 'gear_upload' 
    });

    // Wait 2 seconds before deleting to prevent Discord UI artifacts
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Delete the user's uploaded image message to keep chat clean
    try {
      await message.delete();
    } catch (err) {
      console.warn('Could not delete user upload message:', err.message);
    }

    // Delete the processing message
    try {
      await processingMsg.delete();
    } catch (err) {
      console.warn('Could not delete processing message:', err.message);
    }

    // Update guild roster if it exists
    const rosterRecord = await guildRosters.findOne({ guildId: guild.id });
    if (rosterRecord && rosterRecord.channelId) {
      // Update roster in background (don't wait)
      updateGuildRoster(guild, rosterRecord.channelId, collections).catch(err => {
        console.error('Error auto-updating guild roster:', err);
      });
    }

    // Send success message via DM
    try {
      await message.author.send({
        content: '✅ **Gear screenshot uploaded successfully!**\n\n' +
                 'Your gear is now permanently stored and visible in the guild roster.\n\n' +
                 '**Note:** Your gear is stored in a secure bot channel and will never expire!'
      });
    } catch (dmError) {
      // If DM fails, send ephemeral message in channel
      return message.channel.send({
        content: `✅ <@${message.author.id}> Gear screenshot uploaded successfully!`
      }).then(msg => {
        // Delete the confirmation after 5 seconds
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      });
    }

  } catch (err) {
    console.error('Error handling gear upload:', err);

    // Delete processing message on error
    try {
      await processingMsg.delete();
    } catch (delErr) {
      console.warn('Could not delete processing message:', delErr.message);
    }

    return message.reply({
      content: '❌ Failed to save your gear screenshot. Please try again using `/myinfo`.\n\n' +
               'Error: ' + err.message
    });
  }
}

module.exports = { handleGearUpload };