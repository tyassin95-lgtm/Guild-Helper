/**
 * Reaction handler for translation requests
 */

const { translateMessage } = require('../utils/chatgptAnalyzer');

const LANGUAGE_FLAGS = {
  '🇬🇧': 'en',
  '🇩🇪': 'de',
  '🇫🇷': 'fr',
  '🇪🇸': 'es'
};

const LANGUAGE_NAMES = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish'
};

async function handleTranslationReaction({ reaction, user, collections, client }) {
  if (user.bot) return;

  const emoji = reaction.emoji.name;
  const targetLanguage = LANGUAGE_FLAGS[emoji];

  if (!targetLanguage) {
    return;
  }

  try {
    const message = reaction.message;
    const { messageTranslations, automodSettings } = collections;

    const settings = await automodSettings.findOne({ guildId: message.guild.id });
    if (!settings || !settings.translationEnabled) {
      return;
    }

    const enabledLanguages = settings.translationLanguages || ['en', 'de', 'fr', 'es'];
    if (!enabledLanguages.includes(targetLanguage)) {
      return;
    }

    await user.send('⏳ Translating...').then(msg => {
      setTimeout(() => msg.delete().catch(() => {}), 3000);
    }).catch(() => {});

    let cachedTranslation = await messageTranslations.findOne({
      guildId: message.guild.id,
      messageId: message.id
    });

    let translation;

    if (cachedTranslation && cachedTranslation.translations[targetLanguage]) {
      translation = cachedTranslation.translations[targetLanguage];
      console.log(`Using cached translation for message ${message.id} (${targetLanguage})`);
    } else {
      console.log(`Translating message ${message.id} to ${targetLanguage}...`);
      translation = await translateMessage(message.content, targetLanguage);

      if (!translation) {
        await user.send('❌ Translation failed. Please try again later.').catch(() => {});
        return;
      }

      if (cachedTranslation) {
        await messageTranslations.updateOne(
          { guildId: message.guild.id, messageId: message.id },
          { $set: { [`translations.${targetLanguage}`]: translation } }
        );
      } else {
        await messageTranslations.insertOne({
          guildId: message.guild.id,
          messageId: message.id,
          channelId: message.channel.id,
          originalText: message.content,
          sourceLanguage: 'unknown',
          translations: {
            [targetLanguage]: translation
          },
          translatedAt: new Date()
        });
      }

      console.log(`Translation cached for message ${message.id} (${targetLanguage})`);
    }

    const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage.toUpperCase();
    const flag = Object.keys(LANGUAGE_FLAGS).find(key => LANGUAGE_FLAGS[key] === targetLanguage);

    await user.send({
      content: `${flag} **${languageName} Translation:**\n>>> ${translation}\n\n*Original message by ${message.author.tag} in #${message.channel.name}*`
    }).catch(err => {
      console.error(`Failed to send translation DM to ${user.tag}:`, err);
    });

  } catch (error) {
    console.error('Translation reaction error:', error);
    await user.send('❌ An error occurred while translating. Please try again.').catch(() => {});
  }
}

module.exports = {
  handleTranslationReaction
};