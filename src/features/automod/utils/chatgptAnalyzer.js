/**
 * ChatGPT API integration for message moderation
 */

const { translateMessage, detectLanguage } = require('./translator');

async function analyzeMessageForModeration(messageContent) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment variables');
    return {
      flagged: false,
      reason: 'API key missing',
      severity: 'none',
      sourceLanguage: 'unknown'
    };
  }

  const systemPrompt = `You are a Discord server moderator assistant.

Your job is to:
1. Detect problematic messages and categorize their severity
2. Detect the source language of the message

CRITICAL: Read the ENTIRE message carefully to understand CONTEXT before flagging.

**MODERATION RULES:**

If a message is ACCEPTABLE and does NOT violate any rules, you MUST respond with:
- flagged: false
- reason: "acceptable"
- severity: "none"

ONLY set flagged: true if the message ACTUALLY violates one of the rules below.

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

**DO NOT FLAG (these are ACCEPTABLE):**

**VENTING/REPORTING:**
- Users describing harassment they experienced
- Reporting toxic behavior from others
- Sharing past negative experiences
- Quoting what others said to them

**ABOUT ANONYMOUS/EXTERNAL GROUPS:**
- Complaints about game groups, randoms, PUGs, or anonymous players
- Frustration with unnamed strangers outside Discord
- Venting about bad game experiences with strangers

**GENERAL DISCOURSE:**
- Criticism of ideas, decisions, or actions
- Profanity used for emphasis or emotion, not directed at Discord members
- General venting or expressing frustration about situations
- Heated debates or arguments (unless crossing into personal attacks)
- Sarcasm, jokes, or friendly banter
- Self-deprecating comments
- Historical or academic discussion
- Song lyrics, quotes, or cultural references

**LANGUAGE DETECTION:**
Detect the primary language of the message. Common language codes:
- en: English
- de: German
- fr: French
- es: Spanish
- pt: Portuguese
- it: Italian
- nl: Dutch
- pl: Polish
- ru: Russian
- ar: Arabic
- ja: Japanese
- ko: Korean
- zh: Chinese

Respond ONLY with valid JSON in this exact format:
{
  "flagged": false,
  "reason": "acceptable",
  "severity": "none",
  "sourceLanguage": "en"
}`;

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
          { role: 'user', content: `Analyze this message: "${messageContent}"` }
        ],
        temperature: 0.5,
        max_tokens: 150,
        frequency_penalty: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', response.status, errorData);
      return {
        flagged: false,
        reason: 'API error',
        severity: 'none',
        sourceLanguage: 'unknown'
      };
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    try {
      let jsonContent = content;

      if (content.startsWith('```json')) {
        jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (content.startsWith('```')) {
        jsonContent = content.replace(/```\n?/g, '').trim();
      }

      const result = JSON.parse(jsonContent);

      if (typeof result.flagged !== 'boolean') {
        console.error('Invalid AI response format:', content);
        return {
          flagged: false,
          reason: 'Invalid response',
          severity: 'none',
          sourceLanguage: 'unknown'
        };
      }

      if (result.reason === 'acceptable' && result.flagged === true) {
        console.warn('AI returned contradictory response (flagged=true but reason=acceptable), correcting to flagged=false');
        result.flagged = false;
        result.severity = 'none';
      }

      return result;
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return {
        flagged: false,
        reason: 'Parse error',
        severity: 'none',
        sourceLanguage: 'unknown'
      };
    }

  } catch (error) {
    console.error('ChatGPT analysis error:', error);
    return {
      flagged: false,
      reason: 'Network error',
      severity: 'none',
      sourceLanguage: 'unknown'
    };
  }
}

// Export the DeepL translation functions
// This maintains backward compatibility with existing code
module.exports = {
  analyzeMessageForModeration,
  translateMessage,
  detectLanguage 
};