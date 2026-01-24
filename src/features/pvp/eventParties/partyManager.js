const { ObjectId } = require('mongodb');
const { PermissionFlagsBits } = require('discord.js');
const { formPartiesWithAI } = require('./aiPartyFormer');
const { 
  createPartyFormationEmbed, 
  createPartyFormationButtons,
  createPartyAssignmentDM 
} = require('./partyFormationEmbed');
const { getRoleFromWeapons } = require('../../parties/roleDetection');

/**
 * Handle "Form Event Parties" button click
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

    // Get all attending and maybe members
    const attendingUserIds = event.rsvpAttending || [];
    const maybeUserIds = event.rsvpMaybe || [];

    if (attendingUserIds.length === 0 && maybeUserIds.length === 0) {
      return interaction.editReply({
        content: '❌ No members have RSVP\'d as attending or maybe for this event.\n\n' +
                 'Event parties can only be formed when people have signed up.'
      });
    }

    // Fetch all static parties
    const staticParties = await parties.find({ guildId: interaction.guildId }).toArray();

    // Fetch player info for attending members
    const attendingMembers = await fetchMembersWithRoles(
      attendingUserIds,
      interaction.guildId,
      interaction.guild,
      partyPlayers
    );

    const maybeMembers = await fetchMembersWithRoles(
      maybeUserIds,
      interaction.guildId,
      interaction.guild,
      partyPlayers
    );

    // Enrich static parties with attendance data
    const enrichedStaticParties = await enrichStaticPartiesWithAttendance(
      staticParties,
      attendingMembers,
      maybeMembers,
      interaction.guild
    );

    // Prepare event info
    const eventInfo = {
      eventType: event.eventType,
      location: event.location,
      eventTime: event.eventTime
    };

    console.log(`Forming parties for ${attendingMembers.length} attending + ${maybeMembers.length} maybe members...`);

    // Call AI to form parties
    const aiResponse = await formPartiesWithAI({
      staticParties: enrichedStaticParties,
      attendingMembers,
      maybeMembers,
      eventInfo
    });

    // Store the formation temporarily (will be finalized on approval)
    await eventParties.updateOne(
      { eventId: new ObjectId(eventId) },
      {
        $set: {
          eventId: new ObjectId(eventId),
          guildId: interaction.guildId,
          temporaryParties: aiResponse.temporaryParties,
          unplacedMembers: aiResponse.unplacedMembers || [],
          summary: aiResponse.summary,
          warnings: aiResponse.warnings || [],
          status: 'pending', // pending, approved, cancelled
          createdBy: interaction.user.id,
          createdAt: new Date(),
          approved: false
        }
      },
      { upsert: true }
    );

    // Create and send the review embed
    const embed = createPartyFormationEmbed(aiResponse, eventInfo);
    const buttons = createPartyFormationButtons(eventId);

    return interaction.editReply({
      embeds: [embed],
      components: [buttons]
    });

  } catch (error) {
    console.error('Error forming event parties:', error);
    return interaction.editReply({
      content: `❌ Failed to form event parties: ${error.message}`
    });
  }
}

/**
 * Fetch member data with roles
 */
async function fetchMembersWithRoles(userIds, guildId, guild, partyPlayers) {
  const members = [];

  for (const userId of userIds) {
    try {
      // Fetch player info from database
      const playerInfo = await partyPlayers.findOne({ userId, guildId });

      // Fetch Discord member
      const discordMember = await guild.members.fetch(userId).catch(() => null);

      if (!playerInfo || !playerInfo.weapon1 || !playerInfo.weapon2) {
        // Member hasn't set up party info, skip them
        console.warn(`User ${userId} has no party info, skipping`);
        continue;
      }

      // Determine role
      const role = playerInfo.role || getRoleFromWeapons(playerInfo.weapon1, playerInfo.weapon2);

      members.push({
        userId,
        displayName: discordMember?.displayName || playerInfo.displayName || 'Unknown',
        weapon1: playerInfo.weapon1,
        weapon2: playerInfo.weapon2,
        role,
        cp: playerInfo.cp || 0,
        isLeader: playerInfo.isPartyLeader || false
      });
    } catch (error) {
      console.error(`Failed to fetch member ${userId}:`, error);
    }
  }

  return members;
}

/**
 * Enrich static parties with attendance information
 */
async function enrichStaticPartiesWithAttendance(staticParties, attendingMembers, maybeMembers, guild) {
  const enriched = [];

  for (const party of staticParties) {
    const enrichedMembers = [];

    for (const member of party.members || []) {
      try {
        const discordMember = await guild.members.fetch(member.userId).catch(() => null);

        enrichedMembers.push({
          userId: member.userId,
          displayName: discordMember?.displayName || 'Unknown',
          weapon1: member.weapon1,
          weapon2: member.weapon2,
          role: member.role,
          cp: member.cp || 0,
          isLeader: member.isLeader || false
        });
      } catch (error) {
        console.error(`Failed to fetch member ${member.userId}:`, error);
      }
    }

    enriched.push({
      partyNumber: party.partyNumber,
      isReserve: party.isReserve || false,
      members: enrichedMembers
    });
  }

  return enriched;
}

/**
 * Handle party formation approval
 */
async function handleApproveParties({ interaction, eventId, collections, client }) {
  const { eventParties, pvpEvents } = collections;

  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.update({
      content: '❌ You need administrator permissions.',
      embeds: [],
      components: []
    });
  }

  await interaction.deferUpdate();

  try {
    // Fetch the formation
    const formation = await eventParties.findOne({ eventId: new ObjectId(eventId) });

    if (!formation) {
      return interaction.editReply({
        content: '❌ Party formation not found.',
        embeds: [],
        components: []
      });
    }

    if (formation.approved) {
      return interaction.editReply({
        content: '❌ This party formation has already been approved and sent.',
        embeds: [],
        components: []
      });
    }

    // Fetch event info
    const event = await pvpEvents.findOne({ _id: new ObjectId(eventId) });

    if (!event) {
      return interaction.editReply({
        content: '❌ Event not found.',
        embeds: [],
        components: []
      });
    }

    const eventInfo = {
      eventType: event.eventType,
      location: event.location,
      eventTime: event.eventTime
    };

    // Send DMs to all party members
    const dmResults = await sendPartyAssignmentDMs(
      formation.temporaryParties,
      eventInfo,
      client
    );

    // Mark as approved
    await eventParties.updateOne(
      { eventId: new ObjectId(eventId) },
      {
        $set: {
          approved: true,
          approvedBy: interaction.user.id,
          approvedAt: new Date(),
          dmResults,
          status: 'approved'
        }
      }
    );

    // Update event to show parties are formed
    await pvpEvents.updateOne(
      { _id: new ObjectId(eventId) },
      {
        $set: {
          partiesFormed: true,
          partiesFormedAt: new Date()
        }
      }
    );

    // Send confirmation to admin
    const successCount = dmResults.successful.length;
    const failCount = dmResults.failed.length;

    let confirmMessage = `✅ **Event parties approved and sent!**\n\n`;
    confirmMessage += `📨 **DM Results:**\n`;
    confirmMessage += `• Successfully sent: ${successCount} member${successCount !== 1 ? 's' : ''}\n`;

    if (failCount > 0) {
      confirmMessage += `• Failed to send: ${failCount} member${failCount !== 1 ? 's' : ''} (DMs disabled)\n\n`;
      confirmMessage += `**Failed DMs:**\n`;
      dmResults.failed.forEach(f => {
        confirmMessage += `• ${f.displayName}\n`;
      });
    }

    return interaction.editReply({
      content: confirmMessage,
      embeds: [],
      components: []
    });

  } catch (error) {
    console.error('Error approving parties:', error);
    return interaction.editReply({
      content: `❌ Failed to approve parties: ${error.message}`,
      embeds: [],
      components: []
    });
  }
}

/**
 * Send party assignment DMs to all members
 */
async function sendPartyAssignmentDMs(temporaryParties, eventInfo, client) {
  const results = {
    successful: [],
    failed: []
  };

  for (const party of temporaryParties) {
    for (const member of party.members) {
      try {
        const user = await client.users.fetch(member.userId);
        const dmMessage = createPartyAssignmentDM(member, party, eventInfo);

        await user.send(dmMessage);

        results.successful.push({
          userId: member.userId,
          displayName: member.displayName
        });

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to send DM to ${member.displayName}:`, error.message);
        results.failed.push({
          userId: member.userId,
          displayName: member.displayName,
          error: error.message
        });
      }
    }
  }

  return results;
}

/**
 * Handle party formation cancellation
 */
async function handleCancelParties({ interaction, eventId, collections }) {
  const { eventParties } = collections;

  await interaction.deferUpdate();

  // Delete the pending formation
  await eventParties.deleteOne({ eventId: new ObjectId(eventId) });

  return interaction.editReply({
    content: '❌ Party formation cancelled.',
    embeds: [],
    components: []
  });
}

module.exports = {
  handleFormEventParties,
  handleApproveParties,
  handleCancelParties
};