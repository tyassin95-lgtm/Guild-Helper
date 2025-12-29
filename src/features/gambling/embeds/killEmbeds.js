const { EmbedBuilder } = require('discord.js');

/**
 * Create the public kill result embed that everyone in the channel sees
 */
function createKillResultEmbed(success, killer, target, amount, scenario, killerStats, killerNewBalance, targetNewBalance, cooldownTimestamp, killerDisplayName, targetDisplayName) {
  const color = success ? 0x00FF00 : 0xFF0000; // Green for success, Red for failure
  const resultText = success ? '✅ KILL SUCCESSFUL' : '❌ KILL FAILED';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('💀 ELIMINATION ATTEMPT 💀')
    .setDescription(
      `${scenario.emoji} ${scenario.text}\n\n` +
      `═══════════════════════════════════════\n\n` +
      `⚔️ **ATTACKER:** ${killerDisplayName}\n` +
      `🎯 **TARGET:** ${targetDisplayName}\n` +
      `💰 **STAKES:** ${amount.toLocaleString()} coins\n\n` +
      `${resultText}\n\n` +
      `═══════════════════════════════════════\n\n` +
      `📊 **NEW BALANCES:**\n` +
      (success 
        ? `${killerDisplayName}: ${(killerNewBalance - amount).toLocaleString()} → **${killerNewBalance.toLocaleString()}** coins (+${amount.toLocaleString()})\n${targetDisplayName}: ${amount.toLocaleString()} → **${targetNewBalance.toLocaleString()}** coins (-${amount.toLocaleString()})`
        : `${killerDisplayName}: ${amount.toLocaleString()} → **${killerNewBalance.toLocaleString()}** coins (-${amount.toLocaleString()})\n${targetDisplayName}: ${(targetNewBalance - amount).toLocaleString()} → **${targetNewBalance.toLocaleString()}** coins (+${amount.toLocaleString()})`) +
      `\n\n⏰ Next kill attempt available <t:${cooldownTimestamp}:R>`
    )
    .setTimestamp();

  return embed;
}

/**
 * Create DM embed for the killer (private notification)
 */
function createKillerDMEmbed(success, target, amount, newBalance, stats) {
  const color = success ? 0x00FF00 : 0xFF0000;
  const title = success ? '💀 KILL SUCCESSFUL!' : '💀 KILL FAILED!';
  const resultText = success 
    ? `✅ You successfully eliminated ${target.username}!\n\n💰 **You stole:** ${amount.toLocaleString()} coins`
    : `❌ Your attempt on ${target.username} failed!\n\n💸 **You lost:** ${amount.toLocaleString()} coins (ALL your money)`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `${resultText}\n\n` +
      `💵 **Your new balance:** ${newBalance.toLocaleString()} coins\n\n` +
      `═══════════════════════════════════════\n\n` +
      `📊 **Your Stats:**\n` +
      `• Successful Kills: **${stats.successfulKills}**\n` +
      `• Deaths: **${stats.deaths}**\n` +
      `• Total Stolen: **${stats.totalCoinsStolen.toLocaleString()}** coins\n` +
      `• Total Lost: **${stats.totalCoinsLost.toLocaleString()}** coins\n` +
      `• K/D Ratio: **${stats.deaths > 0 ? (stats.successfulKills / stats.deaths).toFixed(2) : stats.successfulKills.toFixed(2)}**\n` +
      (stats.biggestHeist > 0 ? `• Biggest Heist: **${stats.biggestHeist.toLocaleString()}** coins\n` : '') +
      (stats.biggestLoss > 0 ? `• Biggest Loss: **${stats.biggestLoss.toLocaleString()}** coins\n` : '')
    )
    .setTimestamp();

  return embed;
}

/**
 * Create DM embed for the target (private notification)
 */
function createTargetDMEmbed(success, killer, amount, newBalance, stats) {
  const color = success ? 0xFF0000 : 0x00FF00;
  const title = success ? '💀 YOU\'VE BEEN ELIMINATED!' : '💀 YOU SURVIVED!';
  const resultText = success 
    ? `${killer.username} attempted to kill you and **succeeded**!\n\n💸 **You lost:** ${amount.toLocaleString()} coins (ALL your money)`
    : `${killer.username} attempted to kill you but **failed**!\n\n💰 **You gained:** ${amount.toLocaleString()} coins (ALL their money)`;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `${resultText}\n\n` +
      `💵 **Your new balance:** ${newBalance.toLocaleString()} coins\n\n` +
      `═══════════════════════════════════════\n\n` +
      `📊 **Your Stats:**\n` +
      `• Successful Kills: **${stats.successfulKills}**\n` +
      `• Deaths: **${stats.deaths}**\n` +
      `• Total Stolen: **${stats.totalCoinsStolen.toLocaleString()}** coins\n` +
      `• Total Lost: **${stats.totalCoinsLost.toLocaleString()}** coins\n` +
      `• K/D Ratio: **${stats.deaths > 0 ? (stats.successfulKills / stats.deaths).toFixed(2) : stats.successfulKills.toFixed(2)}**\n` +
      (stats.biggestHeist > 0 ? `• Biggest Heist: **${stats.biggestHeist.toLocaleString()}** coins\n` : '') +
      (stats.biggestLoss > 0 ? `• Biggest Loss: **${stats.biggestLoss.toLocaleString()}** coins\n` : '') +
      (success ? `\n\n💡 Use \`/gamblingdaily\` to rebuild your fortune!` : `\n\n🎉 You turned the tables on them!`)
    )
    .setTimestamp();

  return embed;
}

module.exports = {
  createKillResultEmbed,
  createKillerDMEmbed,
  createTargetDMEmbed
};