const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ObjectId } = require('mongodb');
const { addBalance } = require('../utils/balanceManager');
const { createTriviaEmbed, createTriviaResultEmbed } = require('../embeds/triviaEmbeds');

function createTriviaButtons(sessionId) {
  const row = new ActionRowBuilder();

  const labels = ['A', 'B', 'C', 'D'];

  for (let i = 0; i < 4; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`trivia_answer:${sessionId}:${i}`)
        .setLabel(labels[i])
        .setStyle(ButtonStyle.Primary)
    );
  }

  return row;
}

async function handleTriviaButtons({ interaction, collections }) {
  // FIXED: only three parts in the customId (action, sessionId, answerIndex)
  const [action, sessionId, answerIndex] = interaction.customId.split(':');
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  const { triviaSessions, triviaStats } = collections;

  // Validate ObjectId format
  if (!ObjectId.isValid(sessionId)) {
    return interaction.update({
      content: '❌ Invalid session. Please start a new trivia game with `/trivia`.',
      embeds: [],
      components: []
    });
  }

  // Get session
  const session = await triviaSessions.findOne({ _id: new ObjectId(sessionId) });

  if (!session) {
    return interaction.update({
      content: '❌ Session expired or not found.',
      embeds: [],
      components: []
    });
  }

  // Verify it's the right user
  if (session.userId !== userId) {
    return interaction.reply({
      content: '❌ This is not your trivia session!',
      flags: [64]
    });
  }

  const currentQuestion = session.questions[session.currentQuestionIndex];
  const selectedAnswer = parseInt(answerIndex, 10);
  const isCorrect = selectedAnswer === currentQuestion.correctIndex;

  let currentStreak = session.currentStreak;
  let totalEarned = 0;

  if (isCorrect) {
    currentStreak++;
    totalEarned = 50; // 50 coins per correct answer

    // Award coins (NO gambling stat tracking - it's earned from trivia, not gambling)
    await addBalance({
      userId,
      guildId,
      amount: 50,
      collections
    });

    // Update trivia-specific stats
    await triviaStats.updateOne(
      { userId, guildId },
      {
        $inc: {
          totalCorrect: 1,
          totalEarned: 50
        },
        $set: {
          lastPlayed: new Date()
        },
        $setOnInsert: {
          totalIncorrect: 0,
          longestStreak: 0,
          perfectRuns: 0
        }
      },
      { upsert: true }
    );

    // Check if this is question 10 and they got all 10 correct
    if (session.currentQuestionIndex === 9 && currentStreak === 10) {
      // Perfect run! 250 bonus (NO gambling stat tracking)
      await addBalance({
        userId,
        guildId,
        amount: 250,
        collections
      });

      totalEarned = 50 + 250; // This question + bonus

      await triviaStats.updateOne(
        { userId, guildId },
        {
          $inc: {
            perfectRuns: 1,
            totalEarned: 250
          },
          $max: {
            longestStreak: currentStreak
          }
        }
      );

      // Delete session
      await triviaSessions.deleteOne({ _id: session._id });

      const resultEmbed = createTriviaResultEmbed(true, currentQuestion, selectedAnswer, currentStreak, totalEarned, true);

      return interaction.update({
        embeds: [resultEmbed],
        components: []
      });
    }

    // Move to next question
    const nextQuestionIndex = session.currentQuestionIndex + 1;

    if (nextQuestionIndex < session.questions.length) {
      // Update session
      await triviaSessions.updateOne(
        { _id: session._id },
        {
          $set: {
            currentQuestionIndex: nextQuestionIndex,
            currentStreak,
            expiresAt: new Date(Date.now() + 20000)
          }
        }
      );

      // Show result briefly, then next question
      const resultEmbed = createTriviaResultEmbed(true, currentQuestion, selectedAnswer, currentStreak, totalEarned);

      await interaction.update({
        embeds: [resultEmbed],
        components: []
      });

      // Wait 2 seconds, then show next question
      setTimeout(async () => {
        // re-fetch session to get latest questions/indices in case of race conditions
        const freshSession = await triviaSessions.findOne({ _id: session._id });
        if (!freshSession) return; // session ended meanwhile

        const nextQuestion = freshSession.questions[nextQuestionIndex];
        const nextEmbed = createTriviaEmbed(nextQuestion, nextQuestionIndex, freshSession.questions.length, currentStreak);
        const nextButtons = createTriviaButtons(sessionId);

        try {
          await interaction.editReply({
            embeds: [nextEmbed],
            components: [nextButtons]
          });

          // Set timeout for next question
          setTimeout(async () => {
            const stillActive = await triviaSessions.findOne({ _id: session._id });

            if (stillActive && stillActive.currentQuestionIndex === nextQuestionIndex) {
              // User didn't answer in time - end session
              await triviaSessions.deleteOne({ _id: session._id });

              // Update stats for longest streak
              await triviaStats.updateOne(
                { userId, guildId },
                {
                  $max: {
                    longestStreak: currentStreak
                  }
                }
              );

              const timeoutEmbed = createTriviaResultEmbed(false, nextQuestion, -1, currentStreak, 0, false, true);

              try {
                await interaction.editReply({
                  embeds: [timeoutEmbed],
                  components: []
                });
              } catch (err) {
                // Message may have been deleted
              }
            }
          }, 20000);

        } catch (err) {
          // Message may have been deleted or interaction no longer valid
          await triviaSessions.deleteOne({ _id: session._id });
        }
      }, 2000);

    } else {
      // Last question, session complete
      await triviaSessions.deleteOne({ _id: session._id });

      await triviaStats.updateOne(
        { userId, guildId },
        {
          $max: {
            longestStreak: currentStreak
          }
        }
      );

      const resultEmbed = createTriviaResultEmbed(true, currentQuestion, selectedAnswer, currentStreak, totalEarned, false, false, true);

      return interaction.update({
        embeds: [resultEmbed],
        components: []
      });
    }

  } else {
    // Wrong answer - session ends
    await triviaSessions.deleteOne({ _id: session._id });

    // Update stats
    await triviaStats.updateOne(
      { userId, guildId },
      {
        $inc: {
          totalIncorrect: 1
        },
        $max: {
          longestStreak: currentStreak
        },
        $set: {
          lastPlayed: new Date()
        },
        $setOnInsert: {
          totalCorrect: 0,
          totalEarned: 0,
          perfectRuns: 0
        }
      },
      { upsert: true }
    );

    const resultEmbed = createTriviaResultEmbed(false, currentQuestion, selectedAnswer, currentStreak, 0);

    return interaction.update({
      embeds: [resultEmbed],
      components: []
    });
  }
}

module.exports = {
  handleTriviaButtons,
  createTriviaButtons
};