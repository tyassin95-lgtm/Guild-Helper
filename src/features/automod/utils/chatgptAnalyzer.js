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

CRITICAL: Read the ENTIRE message carefully to understand CONTEXT before flagging.

You should flag messages at THREE severity levels:

**LOW (Warning-worthy):**
- Mild personal insults directed AT someone in the Discord ("you're an idiot", "@user you're stupid")
- Casual rudeness or disrespect directed at specific individuals
- Minor inflammatory language toward Discord members
- Aggressive tone directed at individuals without serious threats
- Minor name-calling or put-downs aimed at someone

**MEDIUM (Immediate timeout):**
- Moderate personal attacks with hostile intent toward Discord members
- Repeated harassment or bullying of individuals
- Discriminatory language used to attack specific people
- Telling someone to harm themselves (any phrasing)

**HIGH (Immediate timeout):**
- Explicit hate speech with slurs used as direct attacks on individuals
- Direct threats of violence against individuals ("I will kill you", "I hope you die")
- Severe harassment, doxxing attempts, or stalking behavior
- Explicit and direct calls for harm or violence

You should ALLOW and NOT flag:

**VENTING/REPORTING:**
- Users describing harassment they experienced ("someone called me stupid yesterday")
- Reporting toxic behavior from others ("this person was so rude to me")
- Sharing past negative experiences
- Quoting what others said to them

**ABOUT ANONYMOUS/EXTERNAL GROUPS:**
- Complaints about game groups, randoms, PUGs, or anonymous players
- Frustration with unnamed strangers outside Discord ("these randoms were terrible")
- Venting about bad game experiences with strangers
- Even if using offensive language, if it's about anonymous people NOT in the Discord, consider LOW severity at most

**GENERAL DISCOURSE:**
- Criticism of ideas, decisions, or actions (even harsh criticism)
- Profanity used for emphasis or emotion, not directed at Discord members
- General venting or expressing frustration about situations
- Heated debates or arguments (unless crossing into personal attacks)
- Sarcasm, jokes, or friendly banter
- Self-deprecating comments
- Historical or academic discussion
- Song lyrics, quotes, or cultural references

**KEY PRINCIPLES:**
1. **Context is everything**: "you're stupid" in a report about harassment = OK. "you're stupid" said TO someone = flag.
2. **Anonymous vs. Known**: Complaining about "randoms in my game group" = much less severe than attacking a Discord member.
3. **Reporting vs. Attacking**: If someone is DESCRIBING harassment they received, do NOT flag them for the words they're quoting.
4. **When in doubt**: If you're not sure if it targets a Discord member specifically, DO NOT flag or use LOW severity.

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
}`;

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
 * DEPRECATED: Pre-filtering has been removed - all messages are now analyzed by AI
 * This function is kept for backwards compatibility but always returns false
 */
function isObviouslySafe(messageContent) {
  return false; // Always return false to ensure AI analysis
}

/**
 * DEPRECATED: Pre-filtering has been removed - all messages are now analyzed by AI
 * This function is kept for backwards compatibility but always returns true
 */
function needsAIAnalysis(messageContent) {
  return true; // Always return true to ensure AI analysis
}

module.exports = {
  analyzeMessage,
  needsAIAnalysis,
  isObviouslySafe
};