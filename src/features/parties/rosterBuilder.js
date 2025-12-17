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
  static async buildRosterMessages(guild, players, collections) {
    const messages = [];
    const maxMessageLength = 1900; // Safe limit for Discord messages

    // Sort players: first by role (tank > healer > dps), then alphabetically by display name
    const roleOrder = { tank: 0, healer: 1, dps: 2 };

    // Fetch all member display names and PvP event counts
    const { pvpActivityRanking } = collections;

    const playersWithData = await Promise.all(
      players.map(async (p) => {
        const member = await guild.members.fetch(p.userId).catch(() => null);
        const displayName = member ? member.displayName : 'Unknown';

        // Get PvP events attended
        const pvpData = await pvpActivityRanking.findOne({
          userId: p.userId,
          guildId: guild.id
        });
        const pvpEvents = pvpData?.totalEvents || 0;

        return { ...p, displayName, pvpEvents };
      })
    );

    playersWithData.sort((a, b) => {
      const roleCompare = (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
      if (roleCompare !== 0) return roleCompare;
      return a.displayName.localeCompare(b.displayName);
    });

    // Calculate total CP
    const totalCP = playersWithData.reduce((sum, p) => sum + (p.cp || 0), 0);

    // Build message header (only for first message)
    let messageHeader = '**🏰 GUILD ROSTER**\n';
    messageHeader += `📅 <t:${Math.floor(Date.now() / 1000)}:F> | 👥 ${playersWithData.length} Members | 💪 ${this.formatCombatPower(totalCP)} Total CP\n`;
    messageHeader += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    messageHeader += '```\n';
    messageHeader += 'Name            Role      Weapons           CP       PvP\n';
    messageHeader += '───────────────────────────────────────────────────────────────\n';
    messageHeader += '```\n';

    let membersList = '';
    let currentMessage = messageHeader;
    let isFirstMessage = true;

    for (const player of playersWithData) {
      // Build member data row
      const name = player.displayName.substring(0, 15).padEnd(15);

      const roleEmoji = getRoleEmoji(player.role);
      const roleDisplay = getRoleDisplayName(player.role).substring(0, 7).padEnd(7);

      // Weapons column
      const weapon1 = player.weapon1 || 'Unknown';
      const weapon2 = player.weapon2 || 'Unknown';
      const weaponsShort = `${weapon1.substring(0, 8)}/${weapon2.substring(0, 8)}`.substring(0, 17).padEnd(17);

      // CP column
      const cpFormatted = this.formatCombatPower(player.cp || 0).padStart(8);

      // PvP events column
      const pvpFormatted = player.pvpEvents.toString().padStart(8);

      // Discord mention (outside code block)
      const discordMention = `<@${player.userId}>`;

      // Table row (inside code block)
      const tableRow = '```\n' + `${name} ${roleEmoji}${roleDisplay} ${weaponsShort} ${cpFormatted} ${pvpFormatted}\n` + '```\n';

      const memberEntry = discordMention + '\n' + tableRow;

      // Check if adding this entry would exceed the limit
      // For continuation messages, we need a shorter header
      const continuationHeader = '```\n' +
        'Name            Role      Weapons           CP       PvP\n' +
        '───────────────────────────────────────────────────────────────\n' +
        '```\n';

      if ((currentMessage + membersList + memberEntry).length > maxMessageLength) {
        // Finalize current message (no footer for seamless continuation)
        currentMessage += membersList;
        messages.push({ content: currentMessage });

        // Start new message with just the table header (seamless continuation)
        currentMessage = continuationHeader;
        membersList = '';
        isFirstMessage = false;
      }

      membersList += memberEntry;
    }

    // Finalize last message with legend
    currentMessage += membersList;
    currentMessage += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
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
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '```\n' +
      '\n' +
      '              No members registered yet!\n' +
      '              Use /myinfo to join the roster.\n' +
      '\n' +
      '```\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '🛡️ Tank | 💚 Healer | ⚔️ DPS\n';

    return [{ content }];
  }
}

module.exports = RosterBuilder;