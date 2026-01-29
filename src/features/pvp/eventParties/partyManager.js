const { ObjectId } = require('mongodb');
const { PermissionFlagsBits } = require('discord.js');
const { getRoleFromWeapons } = require('../../parties/roleDetection');

/**
 * Handle "Form Event Parties" button click
 * NOW USES WEB INTERFACE INSTEAD OF DISCORD EMBEDS
 */
async function handleFormEventParties({ interaction, eventId, collections }) {
  const { pvpEvents, parties, partyPlayers, eventParties } = collections;

  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need administrator permissions to form event parties.',
      flags: [64]
    });
  }

  await interaction.deferReply({ flags: [64] });

  try {
    // Fetch the event
    const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return interaction.editReply({
        content: '❌ Event not found.'
      });
    }

    // Get attendance data
    const notAttendingSet = new Set(event.rsvpNotAttending || []);
    const attendingSet = new Set([
      ...(event.rsvpAttending || []),
      ...(event.rsvpMaybe || [])
    ]);

    if (attendingSet.size === 0) {
      return interaction.editReply({
        content: '❌ No members have RSVP\'d as attending or maybe for this event.\n\n' +
                 'Event parties can only be formed when people have signed up.'
      });
    }

    console.log(`\n=== Forming Event Parties ===`);
    console.log(`Attending/Maybe: ${attendingSet.size}`);
    console.log(`Not Attending: ${notAttendingSet.size}`);

    // Fetch all static parties (exclude reserve)
    const staticParties = await parties.find({ 
      guildId: interaction.guildId,
      isReserve: { $ne: true }
    }).sort({ partyNumber: 1 }).toArray();

    console.log(`Static parties found: ${staticParties.length}`);

    // Process each static party
    const processedParties = [];
    const availableMembers = [];

    for (const party of staticParties) {
      const result = await processStaticParty(
        party,
        notAttendingSet,
        interaction.guild,
        partyPlayers
      );

      if (result.status === 'disbanded') {
        // Add remaining members to available pool
        availableMembers.push(...result.remainingMembers.map(m => ({
          ...m,
          source: `Party ${party.partyNumber} (disbanded)`
        })));
      } else {
        processedParties.push(result);
      }
    }

    console.log(`Processed parties: ${processedParties.length}`);
    console.log(`Available from disbanded: ${availableMembers.length}`);

    // Find unassigned attendees
    const assignedUserIds = new Set(
      processedParties.flatMap(p => p.members.map(m => m.userId))
    );

    const availableFromDisbanded = new Set(availableMembers.map(m => m.userId));

    for (const userId of attendingSet) {
      if (!assignedUserIds.has(userId) && !availableFromDisbanded.has(userId)) {
        const memberData = await fetchMemberData(userId, interaction.guild, partyPlayers);
        if (memberData) {
          availableMembers.push({
            ...memberData,
            source: 'Unassigned'
          });
        }
      }
    }

    console.log(`Total available for placement: ${availableMembers.length}`);

    // Calculate summary statistics
    const summary = {
      totalAttending: attendingSet.size,
      partiesIntact: processedParties.filter(p => p.status === 'intact').length,
      partiesModified: processedParties.filter(p => p.status === 'modified').length,
      partiesDisbanded: staticParties.length - processedParties.length,
      membersRemoved: processedParties.reduce((sum, p) => sum + p.removedMembers.length, 0),
      membersAvailable: availableMembers.length
    };

    // Store the formation
    await eventParties.updateOne(
      { eventId: new ObjectId(eventId) },
      {
        $set: {
          eventId: new ObjectId(eventId),
          guildId: interaction.guildId,
          processedParties,
          availableMembers,
          summary,
          status: 'pending',
          createdBy: interaction.user.id,
          createdAt: new Date(),
          approved: false
        }
      },
      { upsert: true }
    );

    console.log(`=== Formation Complete ===\n`);

    // NEW: Generate web token and URL
    const { webServer } = require('../../../web/server');
    const token = webServer.generateToken(eventId, interaction.user.id);

    // Use VM static IP or domain
    const baseUrl = process.env.WEB_BASE_URL || 'http://34.170.220.22:3001';
    const webUrl = `${baseUrl}/party-editor/${token}`;

    // Send ephemeral message with web link
    return interaction.editReply({
      content: `✅ **Event parties processed!**\n\n` +
               `📊 **Summary:**\n` +
               `• ${summary.partiesIntact} parties intact\n` +
               `• ${summary.partiesModified} parties modified\n` +
               `• ${summary.partiesDisbanded} parties disbanded\n` +
               `• ${summary.membersAvailable} members available for placement\n` +
               `• ${summary.totalAttending} total attending\n\n` +
               `🌐 **[Open Party Editor](${webUrl})**\n\n` +
               `⏰ Link expires in 1 hour\n` +
               `ℹ️ Use the web interface to review, edit, and send party assignments`
    });

  } catch (error) {
    console.error('Error forming event parties:', error);
    return interaction.editReply({
      content: `❌ Failed to form event parties: ${error.message}`
    });
  }
}

/**
 * Process a static party against attendance data
 */
async function processStaticParty(party, notAttendingSet, guild, partyPlayers) {
  const removedMembers = [];
  const remainingMembers = [];

  console.log(`\nProcessing Party ${party.partyNumber} (${party.members?.length || 0} members)...`);

  for (const member of party.members || []) {
    const enrichedMember = await enrichMemberData(member, guild, partyPlayers);

    if (notAttendingSet.has(member.userId)) {
      removedMembers.push(enrichedMember);
      console.log(`  ❌ Removed: ${enrichedMember.displayName} (not attending)`);
    } else {
      remainingMembers.push(enrichedMember);
      console.log(`  ✅ Kept: ${enrichedMember.displayName}`);
    }
  }

  // Decide if party should be disbanded (less than 3 members remaining)
  if (remainingMembers.length < 3) {
    console.log(`  🔴 DISBANDED - Only ${remainingMembers.length} member(s) remaining`);

    return {
      partyNumber: party.partyNumber,
      status: 'disbanded',
      removedMembers,
      remainingMembers,
      reason: `Only ${remainingMembers.length} of 6 members available`
    };
  }

  const status = removedMembers.length > 0 ? 'modified' : 'intact';
  console.log(`  ${status === 'intact' ? '✅ INTACT' : '⚠️ MODIFIED'} - ${remainingMembers.length}/6 members`);

  return {
    partyNumber: party.partyNumber,
    status,
    members: remainingMembers,
    removedMembers,
    composition: calculateComposition(remainingMembers)
  };
}

/**
 * Enrich member data with Discord info
 */
async function enrichMemberData(member, guild, partyPlayers) {
  try {
    const discordMember = await guild.members.fetch(member.userId).catch(() => null);
    const playerInfo = await partyPlayers.findOne({ 
      userId: member.userId, 
      guildId: guild.id 
    });

    return {
      userId: member.userId,
      displayName: discordMember?.displayName || 'Unknown',
      weapon1: member.weapon1 || playerInfo?.weapon1,
      weapon2: member.weapon2 || playerInfo?.weapon2,
      role: member.role || playerInfo?.role || 'dps',
      cp: member.cp || playerInfo?.cp || 0,
      isLeader: member.isLeader || false
    };
  } catch (error) {
    console.error(`Failed to enrich member ${member.userId}:`, error);
    return {
      userId: member.userId,
      displayName: 'Unknown',
      weapon1: member.weapon1,
      weapon2: member.weapon2,
      role: member.role || 'dps',
      cp: member.cp || 0,
      isLeader: false
    };
  }
}

/**
 * Fetch member data for unassigned attendees
 */
async function fetchMemberData(userId, guild, partyPlayers) {
  try {
    const discordMember = await guild.members.fetch(userId).catch(() => null);
    const playerInfo = await partyPlayers.findOne({ 
      userId, 
      guildId: guild.id 
    });

    if (!playerInfo || !playerInfo.weapon1 || !playerInfo.weapon2) {
      console.warn(`⚠️ User ${userId} has no party info, skipping`);
      return null;
    }

    const role = playerInfo.role || getRoleFromWeapons(playerInfo.weapon1, playerInfo.weapon2);

    return {
      userId,
      displayName: discordMember?.displayName || 'Unknown',
      weapon1: playerInfo.weapon1,
      weapon2: playerInfo.weapon2,
      role,
      cp: playerInfo.cp || 0,
      isLeader: false
    };
  } catch (error) {
    console.error(`Failed to fetch member ${userId}:`, error);
    return null;
  }
}

/**
 * Calculate role composition
 */
function calculateComposition(members) {
  const composition = { tank: 0, healer: 0, dps: 0 };

  for (const member of members) {
    composition[member.role]++;
  }

  return composition;
}


/**
 * Handle party formation cancellation
 */
async function handleCancelParties({ interaction, eventId, collections }) {
  const { eventParties } = collections;

  await interaction.deferUpdate();

  await eventParties.deleteOne({ eventId: new ObjectId(eventId) });

  return interaction.editReply({
    content: '❌ Party formation cancelled.',
    embeds: [],
    components: []
  });
}

module.exports = {
  handleFormEventParties,
  handleCancelParties
};