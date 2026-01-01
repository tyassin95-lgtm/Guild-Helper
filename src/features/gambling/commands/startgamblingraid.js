const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PermissionFlagsBits } = require('discord.js');

const SIGNUP_DURATION = 3 * 60 * 1000; // 3 minutes
const MIN_PARTICIPANTS = 1;
const MAX_PARTICIPANTS = 6;

async function handleStartGamblingRaid({ interaction, collections }) {
  // Admin check
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to start a gambling raid.',
      flags: [64]
    });
  }

  const { gamblingRaids } = collections;
  const guildId = interaction.guildId;

  // Check if there's already an active raid in this guild
  const existingRaid = await gamblingRaids.findOne({
    guildId,
    status: { $in: ['signup', 'active'] }
  });

  if (existingRaid) {
    return interaction.reply({
      content: '❌ There is already an active gambling raid in this server! Wait for it to finish.',
      flags: [64] // Ephemeral
    });
  }

  // Reply ephemerally to hide the command usage
  await interaction.reply({
    content: '✅ Starting gambling raid...',
    flags: [64] // Ephemeral - only you can see this
  });

  // Generate random loot amount (100k - 1M)
  const lootAmount = Math.floor(Math.random() * (1000000 - 100000 + 1)) + 100000;

  // Create signup embed
  const signupEmbed = new EmbedBuilder()
    .setColor(0xFFD700) // Gold
    .setTitle('🎰 GAMBLING RAID SIGNUP')
    .setDescription(
      '**A dangerous raid is forming!**\n\n' +
      `💰 **Prize Pool:** Unknown\n` +
      `👥 **Participants:** 0/${MAX_PARTICIPANTS}\n` +
      `⏱️ **Signup closes:** <t:${Math.floor((Date.now() + SIGNUP_DURATION) / 1000)}:R>\n\n` +
      `⚠️ **You must work TOGETHER to complete the raid!**\n` +
      `Minimum ${MIN_PARTICIPANTS} participants required to start.`
    )
    .addFields({
      name: '📋 Current Raiders',
      value: '*No one has joined yet...*',
      inline: false
    })
    .setFooter({ text: 'Click "Join Raid" to participate!' })
    .setTimestamp();

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('raid_join')
      .setLabel('⚔️ Join Raid')
      .setStyle(ButtonStyle.Success)
  );

  // Post the embed as a new message in the channel
  const message = await interaction.channel.send({
    embeds: [signupEmbed],
    components: [joinButton]
  });

  // Create raid document
  const raid = {
    guildId,
    channelId: interaction.channelId,
    messageId: message.id,
    status: 'signup',
    participants: [],
    currentStep: 0,
    choicesMade: [],
    votes: {},
    lootAmount,
    winner: null,
    scenarioId: null,

    // 🔒 NEW
    processingStep: false,
    voteTimeoutId: null,

    createdAt: new Date(),
    expiresAt: new Date(Date.now() + SIGNUP_DURATION)
  };


  const result = await gamblingRaids.insertOne(raid);

  // Schedule raid start after 5 minutes
  setTimeout(async () => {
    await startRaidPhase(interaction.client, collections, result.insertedId);
  }, SIGNUP_DURATION);

  console.log(`✅ Gambling raid created in ${interaction.guild.name} with ${lootAmount.toLocaleString()} coins prize`);
}

async function startRaidPhase(client, collections, raidId) {
  const { gamblingRaids } = collections;

  try {
    const raid = await gamblingRaids.findOne({ _id: raidId });

    if (!raid || raid.status !== 'signup') {
      console.log('Raid not found or already started');
      return;
    }

    // Check minimum participants
    if (raid.participants.length < MIN_PARTICIPANTS) {
      // Cancel raid - not enough participants
      const channel = await client.channels.fetch(raid.channelId);
      const message = await channel.messages.fetch(raid.messageId);

      const cancelEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ RAID CANCELLED')
        .setDescription(
          `Not enough participants joined the raid.\n\n` +
          `**Required:** ${MIN_PARTICIPANTS} raiders\n` +
          `**Joined:** ${raid.participants.length} raider${raid.participants.length !== 1 ? 's' : ''}\n\n` +
          `The raid has been cancelled.`
        )
        .setTimestamp();

      await message.edit({ embeds: [cancelEmbed], components: [] });

      // Delete raid from database
      await gamblingRaids.deleteOne({ _id: raidId });

      console.log(`❌ Raid cancelled - not enough participants`);
      return;
    }

    // Select random scenario
    const { getRandomScenario } = require('../utils/raidScenarios');
    const scenario = getRandomScenario();

    // Update raid status
    await gamblingRaids.updateOne(
      { _id: raidId },
      {
        $set: {
          status: 'active',
          scenarioId: scenario.id,
          currentStep: 0
        }
      }
    );

    // Start the scenario
    const { startScenario } = require('../handlers/raidButtons');
    await startScenario(client, collections, raidId, scenario);

  } catch (error) {
    console.error('Error starting raid phase:', error);
  }
}

module.exports = { handleStartGamblingRaid };