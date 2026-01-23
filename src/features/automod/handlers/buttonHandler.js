/**
 * Button handler for translation requests with ephemeral replies
 */

const { translateMessage } = require('../utils/chatgptAnalyzer');

const LANGUAGE_NAMES = {
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish'
};

const LANGUAGE_FLAGS = {
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸'
};

async function handleTranslationButton({ interaction, collections }) {
  if (!interaction.customId.startsWith('translate_')) {
    return;
  }

  const parts = interaction.customId.split('_');
  if (parts.length !== 3) {
    return;
  }

  const targetLanguage = parts[1];
  const messageId = parts[2];

  try {
    const { messageTranslations, automodSettings } = collections;

    const settings = await automodSettings.findOne({ guildId: interaction.guildId });
    if (!settings || !settings.translationEnabled) {
      return interaction.reply({
        content: '❌ Translation is currently disabled.',
        flags: [64]
      });
    }

    const enabledLanguages = settings.translationLanguages || ['en', 'de', 'fr', 'es'];
    if (!enabledLanguages.includes(targetLanguage)) {
      return interaction.reply({
        content: '❌ This language is not enabled.',
        flags: [64]
      });
    }

    await interaction.deferReply({ flags: [64] });

    const originalMessage = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!originalMessage) {
      return interaction.editReply({
        content: '❌ Could not find the original message.',
        flags: [64]
      });
    }

    let cachedTranslation = await messageTranslations.findOne({
      guildId: interaction.guildId,
      messageId: messageId
    });

    let translation;

    if (cachedTranslation && cachedTranslation.translations[targetLanguage]) {
      translation = cachedTranslation.translations[targetLanguage];
      console.log(`Using cached translation for message ${messageId} (${targetLanguage})`);
    } else {
      console.log(`Translating message ${messageId} to ${targetLanguage}...`);
      translation = await translateMessage(originalMessage.content, targetLanguage);

      if (!translation) {
        return interaction.editReply({
          content: '❌ Translation failed. Please try again later.',
          flags: [64]
        });
      }

      if (cachedTranslation) {
        await messageTranslations.updateOne(
          { guildId: interaction.guildId, messageId: messageId },
          { $set: { [`translations.${targetLanguage}`]: translation } }
        );
      } else {
        await messageTranslations.insertOne({
          guildId: interaction.guildId,
          messageId: messageId,
          channelId: interaction.channelId,
          originalText: originalMessage.content,
          sourceLanguage: 'unknown',
          translations: {
            [targetLanguage]: translation
          },
          translatedAt: new Date()
        });
      }

      console.log(`Translation cached for message ${messageId} (${targetLanguage})`);
    }

    const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage.toUpperCase();
    const flag = LANGUAGE_FLAGS[targetLanguage] || '🌐';

    await interaction.editReply({
      content: `${flag} **${languageName} Translation:**\n>>> ${translation}\n\n*Original by ${originalMessage.author.tag}*`,
      flags: [64]
    });

  } catch (error) {
    console.error('Translation button error:', error);

    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ An error occurred while translating.',
        flags: [64]
      });
    } else {
      await interaction.reply({
        content: '❌ An error occurred while translating.',
        flags: [64]
      });
    }
  }
}

module.exports = {
  handleTranslationButton
};