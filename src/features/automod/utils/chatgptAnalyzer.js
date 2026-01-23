/**
 * ChatGPT API integration for message content analysis and translation
 */

async function analyzeAndTranslateMessage(messageContent, enabledLanguages = ['de', 'fr', 'en']) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment variables');
    return {
      moderation: { flagged: false, reason: 'API key missing', severity: 'none' },
      translation: null
    };
  }

  const languagesList = enabledLanguages.join(', ');

  const systemPrompt = `You are a Discord server moderator assistant with translation capabilities.

Your job is to:
1. Detect problematic messages and categorize their severity
2. Provide fluent, natural translations of the message into other languages

CRITICAL: Read the ENTIRE message carefully to understand CONTEXT before flagging.

**MODERATION LEVELS:**

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

**DO NOT FLAG:**

**VENTING/REPORTING:**
- Users describing harassment they experienced
- Reporting toxic behavior from others
- Sharing past negative experiences
- Quoting what others said to them

**ABOUT ANONYMOUS/EXTERNAL GROUPS:**
- Complaints about game groups, randoms, PUGs, or anonymous players
- Frustration with unnamed strangers outside Discord
- Venting about bad game experiences with strangers
- Even if using offensive language, if it's about anonymous people NOT in the Discord, consider LOW severity at most

**GENERAL DISCOURSE:**
- Criticism of ideas, decisions, or actions
- Profanity used for emphasis or emotion, not directed at Discord members
- General venting or expressing frustration about situations
- Heated debates or arguments (unless crossing into personal attacks)
- Sarcasm, jokes, or friendly banter
- Self-deprecating comments
- Historical or academic discussion
- Song lyrics, quotes, or cultural references

**TRANSLATION GUIDELINES:**
- Translate naturally as if written by a native speaker
- Preserve tone, emotion, and intent
- Keep slang and informal language informal in translation
- Don't translate if message is too short (under 10 characters) or only emojis/symbols
- Detect the source language automatically
- Only translate to languages different from the source

Respond ONLY with valid JSON in this exact format:
{
  "moderation": {
    "flagged": false,
    "reason": "acceptable",
    "severity": "none"
  },
  "translation": {
    "sourceLanguage": "en",
    "shouldTranslate": true,
    "translations": {
      "de": "German translation here",
      "fr": "French translation here"
    }
  }
}

If the message is too short to translate or only contains emojis, set shouldTranslate to false and translations to {}.
Only include translations for languages DIFFERENT from the source language.

Available languages for translation: ${languagesList}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze and translate this message: "${messageContent}"` }
        ],
        temperature: 0.5,
        max_tokens: 500,
        frequency_penalty: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', response.status, errorData);
      return {
        moderation: { flagged: false, reason: 'API error', severity: 'none' },
        translation: null
      };
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    try {
      const result = JSON.parse(content);

      if (typeof result.moderation?.flagged !== 'boolean') {
        console.error('Invalid AI response format:', content);
        return {
          moderation: { flagged: false, reason: 'Invalid response', severity: 'none' },
          translation: null
        };
      }

      return result;
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return {
        moderation: { flagged: false, reason: 'Parse error', severity: 'none' },
        translation: null
      };
    }

  } catch (error) {
    console.error('ChatGPT analysis error:', error);
    return {
      moderation: { flagged: false, reason: 'Network error', severity: 'none' },
      translation: null
    };
  }
}

module.exports = {
  analyzeAndTranslateMessage
};