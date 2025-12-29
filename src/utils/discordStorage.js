const axios = require('axios');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

/**
 * Get or create the gear storage channel
 * @param {Guild} guild - Discord guild
 * @param {string} channelId - Optional specific channel ID to use
 * @returns {Promise<TextChannel>} - Storage channel
 */
async function getOrCreateStorageChannel(guild, channelId = null) {
  const STORAGE_CHANNEL_NAME = 'gear-screenshots-storage';

  // If specific channel ID provided, try to use it
  if (channelId) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel && channel.type === ChannelType.GuildText) {
      console.log(`Using existing channel as storage: ${channel.name}`);
      return channel;
    }
  }

  // Try to find existing storage channel by name
  let storageChannel = guild.channels.cache.find(
    ch => ch.name === STORAGE_CHANNEL_NAME && ch.type === ChannelType.GuildText
  );

  // If doesn't exist, create it
  if (!storageChannel) {
    console.log(`Creating storage channel in guild: ${guild.name}`);

    try {
      storageChannel = await guild.channels.create({
        name: STORAGE_CHANNEL_NAME,
        type: ChannelType.GuildText,
        topic: '🔒 Bot-only storage for gear screenshots. DO NOT DELETE THIS CHANNEL!',
        permissionOverwrites: [
          {
            id: guild.id, // @everyone role
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: guild.client.user.id, // Bot itself
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages
            ]
          }
        ]
      });

      // Send welcome message
      await storageChannel.send({
        content: '🔒 **Gear Screenshots Storage**\n\n' +
                 'This channel stores gear screenshots for the party system.\n' +
                 '⚠️ **DO NOT DELETE THIS CHANNEL** - It will break all gear links!\n\n' +
                 'Admins can manage this channel with `/screenshot storage`'
      });

      console.log(`✅ Created storage channel: ${storageChannel.id}`);
    } catch (error) {
      console.error('Failed to create storage channel:', error);
      throw new Error('Could not create storage channel. Bot may be missing "Manage Channels" permission.');
    }
  }

  return storageChannel;
}

/**
 * Upload an image to Discord storage channel
 * @param {Guild} guild - Discord guild
 * @param {string} imageUrl - Original Discord CDN URL
 * @param {string} userId - User ID for metadata
 * @param {string} customChannelId - Optional custom storage channel ID
 * @returns {Promise<Object>} - { url: string, messageId: string, channelId: string }
 */
async function uploadToDiscordStorage(guild, imageUrl, userId, customChannelId = null) {
  try {
    // Get storage channel
    const storageChannel = await getOrCreateStorageChannel(guild, customChannelId);

    // Download the image from original URL
    console.log('Downloading image from Discord CDN...');
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000, // 15 seconds
      maxContentLength: 8 * 1024 * 1024 // 8MB max
    });

    const buffer = Buffer.from(response.data);

    // Determine file extension from URL or content-type
    let extension = 'png';
    const urlExtMatch = imageUrl.match(/\.(\w+)(?:\?|$)/);
    if (urlExtMatch) {
      extension = urlExtMatch[1].toLowerCase();
    }

    // Validate extension
    const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    if (!validExtensions.includes(extension)) {
      extension = 'png';
    }

    const fileName = `gear_${userId}_${Date.now()}.${extension}`;

    // Upload to storage channel
    console.log(`Re-uploading to storage channel: ${storageChannel.name}`);
    const storedMessage = await storageChannel.send({
      content: `📸 Gear for <@${userId}> | Uploaded: <t:${Math.floor(Date.now() / 1000)}:F>`,
      files: [{
        attachment: buffer,
        name: fileName
      }]
    });

    // Get the permanent URL
    const attachment = storedMessage.attachments.first();
    if (!attachment) {
      throw new Error('Failed to get attachment from stored message');
    }

    console.log(`✅ Image stored successfully: ${attachment.url}`);

    return {
      url: attachment.url,
      messageId: storedMessage.id,
      channelId: storageChannel.id
    };
  } catch (error) {
    console.error('Error uploading to Discord storage:', error);

    if (error.code === 'ECONNABORTED') {
      throw new Error('Upload timed out. Please try again with a smaller image.');
    }
    if (error.response?.status === 413) {
      throw new Error('Image is too large. Maximum size is 8MB.');
    }

    throw error;
  }
}

/**
 * Delete a stored gear screenshot
 * @param {Guild} guild - Discord guild
 * @param {string} channelId - Storage channel ID
 * @param {string} messageId - Message ID to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteFromDiscordStorage(guild, channelId, messageId) {
  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.warn(`Storage channel ${channelId} not found`);
      return false;
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      console.warn(`Storage message ${messageId} not found`);
      return false;
    }

    await message.delete();
    console.log(`✅ Deleted stored gear screenshot: ${messageId}`);
    return true;
  } catch (error) {
    console.error('Error deleting from Discord storage:', error);
    return false;
  }
}

/**
 * Get storage channel info
 * @param {Guild} guild - Discord guild
 * @returns {Promise<Object|null>} - Channel info or null
 */
async function getStorageChannelInfo(guild) {
  const STORAGE_CHANNEL_NAME = 'gear-screenshots-storage';

  const storageChannel = guild.channels.cache.find(
    ch => ch.name === STORAGE_CHANNEL_NAME && ch.type === ChannelType.GuildText
  );

  if (!storageChannel) {
    return null;
  }

  try {
    // Get message count (approximate)
    const messages = await storageChannel.messages.fetch({ limit: 100 });

    return {
      id: storageChannel.id,
      name: storageChannel.name,
      messageCount: messages.size,
      createdAt: storageChannel.createdAt
    };
  } catch (error) {
    console.error('Error getting storage channel info:', error);
    return {
      id: storageChannel.id,
      name: storageChannel.name,
      messageCount: 0,
      createdAt: storageChannel.createdAt
    };
  }
}

module.exports = {
  getOrCreateStorageChannel,
  uploadToDiscordStorage,
  deleteFromDiscordStorage,
  getStorageChannelInfo
};