const { uploadToDiscordStorage } = require('../../../utils/discordStorage');
const { getOrCreateGearThread, postGearCheckToThread, updateGearCheckInThread } = require('../utils/gearCheckThreads');

async function handleGearUpload({ message, collections }) {
  const { dmContexts, partyPlayers, guildSettings } = collections;

  const context = await dmContexts.findOne({
    userId: message.author.id,
    type: 'gear_upload',
    expiresAt: { $gt: new Date() }
  });

  if (!context) {
    return;
  }

  const attachment = message.attachments.find(att => 
    att.contentType?.startsWith('image/')
  );

  if (!attachment) {
    return message.reply({
      content: '❌ Please send an **image file** (PNG, JPG, JPEG, WEBP).\n\n' +
               'You can try again by using `/myinfo` and clicking "Gear Check".'
    });
  }

  if (attachment.size > 8 * 1024 * 1024) {
    return message.reply({
      content: '❌ Image too large! Maximum size is 8MB.\n\n' +
               'Please compress your image and try again using `/myinfo`.'
    });
  }

  const processingMsg = await message.reply('📤 Processing your gear check...');

  try {
    const guildId = context.guildId;
    const guild = await message.client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      throw new Error('Could not fetch guild');
    }

    const settings = await guildSettings.findOne({ guildId: guildId });
    if (!settings || !settings.gearCheckChannelId) {
      throw new Error('Gear check channel not configured');
    }

    const gearCheckChannel = await guild.channels.fetch(settings.gearCheckChannelId).catch(() => null);
    if (!gearCheckChannel) {
      throw new Error('Gear check channel not found');
    }

    const existingPlayer = await partyPlayers.findOne({
      userId: message.author.id,
      guildId: guildId
    });

    const customChannelId = settings?.gearStorageChannelId || null;

    console.log(`Uploading gear for user ${message.author.id} in guild ${guild.name}`);
    const storageData = await uploadToDiscordStorage(
      guild,
      attachment.url,
      message.author.id,
      customChannelId
    );

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

    const member = await guild.members.fetch(message.author.id).catch(() => null);
    const displayName = member?.displayName || message.author.username;

    const gearThread = await getOrCreateGearThread(gearCheckChannel, message.author.id, displayName);

    const pendingChanges = await dmContexts.findOne({
      userId: message.author.id,
      type: 'pending_party_info',
      guildId: guildId
    });

    const existingThreadMessageId = pendingChanges?.gearCheckData?.messageId;

    let threadMessage;
    if (existingThreadMessageId) {
      threadMessage = await updateGearCheckInThread(
        gearThread,
        existingThreadMessageId,
        message.author.id,
        context.questlogUrl,
        storageData.url
      );
    } else {
      threadMessage = await postGearCheckToThread(
        gearThread,
        message.author.id,
        context.questlogUrl,
        storageData.url
      );
    }

    await dmContexts.updateOne(
      { userId: message.author.id, type: 'pending_party_info', guildId: guildId },
      { 
        $set: {
          gearCheckComplete: true,
          gearCheckData: {
            questlogUrl: context.questlogUrl,
            screenshotUrl: storageData.url,
            threadId: gearThread.id,
            messageId: threadMessage.id
          },
          updatedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      },
      { upsert: true }
    );

    await dmContexts.deleteOne({ 
      userId: message.author.id, 
      type: 'gear_upload' 
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      await message.delete();
    } catch (err) {
      console.warn('Could not delete user upload message:', err.message);
    }

    try {
      await processingMsg.delete();
    } catch (err) {
      console.warn('Could not delete processing message:', err.message);
    }

    try {
      await message.author.send({
        content: '✅ **Gear check completed successfully!**\n\n' +
                 `• Your QuestLog build: ${context.questlogUrl}\n` +
                 '• Gear screenshot uploaded and posted to your thread\n' +
                 '• You can now submit your changes with `/myinfo`!\n\n' +
                 `View your thread: ${gearThread.url}`
      });
    } catch (dmError) {
      return message.channel.send({
        content: `✅ <@${message.author.id}> Gear check completed! View your thread: ${gearThread.url}`
      }).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      });
    }

  } catch (err) {
    console.error('Error handling gear upload:', err);

    try {
      await processingMsg.delete();
    } catch (delErr) {
      console.warn('Could not delete processing message:', delErr.message);
    }

    return message.reply({
      content: '❌ Failed to complete gear check. Please try again using `/myinfo`.\n\n' +
               'Error: ' + err.message
    });
  }
}

module.exports = { handleGearUpload };