const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ObjectId } = require('mongodb');
const { addBalance } = require('../utils/balanceManager');

const MAX_PARTICIPANTS = 6;
const VOTE_DURATION = 60 * 1000; // 60 seconds per vote

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
      `💰 **Prize Pool:** Unknown\n` +
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
  const raidId = parts[1];
  const choiceIndex = parseInt(parts[2], 10);

  const { gamblingRaids } = collections;
  const userId = interaction.user.id;

  // Find raid
  const raid = await gamblingRaids.findOne({ _id: new ObjectId(raidId) });

  if (!raid) {
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
        `💰 **Prize:** ${raid.lootAmount.toLocaleString()} coins\n` +
        `👥 **Raiders:** ${raid.participants.length}\n\n` +
        `⏱️ Starting first decision in 5 seconds...`
      )
      .setFooter({ text: 'Get ready to vote!' })
      .setTimestamp();

    await message.edit({ embeds: [introEmbed], components: [] });

    console.log(`✅ Raid intro shown, scheduling first decision...`);

    // Wait 5 seconds, then start first decision
    setTimeout(async () => {
      console.log(`⏰ 5 seconds elapsed, presenting first decision...`);
      try {
        await presentDecision(client, collections, raidId, scenario, 0);
      } catch (err) {
        console.error(`❌ Error in presentDecision:`, err);
      }
    }, 5000);

  } catch (error) {
    console.error('❌ Error starting scenario:', error);
  }
}

async function presentDecision(client, collections, raidId, scenario, stepIndex) {
  const { gamblingRaids } = collections;

  console.log(`📊 Presenting decision ${stepIndex + 1} for raid ${raidId}`);

  try {
    const raid = await gamblingRaids.findOne({ _id: raidId });

    if (!raid || raid.status !== 'active') {
      console.error(`❌ Raid not found or not active:`, raid?.status);
      return;
    }

    const step = scenario.steps[stepIndex];

    if (!step) {
      console.log(`✅ No more steps, finishing raid...`);
      // No more steps - finish raid
      await finishRaid(client, collections, raidId, scenario);
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

    // Create choice buttons
    const buttons = new ActionRowBuilder();
    step.choices.forEach((choice, index) => {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(`raid_vote:${raidId}:${index}`)
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
    const raid = await gamblingRaids.findOne({ _id: raidId });

    if (!raid || raid.status !== 'active') {
      console.error(`❌ Raid not found or not active`);
      return;
    }

    const voteKey = `step_${raid.currentStep}`;
    const currentVotes = raid.votes[voteKey] || {};

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
      const { getScenarioById } = require('../utils/raidScenarios');
      const scenario = getScenarioById(raid.scenarioId);
      const step = scenario.steps[raid.currentStep];
      winningChoice = Math.floor(Math.random() * step.choices.length);
      console.log(`⚠️ No votes cast, randomly chose option ${winningChoice}`);
    }

    // If tie, pick random
    if (tiedChoices.length > 1) {
      winningChoice = tiedChoices[Math.floor(Math.random() * tiedChoices.length)];
      console.log(`🎲 Tie-breaker: chose option ${winningChoice}`);
    }

    console.log(`✅ Winning choice: ${winningChoice} with ${maxVotes} vote(s)`);

    // Record choice
    await gamblingRaids.updateOne(
      { _id: raid._id },
      {
        $push: { choicesMade: winningChoice },
        $set: { currentStep: raid.currentStep + 1 }
      }
    );

    // Get scenario
    const { getScenarioById } = require('../utils/raidScenarios');
    const scenario = getScenarioById(raid.scenarioId);

    const step = scenario.steps[raid.currentStep];
    const chosenOption = step.choices[winningChoice];

    // Show result
    const channel = await client.channels.fetch(raid.channelId);
    const message = await channel.messages.fetch(raid.messageId);

    const resultEmbed = new EmbedBuilder()
      .setColor(0x3498DB) // Blue
      .setTitle(`${scenario.emoji} Decision Made!`)
      .setDescription(
        `**The raiders chose:** ${chosenOption.emoji} ${chosenOption.label}\n\n` +
        `${chosenOption.result}\n\n` +
        `⏱️ Next decision in 3 seconds...`
      )
      .setTimestamp();

    await message.edit({ embeds: [resultEmbed], components: [] });

    console.log(`✅ Vote result shown, scheduling next decision...`);

    // Wait 3 seconds, then next decision
    setTimeout(async () => {
      console.log(`⏰ Moving to next decision...`);
      try {
        await presentDecision(client, collections, raidId, scenario, raid.currentStep + 1);
      } catch (err) {
        console.error(`❌ Error presenting next decision:`, err);
      }
    }, 3000);

  } catch (error) {
    console.error('❌ Error processing votes:', error);
  }
}

async function finishRaid(client, collections, raidId, scenario) {
  const { gamblingRaids } = collections;

  console.log(`🏁 Finishing raid ${raidId}`);

  try {
    const raid = await gamblingRaids.findOne({ _id: raidId });

    if (!raid) {
      console.error(`❌ Raid not found`);
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
          `Congratulations! You were chosen as the lucky winner!\n\n` +
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