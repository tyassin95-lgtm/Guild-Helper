const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

const SIGNUP_DURATION = 3 * 60 * 1000; // 3 minutes
const MIN_PARTICIPANTS = 1;
const MAX_PARTICIPANTS = 6;

async function handleStartGamblingRaid({ interaction, collections }) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to start a gambling raid.',
      flags: [64]
    });
  }

  const { gamblingRaids } = collections;
  const guildId = interaction.guildId;

  const existingRaid = await gamblingRaids.findOne({
    guildId,
    status: { $in: ['signup', 'active'] }
  });

  if (existingRaid) {
    return interaction.reply({
      content: '❌ There is already an active gambling raid in this server!',
      flags: [64]
    });
  }

  await interaction.reply({
    content: '✅ Starting gambling raid...',
    flags: [64]
  });

  const lootAmount = Math.floor(Math.random() * (1000000 - 100000 + 1)) + 100000;

  const signupEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎰 GAMBLING RAID SIGNUP')
    .setDescription(
      `💰 **Prize Pool:** Unknown\n` +
      `👥 **Participants:** 0/${MAX_PARTICIPANTS}\n` +
      `⏱️ **Signup closes:** <t:${Math.floor((Date.now() + SIGNUP_DURATION) / 1000)}:R>`
    )
    .addFields({
      name: '📋 Current Raiders',
      value: '*No one has joined yet...*'
    })
    .setTimestamp();

  const joinButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('raid_join')
      .setLabel('⚔️ Join Raid')
      .setStyle(ButtonStyle.Success)
  );

  const message = await interaction.channel.send({
    embeds: [signupEmbed],
    components: [joinButton]
  });

  const raid = {
    guildId,
    channelId: interaction.channelId,
    messageId: message.id,

    currentDecisionMessageId: null,
    currentDecisionChannelId: null,

    status: 'signup',
    participants: [],
    currentStep: 0,
    choicesMade: [],
    votes: {},
    lootAmount,
    winner: null,
    scenarioId: null,
    processingStep: false,
    createdAt: new Date()
  };

  const result = await gamblingRaids.insertOne(raid);

  setTimeout(() => {
    startRaidPhase(interaction.client, collections, result.insertedId);
  }, SIGNUP_DURATION);
}

async function startRaidPhase(client, collections, raidId) {
  const { gamblingRaids } = collections;
  const raid = await gamblingRaids.findOne({ _id: raidId });
  if (!raid || raid.status !== 'signup') return;

  if (raid.participants.length < MIN_PARTICIPANTS) {
    const channel = await client.channels.fetch(raid.channelId);
    const message = await channel.messages.fetch(raid.messageId);
    await message.edit({ content: '❌ Raid cancelled (not enough participants).', components: [] });
    await gamblingRaids.deleteOne({ _id: raidId });
    return;
  }

  const { getRandomScenario } = require('../utils/raidScenarios');
  const scenario = getRandomScenario();

  await gamblingRaids.updateOne(
    { _id: raidId },
    { $set: { status: 'active', scenarioId: scenario.id, currentStep: 0 } }
  );

  const { startScenario } = require('../handlers/raidButtons');
  await startScenario(client, collections, raidId, scenario);
}

module.exports = { handleStartGamblingRaid };