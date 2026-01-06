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
  // Very short messages (< 5 chars) are usually safe
  if (messageContent.length < 5) return true;

  // Convert to lowercase for easier pattern matching
  const lower = messageContent.toLowerCase();

  // List of patterns that need checking
  const suspiciousPatterns = [
    // Direct "you" statements with negative words - ALWAYS check these
    /\byou\s+(are|re|r)\s+/i,
    /\byou\s+will\s+/i,
    /\byou\s+should\s+/i,
    /\byou\s+can[\'\']?t\s+/i,
    /\byou[\'\']?re\s+/i,
    /\byour\s+/i,

    // Profanity patterns
    /\bfuck/i,
    /\bshit/i,
    /\bbitch/i,
    /\bass\s*hole/i,
    /\bdamn\s+you/i,
    /\bcunt/i,
    /\bdick\s*(head)?/i,
    /\bprick/i,

    // Slurs (racial, homophobic, etc.) - spell out common variants
    /n[-_]?word/i,
    /\bn+[i1!]+g+[e3a4]+r*s*/i,
    /\bf+[a4@]+g+[o0s]*t*s*/i,
    /\br+[e3]+t+[a4@]+r+d+s*/i,
    /\bt+r+[a4@]+n+[yn]+/i,

    // Aggressive/harmful phrases
    /\bk[i1!]+ll\s*(yourself|urself|you|ur\s*self)/i,
    /\bdie/i,
    /\bdeath/i,
    /\bhope\s+you/i,
    /\bgo\s+(die|to\s+hell|fuck|kys)/i,
    /\bneck\s+yourself/i,
    /\bkys/i,
    /\buninstall/i,

    // Common insults
    /\b(stupid|dumb|idiot|moron|retard)s?\b/i,
    /\bloser/i,
    /\btrash/i,
    /\bgarbage/i,
    /\bshut\s+up/i,
    /\bhate\s+you/i,
    /\bslacker/i,
  ];

  // If any suspicious pattern matches, needs AI analysis
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