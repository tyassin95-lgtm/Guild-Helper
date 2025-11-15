const { getRandomQuestions } = require('../utils/triviaQuestions');
const { createTriviaEmbed } = require('../embeds/triviaEmbeds');
const { createTriviaButtons } = require('../handlers/triviaButtons');

async function handleTrivia({ interaction, collections }) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const { triviaSessions } = collections;

  // Check if user already has an active session
  const existingSession = await triviaSessions.findOne({ userId, guildId });

  if (existingSession) {
    return interaction.reply({
      content: '❌ You already have an active trivia session! Finish it first or wait for it to expire.',
      flags: [64]
    });
  }

  // Get 10 random questions
  const questions = getRandomQuestions(10);

  if (questions.length === 0) {
    return interaction.reply({
      content: '❌ Unable to load trivia questions. Please try again later.',
      flags: [64]
    });
  }

  // Create session in database
  const session = {
    userId,
    guildId,
    currentStreak: 0,
    questions,
    currentQuestionIndex: 0,
    expiresAt: new Date(Date.now() + 20000), // 20 seconds for first question
    startedAt: new Date()
  };

  const result = await triviaSessions.insertOne(session);
  const sessionId = result.insertedId.toString();

  // Get first question
  const currentQuestion = questions[0];

  // Create embed and buttons
  const embed = createTriviaEmbed(currentQuestion, 0, 20, 0);
  const buttons = createTriviaButtons(sessionId);

  await interaction.reply({
    embeds: [embed],
    components: [buttons]
  });

  // Set timeout to end session if no answer
  setTimeout(async () => {
    const stillActive = await triviaSessions.findOne({ _id: result.insertedId });

    if (stillActive && stillActive.currentQuestionIndex === 0) {
      // User didn't answer in time
      await triviaSessions.deleteOne({ _id: result.insertedId });

      try {
        await interaction.editReply({
          content: '⏱️ Time\'s up! You took too long to answer. Session ended.',
          embeds: [],
          components: []
        });
      } catch (err) {
        // Message may have been deleted
      }
    }
  }, 20000);
}

module.exports = { handleTrivia };