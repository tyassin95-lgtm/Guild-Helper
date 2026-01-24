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
3. Each party MUST have 1-3 healers
4. Keep static parties with ≤2 members missing INTACT (don't shuffle them)
5. Only reorganize parties with 3+ members missing
6. Try to fill parties to 6 members when possible
7. Prioritize role balance over keeping partial parties together

**Role Types:**
- tank: Uses SnS (Sword & Shield)
- healer: Uses Orb/Wand or Wand/Bow
- dps: Everything else

**Your response MUST be valid JSON in this exact format:**
{
  "temporaryParties": [
    {
      "tempPartyNumber": 1,
      "members": [
        {
          "userId": "string",
          "displayName": "string",
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
      "userId": "string",
      "displayName": "string",
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
- Respond ONLY with valid JSON, no markdown formatting or code blocks`;

  const userPrompt = `Form temporary parties for this PvP event:

**Event:** ${eventInfo.eventType} ${eventInfo.location ? `at ${eventInfo.location}` : ''}
**Time:** ${eventInfo.eventTime}

${partyData}

Form the best possible balanced parties following all the rules.`;

  try {
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

    console.log(`AI formed ${result.temporaryParties.length} parties from ${result.summary?.totalAttending || 0} attendees`);
    return result;

  } catch (error) {
    console.error('AI party formation error:', error);
    throw error;
  }
}

/**
 * Build formatted data string for AI prompt
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
      data += `    - ${m.displayName}: ${m.role} (${m.weapon1}/${m.weapon2}) - ${m.cp} CP${m.isLeader ? ' [LEADER]' : ''}\n`;
    });

    if (maybe.length > 0) {
      data += `  ❓ Maybe (${maybe.length}):\n`;
      maybe.forEach(m => {
        data += `    - ${m.displayName}: ${m.role} (${m.weapon1}/${m.weapon2}) - ${m.cp} CP${m.isLeader ? ' [LEADER]' : ''}\n`;
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
        data += `  - ${m.displayName}: ${m.role} (${m.weapon1}/${m.weapon2}) - ${m.cp} CP\n`;
      });
    }

    if (unassignedMaybe.length > 0) {
      data += `❓ Maybe (${unassignedMaybe.length}):\n`;
      unassignedMaybe.forEach(m => {
        data += `  - ${m.displayName}: ${m.role} (${m.weapon1}/${m.weapon2}) - ${m.cp} CP\n`;
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