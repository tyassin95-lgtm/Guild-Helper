require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { connectMongo, getCollections } = require('./db/mongo');
const { ensureIndexes } = require('./db/indexes');
const { registerSlashCommands } = require('./bot/commands');
const { onInteractionCreate } = require('./bot/handlers/interaction');
const { resumeActiveItemRolls } = require('./features/itemroll/utils/itemRollResume');
const { startItemRollAutoUpdate, stopItemRollAutoUpdate } = require('./features/itemroll/utils/itemRollAutoUpdate');
const { resumeActivePolls } = require('./features/polls/utils/pollResume');
const { startPollAutoUpdate, stopPollAutoUpdate } = require('./features/polls/utils/pollAutoUpdate');
const { startCalendarAutoUpdate, stopCalendarAutoUpdate } = require('./features/pvp/calendar/calendarAutoUpdate');
const { streamServer } = require('./features/broadcast/server/streamServer');
const { broadcastManager } = require('./features/broadcast/utils/broadcastManager');
const { handleGearUpload } = require('./features/parties/handlers/gearUploadHandler');
const { handleAutoModCheck } = require('./features/automod/handlers/messageHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,  // Required for voice receiving
    GatewayIntentBits.DirectMessages     // Required for DM gear uploads
  ]
});

(async function boot() {
  try {
    const db = await connectMongo(process.env.MONGODB_URI);
    const collections = getCollections(db);
    await ensureIndexes(collections);

    client.once('clientReady', async () => {
      console.log(`Logged in as ${client.user.tag}!`);
      await registerSlashCommands(client);
      console.log('Slash commands registered.');

      // Start the HTTP stream server
      streamServer.start();

      // Resume active item rolls after bot restart
      await resumeActiveItemRolls(client, collections);

      // Start auto-updating item roll embeds every 5 minutes
      startItemRollAutoUpdate(client, collections);

      // Resume active polls after bot restart
      await resumeActivePolls(client, collections);

      // Start auto-updating poll system (checks every 60 seconds)
      startPollAutoUpdate(client, collections);

      // Start PvP calendar auto-update (every 5 minutes)
      startCalendarAutoUpdate(client, collections);
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

    // Handle message events for gear screenshot uploads AND automod
    client.on('messageCreate', async (message) => {
      // Ignore bot messages
      if (message.author.bot) return;

      try {
        // Handle automod check for guild messages
        if (message.guild) {
          await handleAutoModCheck({ message, collections, client });
        }

        // Handle gear screenshot uploads (only process messages with attachments)
        if (message.attachments.size > 0) {
          await handleGearUpload({ message, collections });
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');

      // Stop item roll auto-updates
      stopItemRollAutoUpdate();

      // Stop poll auto-updates
      stopPollAutoUpdate();

      // Stop calendar auto-updates
      stopCalendarAutoUpdate();

      // Stop all broadcasts
      broadcastManager.stopAll();
      streamServer.stop();

      // Destroy Discord client
      client.destroy();

      console.log('✅ Shutdown complete');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 SIGTERM received, shutting down...');

      // Stop item roll auto-updates
      stopItemRollAutoUpdate();

      // Stop poll auto-updates
      stopPollAutoUpdate();

      // Stop calendar auto-updates
      stopCalendarAutoUpdate();

      // Stop all broadcasts
      broadcastManager.stopAll();
      streamServer.stop();

      // Destroy Discord client
      client.destroy();

      console.log('✅ Shutdown complete');
      process.exit(0);
    });

    console.log('Loaded token:', process.env.DISCORD_TOKEN ? '✅ Found' : '❌ Missing');
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error('Fatal boot error:', err);
    process.exit(1);
  }
})();