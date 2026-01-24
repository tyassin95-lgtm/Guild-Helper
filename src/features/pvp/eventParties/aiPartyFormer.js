/**
 * AI-powered party formation using OpenAI GPT-4o API
 */

/**
 * Form temporary parties using AI analysis
 * @param {Object} params - Formation parameters
 * @returns {Promise<Object>} - AI response with party formations
 */
async function formPartiesWithAI({ staticParties, attendingMembers, maybeMembers, eventInfo }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment variables');
    throw new Error('AI party formation is not configured. Please contact an administrator.');
  }

  // Build comprehensive data for AI
  const partyData = buildPartyFormationData(staticParties, attendingMembers, maybeMembers);

  const systemPrompt = `You are a guild party formation assistant for MMO PvP events.

Your job is to form temporary 6-person parties for a specific event based on who is attending.

**CRITICAL RULES:**
1. Maximum 6 members per party
2. Each party MUST have 1-2 tanks (no more, no less)
3. Each party MUST have 1-2 healers (no more, no less)
4. Keep static parties with ≤2 members missing INTACT (but fill them to 6 if possible)
5. Only reorganize parties with 3+ members missing
6. Prioritize role balance over keeping partial parties together
7. Put any unplaced members in new parties, even if you cant give them at least one healer and tank

**Role Types:**
- tank: Uses SnS (Sword & Shield)
- healer: Uses Orb/Wand or Wand/Bow
- dps: Everything else

**CRITICAL - USER ID FORMAT:**
- The userId field MUST contain the Discord user ID (a long numeric string like "151758929557323777")
- NEVER put displayName values in the userId field
- userId and displayName are DIFFERENT fields with DIFFERENT values
- Example CORRECT: "userId": "151758929557323777", "displayName": "JohnDoe"
- Example WRONG: "userId": "JohnDoe", "displayName": "JohnDoe"

**Your response MUST be valid JSON in this exact format:**
{
  "temporaryParties": [
    {
      "tempPartyNumber": 1,
      "members": [
        {
          "userId": "123456789012345678",
          "displayName": "PlayerName",
          "role": "tank|healer|dps",
          "weapon1": "string",
          "weapon2": "string",
          "cp": number,
          "isLeader": boolean
        }
      ],
      "composition": {
        "tank": number,
        "healer": number,
        "dps": number
      },
      "sourceParties": [1, 2],
      "notes": "Brief explanation of why this party was formed this way"
    }
  ],
  "unplacedMembers": [
    {
      "userId": "123456789012345678",
      "displayName": "PlayerName",
      "role": "string",
      "reason": "Why they couldn't be placed"
    }
  ],
  "summary": {
    "totalAttending": number,
    "partiesFormed": number,
    "membersPlaced": number,
    "membersUnplaced": number
  },
  "warnings": ["Any issues or constraints that affected formation"]
}

**Important Notes:**
- If a static party has 4+ members attending, try to keep them together
- If a static party has ≤3 members attending, they can be shuffled
- "Maybe" attendees should be treated as attending for planning purposes
- Ensure every party has proper tank/healer balance
- If there aren't enough tanks/healers, mention this in warnings
- Respond ONLY with valid JSON, no markdown formatting or code blocks
- **CRITICAL**: Always use the actual userId value provided in the member data, NEVER use displayName in the userId field`;

  const userPrompt = `Form temporary parties for this PvP event:

**Event:** ${eventInfo.eventType} ${eventInfo.location ? `at ${eventInfo.location}` : ''}
**Time:** ${eventInfo.eventTime}

${partyData}

Form the best possible balanced parties following all the rules.

REMINDER: Use the actual userId values from the data above - these are the long numeric Discord IDs, NOT the display names!`;

  try {
    console.log('\n=== Calling OpenAI API for party formation ===');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 4000,
        response_format: { type: 'json_object' } // Force JSON output
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error('AI party formation service is currently unavailable.');
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Parse JSON response
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('AI returned invalid party formation data. Please try again.');
    }

    // Validate response structure
    if (!result.temporaryParties || !Array.isArray(result.temporaryParties)) {
      throw new Error('AI returned invalid party formation structure.');
    }

    // CRITICAL: Validate that all userIds are valid Discord snowflakes
    console.log('\n=== Validating AI response ===');
    let invalidUserIds = 0;

    for (const party of result.temporaryParties) {
      for (const member of party.members) {
        if (!member.userId || !/^\d+$/.test(member.userId)) {
          console.error(`❌ AI returned invalid userId: "${member.userId}" for ${member.displayName}`);
          invalidUserIds++;
        }
      }
    }

    if (result.unplacedMembers) {
      for (const member of result.unplacedMembers) {
        if (!member.userId || !/^\d+$/.test(member.userId)) {
          console.error(`❌ AI returned invalid userId in unplaced: "${member.userId}" for ${member.displayName}`);
          invalidUserIds++;
        }
      }
    }

    if (invalidUserIds > 0) {
      throw new Error(`AI returned ${invalidUserIds} invalid user IDs. The AI used display names instead of Discord user IDs. Please try again.`);
    }

    console.log(`✅ AI formed ${result.temporaryParties.length} parties from ${result.summary?.totalAttending || 0} attendees`);
    console.log('=== AI response validated successfully ===\n');

    return result;

  } catch (error) {
    console.error('AI party formation error:', error);
    throw error;
  }
}

/**
 * Build formatted data string for AI prompt
 * CRITICAL: Include both userId AND displayName for each member
 */
function buildPartyFormationData(staticParties, attendingMembers, maybeMembers) {
  let data = `**STATIC PARTIES & ATTENDANCE:**\n\n`;

  // Show each static party's status
  for (const party of staticParties) {
    const partyLabel = party.isReserve ? 'Reserve Party' : `Party ${party.partyNumber}`;
    const attending = party.members.filter(m => attendingMembers.some(a => a.userId === m.userId));
    const maybe = party.members.filter(m => maybeMembers.some(a => a.userId === m.userId));
    const notAttending = party.members.filter(m => 
      !attendingMembers.some(a => a.userId === m.userId) && 
      !maybeMembers.some(a => a.userId === m.userId)
    );

    data += `${partyLabel} (${party.members.length} total members):\n`;
    data += `  ✅ Attending (${attending.length}):\n`;
    attending.forEach(m => {
      // CRITICAL: Include userId in the data
      data += `    - userId: ${m.userId}, displayName: ${m.displayName}, role: ${m.role} (${m.weapon1}/${m.weapon2}), CP: ${m.cp}${m.isLeader ? ' [LEADER]' : ''}\n`;
    });

    if (maybe.length > 0) {
      data += `  ❓ Maybe (${maybe.length}):\n`;
      maybe.forEach(m => {
        // CRITICAL: Include userId in the data
        data += `    - userId: ${m.userId}, displayName: ${m.displayName}, role: ${m.role} (${m.weapon1}/${m.weapon2}), CP: ${m.cp}${m.isLeader ? ' [LEADER]' : ''}\n`;
      });
    }

    data += `  ❌ Not Attending: ${notAttending.length}\n`;
    data += `  📊 Composition: ${attending.length + maybe.length}/${party.members.length} available\n\n`;
  }

  // Show unassigned attending members
  const assignedUserIds = new Set(staticParties.flatMap(p => p.members.map(m => m.userId)));
  const unassignedAttending = attendingMembers.filter(m => !assignedUserIds.has(m.userId));
  const unassignedMaybe = maybeMembers.filter(m => !assignedUserIds.has(m.userId));

  if (unassignedAttending.length > 0 || unassignedMaybe.length > 0) {
    data += `**UNASSIGNED MEMBERS (not in static parties):**\n\n`;

    if (unassignedAttending.length > 0) {
      data += `✅ Attending (${unassignedAttending.length}):\n`;
      unassignedAttending.forEach(m => {
        // CRITICAL: Include userId in the data
        data += `  - userId: ${m.userId}, displayName: ${m.displayName}, role: ${m.role} (${m.weapon1}/${m.weapon2}), CP: ${m.cp}\n`;
      });
    }

    if (unassignedMaybe.length > 0) {
      data += `❓ Maybe (${unassignedMaybe.length}):\n`;
      unassignedMaybe.forEach(m => {
        // CRITICAL: Include userId in the data
        data += `  - userId: ${m.userId}, displayName: ${m.displayName}, role: ${m.role} (${m.weapon1}/${m.weapon2}), CP: ${m.cp}\n`;
      });
    }
    data += '\n';
  }

  // Summary stats
  const totalAttending = attendingMembers.length + maybeMembers.length;
  const roleCount = {
    tank: [...attendingMembers, ...maybeMembers].filter(m => m.role === 'tank').length,
    healer: [...attendingMembers, ...maybeMembers].filter(m => m.role === 'healer').length,
    dps: [...attendingMembers, ...maybeMembers].filter(m => m.role === 'dps').length
  };

  data += `**OVERALL STATISTICS:**\n`;
  data += `Total Attending: ${totalAttending}\n`;
  data += `Role Distribution:\n`;
  data += `  🛡️ Tanks: ${roleCount.tank}\n`;
  data += `  💚 Healers: ${roleCount.healer}\n`;
  data += `  ⚔️ DPS: ${roleCount.dps}\n`;

  return data;
}

module.exports = { formPartiesWithAI };