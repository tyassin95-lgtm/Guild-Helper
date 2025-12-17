const { getRoleEmoji, getRoleDisplayName } = require('./roleDetection');

class RosterBuilder {
  /**
   * Format combat power with K/M suffixes
   */
  static formatCombatPower(cp) {
    if (!cp || cp === 0) return '0';
    if (cp >= 1000000) {
      return `${(cp / 1000000).toFixed(1)}M`;
    }
    if (cp >= 1000) {
      return `${(cp / 1000).toFixed(1)}K`;
    }
    return cp.toString();
  }

  /**
   * Build roster messages with proper pagination
   */
  static async buildRosterMessages(guild, players) {
    const messages = [];
    const maxMessageLength = 1900; // Safe limit for Discord messages

    // Sort players: first by role (tank > healer > dps), then alphabetically by display name
    const roleOrder = { tank: 0, healer: 1, dps: 2 };

    // Fetch all member display names first
    const playersWithNames = await Promise.all(
      players.map(async (p) => {
        const member = await guild.members.fetch(p.userId).catch(() => null);
        const displayName = member ? member.displayName : 'Unknown';
        return { ...p, displayName };
      })
    );

    playersWithNames.sort((a, b) => {
      const roleCompare = (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
      if (roleCompare !== 0) return roleCompare;
      return a.displayName.localeCompare(b.displayName);
    });

    // Calculate total CP
    const totalCP = playersWithNames.reduce((sum, p) => sum + (p.cp || 0), 0);

    // Build message content
    let messageContent = '**🏰 GUILD ROSTER**\n';
    messageContent += `📅 <t:${Math.floor(Date.now() / 1000)}:F> | 👥 ${playersWithNames.length} Members | 💪 ${this.formatCombatPower(totalCP)} Total CP\n`;
    messageContent += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    messageContent += '```\n';
    messageContent += 'Name               Role    Weapons           CP\n';
    messageContent += '─────────────────────────────────────────────────────────────\n';
    messageContent += '```\n';

    let membersList = '';
    let currentMessage = messageContent;
    let messageCount = 0;

    for (const player of playersWithNames) {
      // Build member data row
      const name = player.displayName.substring(0, 18).padEnd(18);

      const roleEmoji = getRoleEmoji(player.role);
      const roleDisplay = getRoleDisplayName(player.role).substring(0, 7).padEnd(7);

      // Weapons column
      const weapon1 = player.weapon1 || 'Unknown';
      const weapon2 = player.weapon2 || 'Unknown';
      const weaponsShort = `${weapon1.substring(0, 8)}/${weapon2.substring(0, 8)}`.substring(0, 17).padEnd(17);

      // CP column
      const cpFormatted = this.formatCombatPower(player.cp || 0).padStart(8);

      // Discord mention (outside code block)
      const discordMention = `<@${player.userId}>`;

      // Table row (inside code block)
      const tableRow = '```\n' + `${name} ${roleEmoji}${roleDisplay} ${weaponsShort} ${cpFormatted}\n` + '```\n';

      const memberEntry = discordMention + '\n' + tableRow;

      // Footer
      const footer = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
                     '🛡️ Tank | 💚 Healer | ⚔️ DPS\n';

      // Check if adding this entry would exceed the limit
      if ((currentMessage + membersList + memberEntry + footer).length > maxMessageLength) {
        // Finalize current message
        currentMessage += membersList;
        currentMessage += `📄 Page ${messageCount + 1}\n`;
        currentMessage += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        currentMessage += '🛡️ Tank | 💚 Healer | ⚔️ DPS\n';

        messages.push({ content: currentMessage });
        messageCount++;

        // Start new message
        currentMessage = '**🏰 GUILD ROSTER (Continued)**\n';
        currentMessage += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        currentMessage += '```\n';
        currentMessage += 'Name               Role    Weapons           CP\n';
        currentMessage += '─────────────────────────────────────────────────────────────\n';
        currentMessage += '```\n';
        membersList = '';
      }

      membersList += memberEntry;
    }

    // Finalize last message
    currentMessage += membersList;
    if (messages.length > 0) {
      currentMessage += `📄 Page ${messageCount + 1}\n`;
    }
    currentMessage += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    currentMessage += '🛡️ Tank | 💚 Healer | ⚔️ DPS';

    messages.push({ content: currentMessage });

    return messages;
  }

  /**
   * Build empty roster message
   */
  static buildEmptyRosterMessage() {
    const content = '**🏰 GUILD ROSTER**\n' +
      `📅 <t:${Math.floor(Date.now() / 1000)}:F> | 👥 0 Members | 💪 0 Total CP\n` +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '```\n' +
      '\n' +
      '              No members registered yet!\n' +
      '              Use /myinfo to join the roster.\n' +
      '\n' +
      '```\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '🛡️ Tank | 💚 Healer | ⚔️ DPS\n';

    return [{ content }];
  }
}

module.exports = RosterBuilder;