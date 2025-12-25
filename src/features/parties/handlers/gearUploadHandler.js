const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPlayerInfoEmbed } = require('../embed');
const { updateGuildRoster } = require('../commands/guildroster');

/**
 * Handle gear screenshot uploads via message attachments
 */
async function handleGearUpload({ message, collections }) {
  const { dmContexts, partyPlayers, guildRosters } = collections;

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

  try {
    // Get guild context
    const guildId = context.guildId;
    const guild = await message.client.guilds.fetch(guildId).catch(() => null);

    // Store the Discord CDN URL in database
    await partyPlayers.updateOne(
      { userId: message.author.id, guildId: guildId },
      { 
        $set: { 
          gearScreenshotUrl: attachment.url,
          gearScreenshotUpdatedAt: new Date()
        } 
      },
      { upsert: true }
    );

    // Clear the upload context
    await dmContexts.deleteOne({ 
      userId: message.author.id, 
      type: 'gear_upload' 
    });

    // Get updated player info
    const playerInfo = await partyPlayers.findOne({
      userId: message.author.id,
      guildId: guildId
    });

    // Fetch member for embed
    let member = null;
    if (guild) {
      try {
        member = await guild.members.fetch(message.author.id);
      } catch (err) {
        console.warn('Could not fetch member:', err.message);
      }
    }

    if (!member) {
      member = {
        displayName: message.author.username,
        user: message.author
      };
    }

    const embed = await createPlayerInfoEmbed(playerInfo, member, collections);

    const row1 = new ActionRowBuilder().addComponents(
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

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('party_upload_gear')
        .setLabel('Upload Gear Screenshot')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📸')
    );

    // Update guild roster if it exists
    if (guild) {
      const rosterRecord = await guildRosters.findOne({ guildId: guild.id });
      if (rosterRecord && rosterRecord.channelId) {
        // Update roster in background (don't wait)
        updateGuildRoster(guild, rosterRecord.channelId, collections).catch(err => {
          console.error('Error auto-updating guild roster:', err);
        });
      }
    }

    return message.reply({
      content: '✅ **Gear screenshot uploaded successfully!**\n\n' +
               'Your gear is now visible in the guild roster.',
      embeds: [embed],
      components: [row1, row2]
    });

  } catch (err) {
    console.error('Error handling gear upload:', err);
    return message.reply({
      content: '❌ Failed to save your gear screenshot. Please try again using `/myinfo`.'
    });
  }
}

module.exports = { handleGearUpload };