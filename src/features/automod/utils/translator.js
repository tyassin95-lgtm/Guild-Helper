/**
 * DeepL Translation API integration
 * Replaces ChatGPT for translation to save costs and improve quality
 */

const deepl = require('deepl-node');

let translator = null;

/**
 * Initialize the DeepL translator
 * @returns {deepl.Translator|null}
 */
function initTranslator() {
  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  DEEPL_API_KEY not found in environment variables - translation feature disabled');
    console.warn('   To enable translations, get a free API key from: https://www.deepl.com/pro-api');
    return null;
  }

  try {
    translator = new deepl.Translator(apiKey);
    console.log('✅ DeepL translator initialized successfully');
    return translator;
  } catch (error) {
    console.error('Failed to initialize DeepL translator:', error);
    return null;
  }
}

/**
 * Translate a message to the target language
 * @param {string} messageContent - Text to translate
 * @param {string} targetLanguage - Target language code (en, de, fr, es)
 * @returns {Promise<string>} - Translated text
 */
async function translateMessage(messageContent, targetLanguage) {
  // Lazy initialization
  if (!translator) {
    translator = initTranslator();
  }

  if (!translator) {
    throw new Error('Translation service not configured. Please set DEEPL_API_KEY environment variable.');
  }

  // Validate input
  if (!messageContent || messageContent.trim().length === 0) {
    throw new Error('Cannot translate empty message');
  }

  // Map Discord/common language codes to DeepL language codes
  const langMap = {
    'en': 'EN-US',  // English (American)
    'de': 'DE',      // German
    'fr': 'FR',      // French
    'es': 'ES',      // Spanish
    'pt': 'PT-PT',   // Portuguese
    'it': 'IT',      // Italian
    'nl': 'NL',      // Dutch
    'pl': 'PL',      // Polish
    'ru': 'RU',      // Russian
    'ja': 'JA',      // Japanese
    'zh': 'ZH',      // Chinese
    'ko': 'KO',      // Korean
    'ar': 'AR'       // Arabic (if supported)
  };

  const deeplLang = langMap[targetLanguage.toLowerCase()] || targetLanguage.toUpperCase();

  try {
    // Translate with auto-detect source language
    const result = await translator.translateText(
      messageContent,
      null, // null = auto-detect source language
      deeplLang,
      {
        preserveFormatting: true, // Keep line breaks and formatting
        formality: 'default'      // Don't force formal/informal
      }
    );

    return result.text;
  } catch (error) {
    console.error('DeepL translation error:', error);

    // Provide helpful error messages
    if (error.message?.includes('quota')) {
      throw new Error('Translation quota exceeded. Please try again later or upgrade your DeepL plan.');
    } else if (error.message?.includes('403')) {
      throw new Error('Invalid DeepL API key. Please check your DEEPL_API_KEY environment variable.');
    } else if (error.message?.includes('target_lang')) {
      throw new Error(`Unsupported target language: ${targetLanguage}`);
    }

    throw new Error(`Translation failed: ${error.message}`);
  }
}

/**
 * Detect the source language of a message
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} - Detected language code (lowercase)
 */
async function detectLanguage(text) {
  if (!translator) {
    translator = initTranslator();
  }

  if (!translator) {
    return 'unknown';
  }

  if (!text || text.trim().length === 0) {
    return 'unknown';
  }

  try {
    // Translate to English to detect source language
    const result = await translator.translateText(text, null, 'EN-US');

    // DeepL returns language codes like "EN", "DE", "FR"
    // Convert to lowercase for consistency
    return result.detectedSourceLang.toLowerCase();
  } catch (error) {
    console.error('Language detection error:', error);
    return 'unknown';
  }
}

/**
 * Check if translation service is available
 * @returns {boolean}
 */
function isTranslationAvailable() {
  if (!translator) {
    translator = initTranslator();
  }
  return translator !== null;
}

/**
 * Get usage statistics from DeepL (if available)
 * @returns {Promise<Object|null>}
 */
async function getUsageStats() {
  if (!translator) {
    translator = initTranslator();
  }

  if (!translator) {
    return null;
  }

  try {
    const usage = await translator.getUsage();

    return {
      characterCount: usage.character?.count || 0,
      characterLimit: usage.character?.limit || 0,
      characterPercentage: usage.character?.limit 
        ? ((usage.character.count / usage.character.limit) * 100).toFixed(2)
        : 0
    };
  } catch (error) {
    console.error('Failed to get DeepL usage stats:', error);
    return null;
  }
}

/**
 * Get list of supported target languages
 * @returns {Promise<Array<Object>>}
 */
async function getSupportedLanguages() {
  if (!translator) {
    translator = initTranslator();
  }

  if (!translator) {
    return [];
  }

  try {
    const languages = await translator.getTargetLanguages();

    return languages.map(lang => ({
      code: lang.code.toLowerCase(),
      name: lang.name
    }));
  } catch (error) {
    console.error('Failed to get supported languages:', error);

    // Return default set if API call fails
    return [
      { code: 'en', name: 'English' },
      { code: 'de', name: 'German' },
      { code: 'fr', name: 'French' },
      { code: 'es', name: 'Spanish' }
    ];
  }
}

module.exports = {
  translateMessage,
  detectLanguage,
  isTranslationAvailable,
  getUsageStats,
  getSupportedLanguages
};