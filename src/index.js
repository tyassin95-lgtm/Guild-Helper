require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { connectMongo, getCollections } = require('./db/mongo');
const { ensureIndexes } = require('./db/indexes');
const { registerSlashCommands } = require('./bot/commands');
const { onInteractionCreate } = require('./bot/handlers/interaction');
const { startTokenRegenerationChecker } = require('./bot/tokenRegeneration');
const { startPartyPanelUpdater } = require('./features/parties/panelUpdater');
const { startPeriodicRebalancer } = require('./features/parties/rebalancing');
const { resumeActiveRaidCountdowns, clearAllCountdownIntervals } = require('./features/raids/raidSession');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
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

      // Start the token regeneration checker
      startTokenRegenerationChecker(client, collections);

      // Start the party panel auto-updater
      startPartyPanelUpdater(client, collections);

      // Start the periodic party rebalancer (runs every 72 hours)
      startPeriodicRebalancer(client, collections);

      // Resume active raid countdowns after bot restart
      await resumeActiveRaidCountdowns(client, collections);
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

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');

      // Clear all raid countdown intervals
      clearAllCountdownIntervals();

      // Destroy Discord client
      client.destroy();

      console.log('✅ Shutdown complete');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 SIGTERM received, shutting down...');

      // Clear all raid countdown intervals
      clearAllCountdownIntervals();

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