const { EmbedBuilder } = require('discord.js');

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
    .setFooter({ text: '💡 Answer quickly! You have 20 seconds.' });

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
      `**Total Earned:** ${finalStreak * 50} coins`;

  } else if (isCorrect) {
    color = 0x00FF00; // Green
    title = isPerfectRun ? '🎉 PERFECT RUN!' : '✅ CORRECT!';

    if (isPerfectRun) {
      description = 
        `**Amazing!** You got all 10 questions correct!\n\n` +
        `**This Question:** +50 coins\n` +
        `**Perfect Run Bonus:** +250 coins\n` +
        `**Total This Session:** ${finalStreak * 50 + 250} coins\n\n` +
        `🏆 You're a trivia master!`;
    } else if (isComplete) {
      description = 
        `**Session Complete!**\n\n` +
        `**Final Streak:** ${finalStreak} correct answers\n` +
        `**Total Earned:** ${finalStreak * 50} coins\n\n` +
        `Great job! Play again to beat your record!`;
    } else {
      description = 
        `**+${coinsEarned} coins**\n\n` +
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
      `**Total Earned:** ${finalStreak * 50} coins\n\n` +
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
  createTriviaResultEmbed
};