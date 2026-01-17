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
   * Get attendance emoji based on percentage
   * Green (🟢) for ≥70%, Orange (🟠) for 40-69%, Red (🔴) for <40%
   */
  static getAttendanceEmoji(percentage) {
    if (percentage >= 70) return '🟢';
    if (percentage >= 40) return '🟠';
    return '🔴';
  }

  /**
   * Calculate and format attendance percentage
   */
  static formatAttendance(eventsAttended, totalEvents) {
    // Handle edge cases
    if (!totalEvents || totalEvents === 0) {
      return '-- 0%';
    }

    if (!eventsAttended || eventsAttended === 0) {
      return '🔴 0%';
    }

    // Calculate percentage
    const percentage = Math.round((eventsAttended / totalEvents) * 100);
    const emoji = this.getAttendanceEmoji(percentage);

    return `${emoji} ${percentage}%`;
  }

  /**
   * Build roster messages with proper pagination
   */
  static async buildRosterMessages(guild, players, collections) {
    const messages = [];
    const maxMessageLength = 1800; // Safer limit (was 1900)

    // Sort players: first by role (tank > healer > dps), then alphabetically by display name
    const roleOrder = { tank: 0, healer: 1, dps: 2 };

    // Fetch all member display names, PvP event counts, PvP bonuses, and attendance data
    const { pvpActivityRanking, pvpBonuses, guildSettings } = collections;

    // Get guild's weekly event count (for attendance calculation)
    const settings = await guildSettings.findOne({ guildId: guild.id });
    const weeklyTotalEvents = settings?.weeklyTotalEvents || 0;

    const playersWithData = await Promise.all(
      players.map(async (p) => {
        const member = await guild.members.fetch(p.userId).catch(() => null);
        const displayName = member ? member.displayName : 'Unknown';

        // Get PvP events attended (all-time)
        const pvpData = await pvpActivityRanking.findOne({
          userId: p.userId,
          guildId: guild.id
        });
        const pvpEvents = pvpData?.totalEvents || 0;

        // Get PvP weekly roll bonus and attendance
        const bonusData = await pvpBonuses.findOne({
          userId: p.userId,
          guildId: guild.id
        });
        const rollBonus = bonusData?.bonusCount || 0;
        const eventsAttended = bonusData?.eventsAttended || 0;

        return { ...p, displayName, pvpEvents, rollBonus, eventsAttended };
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
      'Name            Role      Weapons              CP         Total Events   Weekly Bonus   Attendance\n' +
      '──────────────────────────────────────────────────────────────────────────────────────────────────────\n' +
      '```\n';

    const messageFooter = '──────────────────────────────────────────────────────────────────────────────────────────────────────\n' +
      '🛡️ Tank | 💚 Healer | ⚔️ DPS | 🟢 ≥70% | 🟠 40-69% | 🔴 <40%';

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
      const bonusFormatted = `+${player.rollBonus}`.padEnd(14);

      // NEW: Calculate and format attendance
      const attendanceFormatted = this.formatAttendance(player.eventsAttended, weeklyTotalEvents).padEnd(10);

      // Table row (separate code block per player)
      const memberEntry = '```\n' + 
        `${name} ${roleEmoji}${roleDisplay} ${weaponsShort} ${cpFormatted} ${eventsFormatted} ${bonusFormatted} ${attendanceFormatted}\n` +
        '```\n';
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