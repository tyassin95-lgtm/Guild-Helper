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

**CRITICAL RULES - TIERED APPROACH:**

**TIER 1 - NEVER TOUCH (Highest Priority):**
- Parties with ALL 6 members attending/maybe = Keep 100% INTACT
- Do not reorganize, do not shuffle, do not change anything
- **CRITICAL**: Use the original static party number as tempPartyNumber
- Example: Static Party 3 with 6/6 members → tempPartyNumber: 3

**TIER 2 - SMART FILLING (4-5 Members Present):**
- Parties with 4-5 members attending = Keep existing members together, only ADD to fill
- **CRITICAL**: Use the original static party number as tempPartyNumber
- Example: Static Party 8 with 5/6 members + 1 added DPS → tempPartyNumber: 8
- Default strategy: Fill empty slots with DPS
- Exception: If party is missing a tank, prioritize adding a tank first
- Exception: If party is missing a healer, prioritize adding a healer first
- When filling with DPS, use weapon synergy (see below)

**TIER 3 - REORGANIZE (≤3 Members Present):**
- Parties with 3 or fewer members attending = Can be completely reorganized
- Combine with other small parties or unassigned members
- Aim for balanced 1-2 tanks, 1-3 healers per party
- **Party numbering for reorganized parties**:
  - If combining members from multiple static parties, use the LOWEST source party number
  - Example: Combining Static Party 2 (2 members) + Static Party 5 (1 member) → tempPartyNumber: 2
  - If forming entirely from unassigned members, use the next available number after all static parties
  - Reserve party members can be reorganized into new temp parties

**WEAPON SYNERGY FOR DPS FILLING:**
When adding DPS to fill parties, prefer grouping similar weapon combinations:
- **Melee DPS** (HIGHEST PRIORITY for grouping): GS/Dagger, GS/Spear, Spear/Dagger, Dagger/Sword
- **Magic DPS**: Wand/Staff, Dagger/Staff, Staff/Bow
- **Ranged Assassins (XBow)**: XBow/Dagger, Bow/XBow
- Other combinations: Group by primary weapon type
This improves coordination and strategy overlap.

**CRITICAL - PARTY ORDERING:**
- Your response MUST list parties in ascending numerical order by tempPartyNumber
- Example: Party 1, Party 2, Party 3, Party 8, Party 9 (NOT Party 8, Party 1, Party 3, etc.)
- Sort the temporaryParties array by tempPartyNumber before returning
- Users expect to see parties in numerical order, not by status or formation method

**CRITICAL - NO RESERVES/BENCH:**
- Every attending/maybe member MUST be placed in a party
- NEVER put anyone in unplacedMembers unless absolutely impossible
- If you can't make perfect 6-person parties, create smaller parties (3, 4, or 5 members)
- Warn about imbalanced parties, but don't exclude people
- Only use unplacedMembers if there's literally nowhere to put someone (this should be extremely rare)

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

**CRITICAL - PRESERVE STATIC PARTY NUMBERS:**
- When keeping a static party intact or filling it, use its ORIGINAL party number
- Example: If Static Party 1 has 6/6 members, create tempPartyNumber: 1
- Example: If Static Party 8 has 5/6 members and you add 1 DPS, create tempPartyNumber: 8
- Only use NEW party numbers for completely reorganized parties or parties formed from unassigned members
- Example: If you reorganize members from Static Party 2 (2 members) + Static Party 5 (1 member) + unassigned, this could be tempPartyNumber: 2 (use the lowest source party number)
- Reserve party members can be reorganized into new parties starting from the next available number after static parties

**Your response MUST be valid JSON in this exact format:**
{
  "temporaryParties": [
    {
      "tempPartyNumber": 1,  // MUST match original static party number when kept intact or filled
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
      "status": "full|needs_filling|reorganized",
      "fillingStrategy": "added_dps|added_tank|added_healer|kept_intact|reorganized",
      "sourceParties": [1],  // Original static party number(s) that formed this party
      "notes": "Brief explanation of why this party was formed this way"
    }
  ],
  "unplacedMembers": [
    {
      "userId": "123456789012345678",
      "displayName": "PlayerName",
      "role": "string",
      "reason": "Why they couldn't be placed (should be very rare)"
    }
  ],
  "summary": {
    "totalAttending": number,
    "partiesFormed": number,
    "fullParties": number,
    "partialParties": number,
    "membersPlaced": number,
    "membersUnplaced": number,
    "avgPartySize": number
  },
  "warnings": ["Any issues like imbalanced parties, missing roles, etc."]
}

**Important Notes:**
- **CRITICAL**: Preserve static party numbers! If Static Party 8 is kept intact or filled, tempPartyNumber MUST be 8
- **CRITICAL**: Sort your response by tempPartyNumber in ascending order (1, 2, 3... not 8, 1, 3...)
- When a static party is kept intact or filled (TIER 1 or TIER 2), use its original party number
- Only assign new party numbers to completely reorganized parties (TIER 3)
- "Maybe" attendees should be treated as attending for planning purposes
- Prioritize getting everyone into a party over perfect role balance
- Use warnings to flag composition issues, don't exclude people
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