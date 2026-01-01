const { EmbedBuilder } = require('discord.js');

const COINS_PER_CORRECT = 500;
const PERFECT_RUN_BONUS = 2500;
const TOTAL_QUESTIONS = 10;

/**
 * Create trivia question embed
 */
function createTriviaEmbed(question, currentIndex, totalQuestions, currentStreak) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2) // Discord Blurple
    .setTitle(`🧠 TRIVIA CHALLENGE`)
    .setDescription(
      `**Question ${currentIndex + 1}/${totalQuestions}**\n\n` +
      `${question.question}\n\n` +
      `**A:** ${question.options[0]}\n` +
      `**B:** ${question.options[1]}\n` +
      `**C:** ${question.options[2]}\n` +
      `**D:** ${question.options[3]}`
    )
    .addFields(
      { name: '🔥 Current Streak', value: `${currentStreak} correct`, inline: true },
      { name: '📚 Category', value: question.category, inline: true },
      { name: '⏱️ Time Limit', value: '20 seconds', inline: true }
    )
    .setFooter({ text: `💰 ${COINS_PER_CORRECT} coins per correct answer | ${(COINS_PER_CORRECT * TOTAL_QUESTIONS).toLocaleString()} + ${PERFECT_RUN_BONUS.toLocaleString()} bonus for perfect run!` });

  return embed;
}

/**
 * Create trivia result embed
 */
function createTriviaResultEmbed(
  isCorrect, 
  question, 
  selectedAnswer, 
  finalStreak, 
  coinsEarned,
  isPerfectRun = false,
  isTimeout = false,
  isComplete = false
) {
  const correctAnswerLetter = ['A', 'B', 'C', 'D'][question.correctIndex];
  const correctAnswerText = question.options[question.correctIndex];

  let color, title, description;

  if (isTimeout) {
    color = 0xFF0000; // Red
    title = '⏱️ TIME\'S UP!';
    description = 
      `You ran out of time!\n\n` +
      `**Correct Answer:** ${correctAnswerLetter}. ${correctAnswerText}\n\n` +
      `**Final Streak:** ${finalStreak} correct answers\n` +
      `**Total Earned:** ${(finalStreak * COINS_PER_CORRECT).toLocaleString()} coins`;

  } else if (isCorrect) {
    color = 0x00FF00; // Green
    title = isPerfectRun ? '🎉 PERFECT RUN!' : '✅ CORRECT!';

    if (isPerfectRun) {
      const totalCoins = (TOTAL_QUESTIONS * COINS_PER_CORRECT) + PERFECT_RUN_BONUS;
      description = 
        `**Amazing!** You got all 10 questions correct!\n\n` +
        `**This Question:** +${COINS_PER_CORRECT} coins\n` +
        `**Perfect Run Bonus:** +${PERFECT_RUN_BONUS.toLocaleString()} coins\n` +
        `**Total This Session:** ${totalCoins.toLocaleString()} coins\n\n` +
        `🏆 You're a trivia master!`;
    } else if (isComplete) {
      description = 
        `**Session Complete!**\n\n` +
        `**Final Streak:** ${finalStreak} correct answers\n` +
        `**Total Earned:** ${(finalStreak * COINS_PER_CORRECT).toLocaleString()} coins\n\n` +
        `Great job! Play again to beat your record!`;
    } else {
      description = 
        `**+${coinsEarned.toLocaleString()} coins**\n\n` +
        `**Current Streak:** ${finalStreak} correct\n\n` +
        `Get ready for the next question...`;
    }

  } else {
    color = 0xFF0000; // Red
    title = '❌ INCORRECT!';

    const selectedAnswerLetter = ['A', 'B', 'C', 'D'][selectedAnswer];
    const selectedAnswerText = question.options[selectedAnswer];

    description = 
      `**Your Answer:** ${selectedAnswerLetter}. ${selectedAnswerText}\n` +
      `**Correct Answer:** ${correctAnswerLetter}. ${correctAnswerText}\n\n` +
      `**Final Streak:** ${finalStreak} correct answers\n` +
      `**Total Earned:** ${(finalStreak * COINS_PER_CORRECT).toLocaleString()} coins\n\n` +
      `Better luck next time!`;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description);

  if (!isTimeout && !isComplete && !isPerfectRun && isCorrect) {
    embed.setFooter({ text: '⏱️ Next question in 2 seconds...' });
  }

  return embed;
}

module.exports = {
  createTriviaEmbed,
  createTriviaResultEmbed,
  COINS_PER_CORRECT,
  PERFECT_RUN_BONUS,
  TOTAL_QUESTIONS
};