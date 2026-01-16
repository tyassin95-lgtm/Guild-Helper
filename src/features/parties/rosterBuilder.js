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
    const maxMessageLength = 1800; // Safer limit (was 1900)

    // Sort players: first by role (tank > healer > dps), then alphabetically by display name
    const roleOrder = { tank: 0, healer: 1, dps: 2 };

    // Fetch all member display names, PvP event counts, and PvP bonuses
    const { pvpActivityRanking, pvpBonuses } = collections;

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

        // Get PvP weekly roll bonus
        const bonusData = await pvpBonuses.findOne({
          userId: p.userId,
          guildId: guild.id
        });
        const rollBonus = bonusData?.bonusCount || 0;

        return { ...p, displayName, pvpEvents, rollBonus };
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
    const messageHeader = '**🏰 GUILD ROSTER**\n' +
      `📅 <t:${Math.floor(Date.now() / 1000)}:F> | 👥 ${playersWithData.length} Members | 💪 ${this.formatCombatPower(totalCP)} Total CP\n` +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '```\n' +
      'Name            Role      Weapons              CP         Total Events   Weekly Bonus\n' +
      '─────────────────────────────────────────────────────────────────────────────────────────────\n' +
      '```\n';

    const messageFooter = '─────────────────────────────────────────────────────────────────────────────────────────────\n' +
      '🛡️ Tank | 💚 Healer | ⚔️ DPS\n📸 Gear links appear next to each player mention';

    let currentMessage = messageHeader;
    let currentLength = messageHeader.length;

    for (let i = 0; i < playersWithData.length; i++) {
      const player = playersWithData[i];

      // Build member data row
      const name = player.displayName.substring(0, 15).padEnd(15);
      const roleEmoji = getRoleEmoji(player.role);
      const roleDisplay = getRoleDisplayName(player.role).substring(0, 7).padEnd(7);
      const weapon1 = player.weapon1 || 'Unknown';
      const weapon2 = player.weapon2 || 'Unknown';
      const weaponsShort = `${weapon1.substring(0, 10)}/${weapon2.substring(0, 10)}`.substring(0, 20).padEnd(20);
      const cpFormatted = this.formatCombatPower(player.cp || 0).padEnd(10);
      const eventsFormatted = player.pvpEvents.toString().padEnd(14);
      const bonusFormatted = `+${player.rollBonus}`.padEnd(4);

      // Discord mention with gear link
      let gearLink;
      if (player.gearScreenshotUrl) {
        gearLink = ` [${player.displayName}'s Gear](<${player.gearScreenshotUrl}>)`;
      } else {
        gearLink = ` [No Gear Uploaded](<https://example.com>)`;
      }
      const discordMention = `<@${player.userId}>` + gearLink;

      // Table row (inside code block)
      const tableRow = '```\n' + 
        `${name} ${roleEmoji}${roleDisplay} ${weaponsShort} ${cpFormatted} ${eventsFormatted} ${bonusFormatted}` + 
        '```';

      const memberEntry = discordMention + '\n' + tableRow + '\n';
      const memberEntryLength = memberEntry.length;

      // Check if this is the last player
      const isLastPlayer = (i === playersWithData.length - 1);

      // Calculate what the message would be with this entry and footer (if last)
      const potentialLength = currentLength + memberEntryLength + (isLastPlayer ? messageFooter.length : 0);

      // If adding this entry would exceed limit, finalize current message and start new one
      if (potentialLength > maxMessageLength) {
        // Finalize current message (no footer for continuation)
        messages.push({ content: currentMessage });

        // Start new message (no header for continuation - seamless)
        currentMessage = memberEntry;
        currentLength = memberEntryLength;
      } else {
        // Add to current message
        currentMessage += memberEntry;
        currentLength += memberEntryLength;
      }

      // If this is the last player, add footer
      if (isLastPlayer) {
        currentMessage += messageFooter;
      }
    }

    // Push the final message
    if (currentMessage.trim().length > 0) {
      messages.push({ content: currentMessage });
    }

    return messages;
  }

  /**
   * Build empty roster message
   */
  static buildEmptyRosterMessage() {
    const content = '**🏰 GUILD ROSTER**\n' +
      `📅 <t:${Math.floor(Date.now() / 1000)}:F> | 👥 0 Members | 💪 0 Total CP\n` +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '```\n' +
      '\n' +
      '              No members registered yet!\n' +
      '              Use /myinfo to join the roster.\n' +
      '\n' +
      '```\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '🛡️ Tank | 💚 Healer | ⚔️ DPS\n';

    return [{ content }];
  }
}

module.exports = RosterBuilder;