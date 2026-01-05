/**
 * ChatGPT API integration for message content analysis
 */

async function analyzeMessage(messageContent) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment variables');
    return { flagged: false, reason: 'API key missing', severity: 'none' };
  }

  const systemPrompt = `You are a Discord server moderator assistant. Your job is to detect problematic messages that could lead to fights or create a hostile environment.

Analyze messages for:
- Hate speech (racism, sexism, homophobia, transphobia, etc.)
- Personal attacks or harassment directed at others
- Aggressive or inflammatory language intended to provoke
- Threats or violent content
- Excessive profanity used to insult others
- Discrimination of any kind

IMPORTANT CONTEXT RULES:
- Academic or educational discussions about these topics are ACCEPTABLE
- Self-deprecating humor is ACCEPTABLE
- Talking about something that happened to you is ACCEPTABLE as long as its not directed at someone in the chat
- Song lyrics or quotes (when clearly identified) may be ACCEPTABLE
- Friendly banter between friends is usually ACCEPTABLE
- Direct insults, slurs, or attacks are NOT acceptable

Respond ONLY with valid JSON in this exact format:
{
  "flagged": true,
  "reason": "brief explanation of what was flagged",
  "severity": "high"
}

OR if acceptable:
{
  "flagged": false,
  "reason": "acceptable",
  "severity": "none"
}

Severity levels: "none", "low", "medium", "high"`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this message: "${messageContent}"` }
        ],
        temperature: 0.3, // Lower temperature for more consistent moderation
        max_tokens: 150
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', response.status, errorData);
      return { flagged: false, reason: 'API error', severity: 'none' };
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Parse JSON response
    try {
      const result = JSON.parse(content);

      // Validate response structure
      if (typeof result.flagged !== 'boolean') {
        console.error('Invalid AI response format:', content);
        return { flagged: false, reason: 'Invalid response', severity: 'none' };
      }

      return result;
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return { flagged: false, reason: 'Parse error', severity: 'none' };
    }

  } catch (error) {
    console.error('ChatGPT analysis error:', error);
    return { flagged: false, reason: 'Network error', severity: 'none' };
  }
}

/**
 * Quick regex-based pre-filter for obvious violations
 * Returns true if message should skip AI analysis (obviously fine)
 * Returns false if message needs AI analysis
 */
function needsAIAnalysis(messageContent) {
  // List of common slurs and extremely offensive terms (add more as needed)
  const obviousSlurs = [
    // Racial slurs (censored patterns)
    /n[i1!]gg[e3]r/i,
    /n[i1!]gg[a4]/i,
    // Homophobic slurs
    /f[a4]gg[o0]t/i,
    /f[a4]g/i,
    // Other common slurs
    /r[e3]t[a4]rd/i,
    /tr[a4]nny/i,
    // Add more patterns as needed
  ];

  // Check for obvious slurs
  for (const pattern of obviousSlurs) {
    if (pattern.test(messageContent)) {
      return true; // Definitely needs checking
    }
  }

  // Check for aggressive patterns
  const aggressivePatterns = [
    /k[yi]ll\s+(yourself|urself|you)/i,
    /you\s+should\s+die/i,
    /go\s+die/i,
    /neck\s+yourself/i
  ];

  for (const pattern of aggressivePatterns) {
    if (pattern.test(messageContent)) {
      return true; // Definitely needs checking
    }
  }

  // If message is very short and has no suspicious patterns, might skip AI
  // But for strictness, we'll analyze everything that's not obviously safe
  return true; // For now, analyze everything
}

module.exports = {
  analyzeMessage,
  needsAIAnalysis
};