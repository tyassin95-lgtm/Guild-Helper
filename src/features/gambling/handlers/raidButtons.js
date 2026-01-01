const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ObjectId } = require('mongodb');
const { addBalance } = require('../utils/balanceManager');

const MAX_PARTICIPANTS = 6;
const VOTE_DURATION = 60 * 1000; // 60 seconds per vote
const RESULT_DISPLAY_TIME = 30 * 1000; // 8 seconds to read results
const INTRO_DELAY = 30 * 1000; // 8 seconds to read intro

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
      `⏱️ **Signup closes:** <t:${Math.floor(updatedRaid.expiresAt.getTime() / 1000)}:R>\n\n` +
      `⚠️ **You must work TOGETHER to complete the raid!**\n` +
      `Minimum 1 participant required to start.`
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

  // CRITICAL FIX: Convert string to ObjectId
  let raidId;
  try {
    raidId = new ObjectId(raidIdString);
  } catch (err) {
    console.error(`❌ Invalid raid ID format: ${raidIdString}`);
    return interaction.reply({
      content: '❌ Invalid raid ID.',
      flags: [64]
    });
  }

  // Find raid
  const raid = await gamblingRaids.findOne({ _id: raidId });

  if (!raid) {
    console.log(`❌ Raid not found: ${raidIdString}`);
    return interaction.reply({
      content: '❌ This raid no longer exists.',
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
  if (raid.votes[voteKey] && raid.votes[voteKey][userId] !== undefined) {
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
    // All votes in - process immediately
    await processVotes(interaction.client, collections, raid._id);
  }
}

async function startScenario(client, collections, raidId, scenario) {
  const { gamblingRaids } = collections;

  try {
    const raid = await gamblingRaids.findOne({ _id: raidId });

    if (!raid) {
      console.error(`❌ Raid ${raidId} not found in startScenario`);
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

    console.log(`✅ Raid intro shown, scheduling first decision in 30 seconds...`);

    // Wait 8 seconds, then start first decision
    setTimeout(async () => {
      console.log(`⏰ 30 seconds elapsed, presenting first decision...`);
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

  console.log(`📊 Presenting decision ${stepIndex + 1} for raid ${raidId}`);

  try {
    // Fetch fresh raid data every time
    const raid = await gamblingRaids.findOne({ _id: raidId });

    if (!raid) {
      console.error(`❌ Raid not found`);
      return;
    }

    if (raid.status !== 'active') {
      console.error(`❌ Raid not active, status is: ${raid.status}`);
      return;
    }

    // Get the scenario
    const { getScenarioById } = require('../utils/raidScenarios');
    const scenario = getScenarioById(raid.scenarioId);

    if (!scenario) {
      console.error(`❌ Scenario not found: ${raid.scenarioId}`);
      return;
    }

    const step = scenario.steps[stepIndex];

    if (!step) {
      console.log(`✅ No more steps (step ${stepIndex}), finishing raid...`);
      // No more steps - finish raid
      await finishRaid(client, collections, raidId);
      return;
    }

    const channel = await client.channels.fetch(raid.channelId).catch(err => {
      console.error(`❌ Failed to fetch channel:`, err);
      return null;
    });

    if (!channel) {
      console.error(`❌ Channel not found`);
      return;
    }

    const message = await channel.messages.fetch(raid.messageId).catch(err => {
      console.error(`❌ Failed to fetch message:`, err);
      return null;
    });

    if (!message) {
      console.error(`❌ Message not found`);
      return;
    }

    // Create decision embed
    const decisionEmbed = new EmbedBuilder()
      .setColor(0xE67E22) // Orange
      .setTitle(`${scenario.emoji} Decision ${stepIndex + 1}/${scenario.steps.length}`)
      .setDescription(
        `${step.text}\n\n` +
        `⏱️ **You have 60 seconds to vote!**`
      )
      .setFooter({ text: 'Vote for your preferred choice!' })
      .setTimestamp();

    // Create choice buttons - CRITICAL FIX: Use raidId.toString()
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

    await message.edit({ embeds: [decisionEmbed], components: [buttons] });
    console.log(`✅ Decision ${stepIndex + 1} presented successfully`);

    // Set timeout for voting (60 seconds)
    setTimeout(async () => {
      console.log(`⏰ Vote timeout for step ${stepIndex + 1}, processing votes...`);
      try {
        await processVotes(client, collections, raidId);
      } catch (err) {
        console.error(`❌ Error processing votes:`, err);
      }
    }, VOTE_DURATION);

  } catch (error) {
    console.error('❌ Error presenting decision:', error);
  }
}

async function processVotes(client, collections, raidId) {
  const { gamblingRaids } = collections;

  console.log(`🗳️ Processing votes for raid ${raidId}`);

  try {
    // Fetch fresh raid data
    const raid = await gamblingRaids.findOne({ _id: raidId });

    if (!raid || raid.status !== 'active') {
      console.error(`❌ Raid not found or not active`);
      return;
    }

    const voteKey = `step_${raid.currentStep}`;
    const currentVotes = raid.votes[voteKey] || {};

    // Get the scenario
    const { getScenarioById } = require('../utils/raidScenarios');
    const scenario = getScenarioById(raid.scenarioId);

    if (!scenario) {
      console.error(`❌ Scenario not found: ${raid.scenarioId}`);
      return;
    }

    const step = scenario.steps[raid.currentStep];

    if (!step) {
      console.error(`❌ Step not found: ${raid.currentStep}`);
      return;
    }

    // Count votes
    const voteCounts = {};
    Object.values(currentVotes).forEach(choiceIndex => {
      voteCounts[choiceIndex] = (voteCounts[choiceIndex] || 0) + 1;
    });

    // Find winning choice (or random if tie)
    let winningChoice = 0;
    let maxVotes = 0;
    const tiedChoices = [];

    Object.entries(voteCounts).forEach(([choice, count]) => {
      const choiceNum = parseInt(choice, 10);
      if (count > maxVotes) {
        maxVotes = count;
        winningChoice = choiceNum;
        tiedChoices.length = 0;
        tiedChoices.push(choiceNum);
      } else if (count === maxVotes) {
        tiedChoices.push(choiceNum);
      }
    });

    // If no votes at all, pick random
    if (Object.keys(voteCounts).length === 0) {
      winningChoice = Math.floor(Math.random() * step.choices.length);
      console.log(`⚠️ No votes cast, randomly chose option ${winningChoice}`);
    }

    // If tie, pick random
    if (tiedChoices.length > 1) {
      winningChoice = tiedChoices[Math.floor(Math.random() * tiedChoices.length)];
      console.log(`🎲 Tie-breaker: chose option ${winningChoice}`);
    }

    console.log(`✅ Winning choice: ${winningChoice} with ${maxVotes} vote(s)`);

    const chosenOption = step.choices[winningChoice];

    // Update raid and get the NEW currentStep value
    const updateResult = await gamblingRaids.findOneAndUpdate(
      { _id: raid._id },
      {
        $push: { choicesMade: winningChoice },
        $inc: { currentStep: 1 }
      },
      { returnDocument: 'after' }
    );

    const updatedRaid = updateResult.value;
    const nextStepIndex = updatedRaid.currentStep;

    console.log(`📝 Updated raid: currentStep is now ${nextStepIndex}`);

    // Show result
    const channel = await client.channels.fetch(raid.channelId);
    const message = await channel.messages.fetch(raid.messageId);

    const resultEmbed = new EmbedBuilder()
      .setColor(0x3498DB) // Blue
      .setTitle(`${scenario.emoji} Decision Made!`)
      .setDescription(
        `**The raiders chose:** ${chosenOption.emoji} ${chosenOption.label}\n\n` +
        `${chosenOption.result}\n\n` +
        `⏱️ Next decision in 30 seconds...\n` +
        `*Take your time to read!*`
      )
      .setTimestamp();

    await message.edit({ embeds: [resultEmbed], components: [] });

    console.log(`✅ Vote result shown, scheduling next decision (step ${nextStepIndex}) in 8 seconds...`);

    // Wait 8 seconds, then next decision
    setTimeout(async () => {
      console.log(`⏰ Moving to decision ${nextStepIndex + 1}...`);
      try {
        await presentDecision(client, collections, raidId, nextStepIndex);
      } catch (err) {
        console.error(`❌ Error presenting next decision:`, err);
      }
    }, RESULT_DISPLAY_TIME);

  } catch (error) {
    console.error('❌ Error processing votes:', error);
  }
}

async function finishRaid(client, collections, raidId) {
  const { gamblingRaids } = collections;

  console.log(`🏁 Finishing raid ${raidId}`);

  try {
    const raid = await gamblingRaids.findOne({ _id: raidId });

    if (!raid) {
      console.error(`❌ Raid not found`);
      return;
    }

    // Get the scenario
    const { getScenarioById } = require('../utils/raidScenarios');
    const scenario = getScenarioById(raid.scenarioId);

    if (!scenario) {
      console.error(`❌ Scenario not found: ${raid.scenarioId}`);
      return;
    }

    // Pick random winner
    const winner = raid.participants[Math.floor(Math.random() * raid.participants.length)];
    console.log(`🎰 Winner selected: ${winner}`);

    // Award coins
    await addBalance({
      userId: winner,
      guildId: raid.guildId,
      amount: raid.lootAmount,
      collections
    });

    // Update raid
    await gamblingRaids.updateOne(
      { _id: raid._id },
      {
        $set: {
          status: 'finished',
          winner
        }
      }
    );

    const channel = await client.channels.fetch(raid.channelId);
    const message = await channel.messages.fetch(raid.messageId);

    // Build story summary
    let storySummary = `${scenario.intro}\n\n`;
    scenario.steps.forEach((step, index) => {
      const choiceIndex = raid.choicesMade[index];
      const choice = step.choices[choiceIndex];
      storySummary += `**Decision ${index + 1}:** ${choice.emoji} ${choice.label}\n`;
      storySummary += `${choice.result}\n\n`;
    });

    storySummary += scenario.outro;

    // Get winner info
    let winnerName = 'Unknown User';
    try {
      const winnerMember = await channel.guild.members.fetch(winner);
      winnerName = winnerMember.displayName;
    } catch (err) {
      winnerName = `<@${winner}>`;
    }

    const finishEmbed = new EmbedBuilder()
      .setColor(0x2ECC71) // Green
      .setTitle(`${scenario.emoji} ${scenario.title} - COMPLETE!`)
      .setDescription(
        `**The raid has concluded!**\n\n` +
        `${storySummary}\n\n` +
        `═══════════════════════════════════════\n\n` +
        `🎰 **LUCKY WINNER:** ${winnerName}\n` +
        `💰 **Prize Won:** ${raid.lootAmount.toLocaleString()} coins\n\n` +
        `Congratulations to the winner! 🎉`
      )
      .setFooter({ text: 'Thanks for participating!' })
      .setTimestamp();

    await message.edit({ embeds: [finishEmbed], components: [] });

    console.log(`✅ Raid finished successfully`);

    // Send DM to winner
    try {
      const winnerUser = await client.users.fetch(winner);
      const winnerDMEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎰 YOU WON THE RAID!')
        .setDescription(
          `Congratulations! You have picked up the loot!\n\n` +
          `**Raid:** ${scenario.title}\n` +
          `**Prize:** ${raid.lootAmount.toLocaleString()} coins\n\n` +
          `The coins have been added to your balance!`
        )
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