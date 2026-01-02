const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ObjectId } = require('mongodb');
const { addBalance } = require('../utils/balanceManager');

const MAX_PARTICIPANTS = 6;
const VOTE_DURATION = 60 * 1000; // 60 seconds per vote
const RESULT_DISPLAY_TIME = 30 * 1000; // 30 seconds to read results
const INTRO_DELAY = 30 * 1000; // 30 seconds to read intro

async function handleRaidButtons({ interaction, collections }) {
  const customId = interaction.customId;

  if (customId === 'raid_join') {
    return handleRaidJoin({ interaction, collections });
  }

  if (customId.startsWith('raid_vote:')) {
    return handleRaidVote({ interaction, collections });
  }
}

async function handleRaidJoin({ interaction, collections }) {
  const { gamblingRaids } = collections;
  const userId = interaction.user.id;
  const messageId = interaction.message.id;

  // Find the raid
  const raid = await gamblingRaids.findOne({ messageId });

  if (!raid) {
    return interaction.reply({
      content: '❌ This raid no longer exists.',
      flags: [64]
    });
  }

  if (raid.status !== 'signup') {
    return interaction.reply({
      content: '❌ Signup for this raid has closed!',
      flags: [64]
    });
  }

  // Check if already joined
  if (raid.participants.includes(userId)) {
    return interaction.reply({
      content: '❌ You have already joined this raid!',
      flags: [64]
    });
  }

  // Check if raid is full
  if (raid.participants.length >= MAX_PARTICIPANTS) {
    return interaction.reply({
      content: '❌ This raid is full! (Maximum 6 participants)',
      flags: [64]
    });
  }

  // Add participant
  await gamblingRaids.updateOne(
    { _id: raid._id },
    { $push: { participants: userId } }
  );

  // Update embed
  const updatedRaid = await gamblingRaids.findOne({ _id: raid._id });
  const participantList = await Promise.all(
    updatedRaid.participants.map(async (id) => {
      try {
        const member = await interaction.guild.members.fetch(id);
        return `• ${member.displayName}`;
      } catch (err) {
        return `• Unknown User`;
      }
    })
  );

  const signupEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎰 GAMBLING RAID SIGNUP')
    .setDescription(
      '**A dangerous raid is forming!**\n\n' +
      `💰 **Prize:** Unknown\n` +
      `👥 **Participants:** ${updatedRaid.participants.length}/${MAX_PARTICIPANTS}\n` +
      `⏱️ **Signup closes:** <t:${Math.floor((updatedRaid.createdAt.getTime() + 3 * 60 * 1000) / 1000)}:R>\n\n` +
      `⚠️ **You must work TOGETHER to complete the raid!**\n` +
      `Minimum 2 participant required to start.`
    )
    .addFields({
      name: '📋 Current Raiders',
      value: participantList.join('\n'),
      inline: false
    })
    .setFooter({ text: 'Click "Join Raid" to participate!' })
    .setTimestamp();

  await interaction.update({ embeds: [signupEmbed] });

  // Send confirmation to user
  await interaction.followUp({
    content: `✅ You've joined the raid! Prepare for adventure...`,
    flags: [64]
  });
}

async function handleRaidVote({ interaction, collections }) {
  const parts = interaction.customId.split(':');
  const raidIdString = parts[1];
  const choiceIndex = parseInt(parts[2], 10);

  const { gamblingRaids } = collections;
  const userId = interaction.user.id;

  // CRITICAL FIX: Convert string to ObjectId with better error handling
  let raidId;
  try {
    raidId = new ObjectId(raidIdString);
    console.log(`🗳️ Processing vote - Raid ID: ${raidId.toString()}, User: ${userId}, Choice: ${choiceIndex}`);
  } catch (err) {
    console.error(`❌ Invalid raid ID format: "${raidIdString}"`, err);
    return interaction.reply({
      content: '❌ Invalid raid ID format.',
      flags: [64]
    });
  }

  // Find raid with better error logging
  const raid = await gamblingRaids.findOne({ _id: raidId });

  if (!raid) {
    // Debug: Check if raid exists with string ID (fallback)
    const raidByString = await gamblingRaids.findOne({ '_id': raidIdString }).catch(() => null);
    console.error(`❌ Raid not found with ObjectId: ${raidId.toString()}`);
    console.error(`   Attempted fallback string lookup: ${raidByString ? 'FOUND' : 'NOT FOUND'}`);

    // Show available raids for debugging
    const availableRaids = await gamblingRaids.find({ guildId: interaction.guildId }).project({ _id: 1, status: 1 }).toArray();
    console.error(`   Available raids in guild:`, availableRaids);

    return interaction.reply({
      content: '❌ This raid no longer exists or has ended.',
      flags: [64]
    });
  }

  if (raid.status !== 'active') {
    return interaction.reply({
      content: '❌ This raid is not currently active.',
      flags: [64]
    });
  }

  // Check if user is a participant
  if (!raid.participants.includes(userId)) {
    return interaction.reply({
      content: '❌ You are not part of this raid!',
      flags: [64]
    });
  }

  // Check if user already voted for this step
  const voteKey = `step_${raid.currentStep}`;
  if (!raid.votes) raid.votes = {}; // safety
  if (!raid.votes[voteKey]) raid.votes[voteKey] = {};
  if (raid.votes[voteKey][userId] !== undefined) {
    return interaction.reply({
      content: '❌ You have already voted for this decision!',
      flags: [64]
    });
  }

  // Record vote
  await gamblingRaids.updateOne(
    { _id: raid._id },
    {
      $set: {
        [`votes.${voteKey}.${userId}`]: choiceIndex
      }
    }
  );

  console.log(`✅ Vote recorded for user ${userId} on raid ${raidId.toString()}`);

  await interaction.reply({
    content: `✅ Vote recorded!`,
    flags: [64]
  });

  // Check if all participants have voted
  const updatedRaid = await gamblingRaids.findOne({ _id: raid._id });
  const currentVotes = updatedRaid.votes[voteKey] || {};
  const voteCount = Object.keys(currentVotes).length;

  if (voteCount === updatedRaid.participants.length) {
    console.log(`✅ All ${voteCount} participants voted, processing immediately...`);

    await processVotes(
      interaction.client,
      collections,
      raid._id,
      raid.currentStep
    );
  } else {
    console.log(`⏳ ${voteCount}/${updatedRaid.participants.length} votes received for raid ${raidId.toString()}`);
  }
}

async function startScenario(client, collections, raidId, scenario) {
  const { gamblingRaids } = collections;

  console.log(`🎬 Starting scenario for raid ${raidId.toString()}`);
  console.log(`   Raid ID type: ${typeof raidId}, Is ObjectId: ${raidId instanceof ObjectId}`);

  try {
    const raid = await gamblingRaids.findOne({ _id: raidId });

    if (!raid) {
      console.error(`❌ Raid ${raidId.toString()} not found in startScenario`);
      return;
    }

    const channel = await client.channels.fetch(raid.channelId).catch(err => {
      console.error(`❌ Failed to fetch channel ${raid.channelId}:`, err);
      return null;
    });

    if (!channel) {
      console.error(`❌ Channel ${raid.channelId} not found`);
      return;
    }

    const message = await channel.messages.fetch(raid.messageId).catch(err => {
      console.error(`❌ Failed to fetch message ${raid.messageId}:`, err);
      return null;
    });

    if (!message) {
      console.error(`❌ Message ${raid.messageId} not found`);
      return;
    }

    // Create intro embed
    const introEmbed = new EmbedBuilder()
      .setColor(0x9B59B6) // Purple
      .setTitle(`${scenario.emoji} ${scenario.title}`)
      .setDescription(
        `**The raid begins!**\n\n` +
        `${scenario.intro}\n\n` +
        `💰 **Prize:** Unknown\n` +
        `👥 **Raiders:** ${raid.participants.length}\n\n` +
        `⏱️ Starting first decision in 30 seconds...\n` +
        `*Read the story carefully!*`
      )
      .setFooter({ text: 'Get ready to vote!' })
      .setTimestamp();

    await message.edit({ embeds: [introEmbed], components: [] });

    console.log(`✅ Raid intro shown for raid ID: ${raidId.toString()}`);
    console.log(`   Raid type: ${typeof raidId}, Is ObjectId: ${raidId instanceof ObjectId}`);
    console.log(`   Scheduling first decision in 30 seconds...`);

    // Wait 30 seconds, then start first decision
    setTimeout(async () => {
      console.log(`⏰ 30 seconds elapsed, presenting first decision for raid ${raidId.toString()}...`);
      try {
        await presentDecision(client, collections, raidId, 0);
      } catch (err) {
        console.error(`❌ Error in presentDecision:`, err);
      }
    }, INTRO_DELAY);

  } catch (error) {
    console.error('❌ Error starting scenario:', error);
  }
}

async function presentDecision(client, collections, raidId, stepIndex) {
  const { gamblingRaids } = collections;

  // Ensure raidId is ObjectId
  if (!(raidId instanceof ObjectId)) {
    try {
      raidId = new ObjectId(raidId);
    } catch (err) {
      console.error('❌ Invalid raidId passed to presentDecision:', raidId);
      return;
    }
  }

  console.log(`📊 Presenting decision ${stepIndex + 1} for raid ${raidId.toString()}`);
  console.log(`   Raid ID type: ${typeof raidId}, Is ObjectId: ${raidId instanceof ObjectId}`);

  try {
    const raid = await gamblingRaids.findOne({ _id: raidId });
    if (!raid) {
      console.error(`❌ Raid not found in presentDecision: ${raidId.toString()}`);
      return;
    }

    await gamblingRaids.updateOne(
      { _id: raidId },
      { $set: { processingStep: false } }
    );

    if (raid.status !== 'active') {
      console.error(`❌ Raid not active in presentDecision: ${raid.status}`);
      return;
    }

    const { getScenarioById } = require('../utils/raidScenarios');
    const scenario = getScenarioById(raid.scenarioId);
    if (!scenario) {
      console.error(`❌ Scenario not found: ${raid.scenarioId}`);
      return;
    }

    const step = scenario.steps[stepIndex];
    if (!step) {
      console.log(`✅ No more steps (step ${stepIndex}), finishing raid ${raidId.toString()}...`);
      return finishRaid(client, collections, raidId);
    }

    const channel = await client.channels.fetch(raid.channelId);
    if (!channel) {
      console.error(`❌ Channel not found`);
      return;
    }

    // Create participant mentions
    const participantMentions = raid.participants.map(id => `<@${id}>`).join(' ');

    const decisionEmbed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle(`${scenario.emoji} Decision ${stepIndex + 1}/${scenario.steps.length}`)
      .setDescription(`${step.text}\n\n⏱️ **You have 60 seconds to vote!**`)
      .setFooter({ text: 'Vote for your preferred choice!' })
      .setTimestamp();

    const buttons = new ActionRowBuilder();
    step.choices.forEach((choice, index) => {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`raid_vote:${raidId.toString()}:${index}`)
          .setLabel(choice.label)
          .setEmoji(choice.emoji)
          .setStyle(ButtonStyle.Primary)
      );
    });

    // Send a NEW message with participant mentions instead of editing
    const newMessage = await channel.send({ 
      content: `🎰 **VOTE NOW!** ${participantMentions}`,
      embeds: [decisionEmbed], 
      components: [buttons] 
    });

    // Update the raid with the new message ID so we can track it
    await gamblingRaids.updateOne(
      { _id: raidId },
      { $set: { messageId: newMessage.id } }
    );

    console.log(`✅ Decision ${stepIndex + 1} presented successfully for raid ${raidId.toString()}`);

    setTimeout(() => {
      processVotes(client, collections, raidId, stepIndex).catch(console.error);
    }, VOTE_DURATION);

  } catch (err) {
    console.error('❌ Error presenting decision:', err);
  }
}

async function processVotes(client, collections, raidId, expectedStep) {
  const { gamblingRaids } = collections;

  // Ensure raidId is ObjectId
  if (!(raidId instanceof ObjectId)) {
    try {
      raidId = new ObjectId(raidId);
    } catch (err) {
      console.error('❌ Invalid raidId in processVotes:', raidId);
      return;
    }
  }

  console.log(`🗳️ Processing votes for raid ${raidId.toString()}, step ${expectedStep}`);
  console.log(`   Raid ID type: ${typeof raidId}, Is ObjectId: ${raidId instanceof ObjectId}`);

  let locked = false;

  try {
    const raid = await gamblingRaids.findOne({ _id: raidId });
    if (!raid || raid.status !== 'active') {
      console.warn(`⚠️ Cannot process votes - raid ${raidId.toString()} not found or inactive`);
      return;
    }

    if (expectedStep !== undefined && raid.currentStep !== expectedStep) {
      console.log(`⚠️ Ignoring stale processVotes call for step ${expectedStep}, current step is ${raid.currentStep}`);
      return;
    }

    if (raid.processingStep) {
      console.log('⚠️ Votes already processing for this step');
      return;
    }

    await gamblingRaids.updateOne({ _id: raidId }, { $set: { processingStep: true } });
    locked = true;

    const voteKey = `step_${raid.currentStep}`;
    const currentVotes = raid.votes?.[voteKey] || {};

    const { getScenarioById } = require('../utils/raidScenarios');
    const scenario = getScenarioById(raid.scenarioId);
    if (!scenario) return;

    const step = scenario.steps[raid.currentStep];
    if (!step) return;

    // Count votes
    const voteCounts = {};
    Object.values(currentVotes).forEach(idx => {
      voteCounts[idx] = (voteCounts[idx] || 0) + 1;
    });

    console.log(`📊 Vote counts for step ${raid.currentStep}:`, voteCounts);

    // Determine winning choice
    let winningChoice = 0;
    let maxVotes = 0;
    const tiedChoices = [];

    Object.entries(voteCounts).forEach(([choice, count]) => {
      const c = parseInt(choice, 10);
      if (count > maxVotes) {
        maxVotes = count;
        winningChoice = c;
        tiedChoices.length = 0;
        tiedChoices.push(c);
      } else if (count === maxVotes) {
        tiedChoices.push(c);
      }
    });

    if (Object.keys(voteCounts).length === 0 || tiedChoices.length > 1) {
      winningChoice = tiedChoices.length > 0
        ? tiedChoices[Math.floor(Math.random() * tiedChoices.length)]
        : Math.floor(Math.random() * step.choices.length);
      console.log(`🎲 Tie or no votes - randomly selected choice ${winningChoice}`);
    } else {
      console.log(`✅ Winning choice: ${winningChoice} with ${maxVotes} vote(s)`);
    }

    const chosenOption = step.choices[winningChoice];

    const updateResult = await gamblingRaids.findOneAndUpdate(
      { _id: raidId },
      {
        $push: { choicesMade: winningChoice },
        $inc: { currentStep: 1 },
        $unset: { [`votes.step_${raid.currentStep}`]: '' }
      },
      { returnDocument: 'after' }
    );

    const nextStepIndex = updateResult.value.currentStep;

    const channel = await client.channels.fetch(raid.channelId);
    const message = await channel.messages.fetch(raid.messageId);

    const resultEmbed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle('Decision Made!')
      .setDescription(`**The raiders chose:** ${chosenOption.emoji} ${chosenOption.label}\n\n${chosenOption.result}\n\n⏱️ Next decision in 30 seconds...`);

    await message.edit({ embeds: [resultEmbed], components: [] });

    console.log(`✅ Moving to step ${nextStepIndex} in 30 seconds...`);

    setTimeout(() => {
      presentDecision(client, collections, raidId, nextStepIndex).catch(console.error);
    }, RESULT_DISPLAY_TIME);

  } catch (err) {
    console.error('❌ Error processing votes:', err);
  } finally {
    if (locked) {
      await gamblingRaids.updateOne({ _id: raidId }, { $set: { processingStep: false } });
    }
  }
}

async function finishRaid(client, collections, raidId) {
  const { gamblingRaids } = collections;

  // Ensure raidId is ObjectId
  if (!(raidId instanceof ObjectId)) {
    try {
      raidId = new ObjectId(raidId);
    } catch (err) {
      console.error('❌ Invalid raidId in finishRaid:', raidId);
      return;
    }
  }

  console.log(`🏁 Finishing raid ${raidId.toString()}`);

  try {
    const raid = await gamblingRaids.findOneAndUpdate(
      { _id: raidId },
      { $set: { status: 'finished' } },
      { returnDocument: 'after' }
    ).then(res => res.value);

    if (!raid) {
      console.error(`❌ Raid not found in finishRaid`);
      return;
    }

    const { getScenarioById } = require('../utils/raidScenarios');
    const scenario = getScenarioById(raid.scenarioId);
    if (!scenario) return;

    const winner = raid.participants[Math.floor(Math.random() * raid.participants.length)];
    console.log(`🎰 Winner selected: ${winner}`);

    await addBalance({ userId: winner, guildId: raid.guildId, amount: raid.lootAmount, collections });

    await gamblingRaids.updateOne({ _id: raid._id }, { $set: { winner } });

    const channel = await client.channels.fetch(raid.channelId);
    const message = await channel.messages.fetch(raid.messageId);

    let storySummary = `${scenario.intro}\n\n`;
    scenario.steps.forEach((step, index) => {
      const choiceIndex = raid.choicesMade[index];
      const choice = step.choices[choiceIndex];
      storySummary += `**Decision ${index + 1}:** ${choice.emoji} ${choice.label}\n${choice.result}\n\n`;
    });
    storySummary += scenario.outro;

    let winnerName = 'Unknown User';
    try { winnerName = (await channel.guild.members.fetch(winner)).displayName; } catch { winnerName = `<@${winner}>`; }

    const finishEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle(`${scenario.emoji} ${scenario.title} - COMPLETE!`)
      .setDescription(`**The raid has concluded!**\n\n${storySummary}\n═══════════════════════════════════════\n\n🎰 **LUCKY WINNER:** ${winnerName}\n💰 **Prize Won:** ${raid.lootAmount.toLocaleString()} coins\n\nCongratulations to the winner! 🎉`)
      .setFooter({ text: 'Thanks for participating!' })
      .setTimestamp();

    await message.edit({ embeds: [finishEmbed], components: [] });

    console.log(`✅ Raid finished successfully`);

    try {
      const winnerUser = await client.users.fetch(winner);
      const winnerDMEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎰 YOU WON THE RAID!')
        .setDescription(`Congratulations! You have picked up the loot!\n\n**Raid:** ${scenario.title}\n**Prize:** ${raid.lootAmount.toLocaleString()} coins\n\nThe coins have been added to your balance!`)
        .setTimestamp();

      await winnerUser.send({ embeds: [winnerDMEmbed] });
    } catch (err) {
      console.warn(`⚠️ Could not send DM to winner ${winner}`);
    }

  } catch (error) {
    console.error('❌ Error finishing raid:', error);
  }
}

module.exports = {
  handleRaidButtons,
  startScenario
};