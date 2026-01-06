/**
 * ChatGPT API integration for message content analysis
 */

async function analyzeMessage(messageContent) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment variables');
    return { flagged: false, reason: 'API key missing', severity: 'none' };
  }

  const systemPrompt = `You are a Discord server moderator assistant. Your job is to detect problematic messages and categorize their severity.

You should flag messages at THREE severity levels:

**LOW (Warning-worthy):**
- Mild personal insults ("you're an idiot", "you're stupid", "dumbass")
- Casual rudeness or disrespect directed at individuals
- Minor inflammatory language toward others
- Aggressive tone without serious threats
- Minor name-calling or put-downs

**MEDIUM (Timeout-worthy for repeated offenses):**
- Repeated harassment or bullying of the same person
- Moderate personal attacks with hostile intent
- Discriminatory language (without explicit slurs)
- Persistent inflammatory behavior across messages
- Telling someone to harm themselves (indirect phrasing)

**HIGH (Immediate timeout):**
- Explicit hate speech with slurs (racial slurs, homophobic slurs, transphobic slurs used as attacks)
- Direct threats of violence against individuals ("I will kill you", "I hope you die")
- Severe harassment, doxxing attempts, or stalking behavior
- Explicit and direct calls for harm or violence

You should ALLOW and NOT flag:
- Criticism of ideas, decisions, or actions (even harsh criticism like "this idea is stupid" or "that's a dumb policy")
- Profanity used for emphasis or emotion, not directed at people ("this is fucking awesome", "I'm so damn tired", "what the hell")
- General venting or expressing frustration about situations (not people)
- Heated debates or arguments between users (unless crossing into personal attacks)
- Sarcasm, jokes, or friendly banter (even edgy humor between friends)
- Self-deprecating comments or jokes about oneself
- Historical or academic discussion of sensitive topics
- Song lyrics, quotes, or cultural references
- Expressing negative emotions about events or situations

**Key principle:** Only flag messages that target INDIVIDUALS with negativity. General complaints, frustration with situations, or criticism of ideas are acceptable.

When in doubt about whether something targets an individual or is just general frustration, DO NOT flag.

Respond ONLY with valid JSON in this exact format:
{
  "flagged": true,
  "reason": "brief explanation",
  "severity": "low"
}

OR:
{
  "flagged": false,
  "reason": "acceptable",
  "severity": "none"
}

Severity levels: "none", "low", "medium", "high"

When in doubt about severity, err on the side of "low" rather than "medium" or "high".`;

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
        temperature: 0.5, // Increased from 0.3 for more lenient interpretation
        max_tokens: 150,
        frequency_penalty: 0.3 // Discourage repetitive flagging patterns
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
 * Quick check if message is obviously safe (no AI needed)
 * Returns true if message should skip AI analysis (obviously fine)
 * Returns false if message needs AI analysis
 */
function isObviouslySafe(messageContent) {
  // Very short messages are usually safe
  if (messageContent.length < 10) return true;

  // List of patterns that need checking
  const suspiciousPatterns = [
    // Profanity (only when potentially directed at people)
    /\bf+[u\*]+c+k\s+(you|off)/i,
    /\bs+h+[i\*]+t+h+e+a+d/i,
    /\bb+[i\*]+t+c+h/i,
    /\ba+s+s+h+o+l+e/i,

    // Slurs (racial, homophobic, etc.)
    /n[i1!]gg[e3]r/i,
    /n[i1!]gg[a4]/i,
    /f[a4]gg[o0]t/i,
    /f[a4]g/i,
    /r[e3]t[a4]rd/i,
    /tr[a4]nny/i,

    // Aggressive phrases
    /k[yi]ll\s+(yourself|urself|you)/i,
    /you\s+should\s+die/i,
    /go\s+die/i,
    /neck\s+yourself/i,
    /die|death/i,

    // Insults directed at people
    /you\s+(are|re)\s+(stupid|dumb|idiot)/i,
    /shut\s+up/i,
    /hate\s+you/i,
  ];

  // If no suspicious patterns, likely safe
  return !suspiciousPatterns.some(pattern => pattern.test(messageContent));
}

/**
 * Quick regex-based pre-filter for obvious violations
 * Returns true if message should be immediately flagged (obviously bad)
 */
function needsAIAnalysis(messageContent) {
  // For backwards compatibility, always analyze if not obviously safe
  return !isObviouslySafe(messageContent);
}

module.exports = {
  analyzeMessage,
  needsAIAnalysis,
  isObviouslySafe
};