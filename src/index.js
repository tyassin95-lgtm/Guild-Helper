require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { connectMongo, getCollections, getClient } = require('./db/mongo');
const { ensureIndexes } = require('./db/indexes');
const { registerSlashCommands } = require('./bot/commands');
const { onInteractionCreate } = require('./bot/handlers/interaction');
const { resumeActiveItemRolls } = require('./features/itemroll/utils/itemRollResume');
const { startItemRollAutoUpdate, stopItemRollAutoUpdate } = require('./features/itemroll/utils/itemRollAutoUpdate');
const { resumeActivePolls } = require('./features/polls/utils/pollResume');
const { startPollAutoUpdate, stopPollAutoUpdate } = require('./features/polls/utils/pollAutoUpdate');
const { startCalendarAutoUpdate, stopCalendarAutoUpdate } = require('./features/pvp/calendar/calendarAutoUpdate');
const { startAttendanceReminder, stopAttendanceReminder } = require('./features/pvp/attendanceReminder');
const { startRosterAutoUpdate, stopRosterAutoUpdate } = require('./features/parties/rosterAutoUpdate');
const { handleGearUpload } = require('./features/parties/handlers/gearUploadHandler');
const { handleAutoModCheck } = require('./features/automod/handlers/messageHandler');
const { handleTranslationReaction } = require('./features/automod/handlers/reactionHandler');
const { stopEmbedUpdateQueue } = require('./features/pvp/embedUpdateQueue');
const { clearAllMemberCaches } = require('./features/pvp/embed');

// Import web server
const { webServer } = require('./web/server');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

(async function boot() {
  try {
    const db = await connectMongo(process.env.MONGODB_URI);
    const collections = getCollections(db);
    await ensureIndexes(collections);

    // Initialize web server with MongoDB client for session storage
    const mongoClient = getClient();
    webServer.initialize(collections, client, mongoClient);

    client.once('clientReady', async () => {
      console.log(`Logged in as ${client.user.tag}!`);
      await registerSlashCommands(client);
      console.log('Slash commands registered.');

      // Resume active item rolls and polls
      await resumeActiveItemRolls(client, collections);
      startItemRollAutoUpdate(client, collections);

      await resumeActivePolls(client, collections);
      startPollAutoUpdate(client, collections);

      // Start auto-update tasks
      startCalendarAutoUpdate(client, collections);
      startAttendanceReminder(client, collections);
      startRosterAutoUpdate(client, collections);

      // Start web server
      webServer.start();

      console.log('✅ All systems initialized and running');
    });

    client.on('interactionCreate', async (interaction) => {
      try {
        await onInteractionCreate({ client, interaction, db, collections });
      } catch (err) {
        console.error('Interaction error:', err);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '❌ An error occurred!', flags: [64] }).catch(() => {});
        } else {
          await interaction.reply({ content: '❌ An error occurred!', flags: [64] }).catch(() => {});
        }
      }
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      try {
        if (message.guild) {
          await handleAutoModCheck({ message, collections, client });
        }

        if (message.attachments.size > 0) {
          await handleGearUpload({ message, collections });
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;

      try {
        if (reaction.partial) {
          try {
            await reaction.fetch();
          } catch (error) {
            console.error('Error fetching reaction:', error);
            return;
          }
        }

        await handleTranslationReaction({ reaction, user, collections, client });
      } catch (err) {
        console.error('Error handling reaction:', err);
      }
    });

    // Graceful shutdown handlers
    const shutdown = async (signal) => {
      console.log(`\n🛑 ${signal} received, shutting down gracefully...`);

      // Stop auto-update tasks
      stopItemRollAutoUpdate();
      stopPollAutoUpdate();
      stopCalendarAutoUpdate();
      stopAttendanceReminder();
      stopRosterAutoUpdate();

      // Stop embed update queue (clears pending updates)
      stopEmbedUpdateQueue();

      // Clear member caches
      clearAllMemberCaches();

      // Stop web server
      webServer.stop();

      // Disconnect Discord client
      client.destroy();

      console.log('✅ Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    console.log('Loaded token:', process.env.DISCORD_TOKEN ? '✅ Found' : '❌ Missing');
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error('Fatal boot error:', err);
    process.exit(1);
  }
})();