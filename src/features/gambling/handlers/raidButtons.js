const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ObjectId } = require('mongodb');
const { addBalance } = require('../utils/balanceManager');

const VOTE_DURATION = 60 * 1000;
const RESULT_DISPLAY_TIME = 30 * 1000;
const INTRO_DELAY = 30 * 1000;

async function handleRaidButtons({ interaction, collections }) {
  if (interaction.customId === 'raid_join') {
    return handleRaidJoin({ interaction, collections });
  }

  if (interaction.customId.startsWith('raid_vote:')) {
    return handleRaidVote({ interaction, collections });
  }
}

async function handleRaidJoin({ interaction, collections }) {
  const { gamblingRaids } = collections;
  const raid = await gamblingRaids.findOne({ messageId: interaction.message.id });
  if (!raid || raid.status !== 'signup') return;

  if (raid.participants.includes(interaction.user.id)) {
    return interaction.reply({ content: '❌ Already joined.', flags: [64] });
  }

  await gamblingRaids.updateOne(
    { _id: raid._id },
    { $push: { participants: interaction.user.id } }
  );

  await interaction.reply({ content: '✅ Joined raid!', flags: [64] });
}

async function disablePreviousDecision(client, raid) {
  if (!raid.currentDecisionMessageId) return;

  try {
    const channel = await client.channels.fetch(raid.currentDecisionChannelId);
    const message = await channel.messages.fetch(raid.currentDecisionMessageId);

    const disabled = message.components.map(row => {
      const r = ActionRowBuilder.from(row);
      r.components = r.components.map(b => ButtonBuilder.from(b).setDisabled(true));
      return r;
    });

    await message.edit({ components: disabled });
  } catch {}
}

async function handleRaidVote({ interaction, collections }) {
  const [, raidIdStr, stepStr, choiceStr] = interaction.customId.split(':');
  const raidId = new ObjectId(raidIdStr);
  const step = Number(stepStr);
  const choice = Number(choiceStr);

  const { gamblingRaids } = collections;
  const raid = await gamblingRaids.findOne({ _id: raidId });

  if (!raid || raid.status !== 'active') {
    return interaction.reply({ content: '❌ Raid inactive.', flags: [64] });
  }

  if (raid.currentStep !== step) {
    return interaction.reply({ content: '⚠️ This decision expired.', flags: [64] });
  }

  if (!raid.participants.includes(interaction.user.id)) {
    return interaction.reply({ content: '❌ Not a participant.', flags: [64] });
  }

  const key = `step_${step}`;
  if (raid.votes?.[key]?.[interaction.user.id] !== undefined) {
    return interaction.reply({ content: '❌ Already voted.', flags: [64] });
  }

  await gamblingRaids.updateOne(
    { _id: raidId },
    { $set: { [`votes.${key}.${interaction.user.id}`]: choice } }
  );

  await interaction.reply({ content: '✅ Vote recorded!', flags: [64] });

  const updated = await gamblingRaids.findOne({ _id: raidId });
  if (Object.keys(updated.votes[key]).length === updated.participants.length) {
    processVotes(interaction.client, collections, raidId, step);
  }
}

async function startScenario(client, collections, raidId, scenario) {
  const { gamblingRaids } = collections;

  const raid = await gamblingRaids.findOne({ _id: raidId });
  const channel = await client.channels.fetch(raid.channelId);
  const message = await channel.messages.fetch(raid.messageId);

  const intro = new EmbedBuilder()
    .setTitle(`${scenario.emoji} ${scenario.title}`)
    .setDescription(scenario.intro);

  await message.edit({ embeds: [intro], components: [] });

  setTimeout(() => {
    presentDecision(client, collections, raidId);
  }, INTRO_DELAY);
}

async function presentDecision(client, collections, raidId) {
  const { gamblingRaids } = collections;
  const raid = await gamblingRaids.findOne({ _id: raidId });
  if (!raid || raid.status !== 'active') return;

  const { getScenarioById } = require('../utils/raidScenarios');
  const scenario = getScenarioById(raid.scenarioId);
  const step = scenario.steps[raid.currentStep];

  if (!step) return finishRaid(client, collections, raidId);

  await disablePreviousDecision(client, raid);

  const channel = await client.channels.fetch(raid.channelId);

  const embed = new EmbedBuilder()
    .setTitle(`${scenario.emoji} Decision ${raid.currentStep + 1}`)
    .setDescription(step.text);

  const row = new ActionRowBuilder();
  step.choices.forEach((c, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`raid_vote:${raidId}:${raid.currentStep}:${i}`)
        .setLabel(c.label)
        .setEmoji(c.emoji)
        .setStyle(ButtonStyle.Primary)
    );
  });

  const msg = await channel.send({ embeds: [embed], components: [row] });

  await gamblingRaids.updateOne(
    { _id: raidId },
    {
      $set: {
        currentDecisionMessageId: msg.id,
        currentDecisionChannelId: channel.id
      }
    }
  );

  setTimeout(() => {
    processVotes(client, collections, raidId, raid.currentStep);
  }, VOTE_DURATION);
}

async function processVotes(client, collections, raidId, expectedStep) {
  const { gamblingRaids } = collections;
  const raid = await gamblingRaids.findOne({ _id: raidId });

  if (!raid || raid.currentStep !== expectedStep) return;

  const { getScenarioById } = require('../utils/raidScenarios');
  const scenario = getScenarioById(raid.scenarioId);
  const step = scenario.steps[raid.currentStep];

  const votes = raid.votes[`step_${raid.currentStep}`] || {};
  const counts = {};

  Object.values(votes).forEach(v => counts[v] = (counts[v] || 0) + 1);

  let winner = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  if (winner === undefined) winner = Math.floor(Math.random() * step.choices.length);

  await gamblingRaids.updateOne(
    { _id: raidId },
    {
      $push: { choicesMade: Number(winner) },
      $inc: { currentStep: 1 },
      $unset: { [`votes.step_${raid.currentStep}`]: '' }
    }
  );

  setTimeout(() => {
    presentDecision(client, collections, raidId);
  }, RESULT_DISPLAY_TIME);
}

async function finishRaid(client, collections, raidId) {
  const { gamblingRaids } = collections;
  const raid = await gamblingRaids.findOneAndUpdate(
    { _id: raidId },
    { $set: { status: 'finished' } },
    { returnDocument: 'after' }
  ).then(r => r.value);

  await disablePreviousDecision(client, raid);

  const winner = raid.participants[Math.floor(Math.random() * raid.participants.length)];
  await addBalance({ userId: winner, guildId: raid.guildId, amount: raid.lootAmount, collections });

  const channel = await client.channels.fetch(raid.channelId);
  await channel.send(`🎉 <@${winner}> won **${raid.lootAmount.toLocaleString()} coins**!`);
}

module.exports = {
  handleRaidButtons,
  startScenario
};