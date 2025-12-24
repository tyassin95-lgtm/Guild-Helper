const { MongoClient } = require('mongodb');
const { DEFAULT_DB_NAME } = require('../config');

let _client;
let _db;

async function connectMongo(uri) {
  if (!uri) throw new Error('MONGODB_URI is missing');
  _client = await MongoClient.connect(uri);
  console.log('Connected to MongoDB');
  _db = _client.db(DEFAULT_DB_NAME);
  return _db;
}

function getDb() {
  if (!_db) throw new Error('Database not connected yet');
  return _db;
}

function getClient() {
  if (!_client) throw new Error('MongoDB client not connected yet');
  return _client;
}

function getCollections(db = _db) {
  return {
    // Guild settings (shared by all features)
    guildSettings: db.collection('guildSettings'),

    // Raid system
    raidSessions: db.collection('raidSessions'),
    raidEvents: db.collection('raidEvents'),

    // Party system
    partyPlayers: db.collection('partyPlayers'),
    parties: db.collection('parties'),
    partyPanels: db.collection('partyPanels'),
    guildRosters: db.collection('guildRosters'),

    // DM context tracking
    dmContexts: db.collection('dmContexts'),

    // PvP system
    pvpEvents: db.collection('pvpEvents'),
    pvpBonuses: db.collection('pvpBonuses'),
    pvpActivityRanking: db.collection('pvpActivityRanking'),

    // Item Roll system
    itemRolls: db.collection('itemRolls'),

    // Application system
    applicationPanels: db.collection('applicationPanels'),
    applicationTickets: db.collection('applicationTickets'),
    applicationResponses: db.collection('applicationResponses'),
    applicationNotes: db.collection('applicationNotes'),
    applicationBlacklist: db.collection('applicationBlacklist'),
    applicationCooldowns: db.collection('applicationCooldowns'),

    // Gambling system
    gamblingBalances: db.collection('gamblingBalances'),
    gamblingDailies: db.collection('gamblingDailies'),
    gamblingGames: db.collection('gamblingGames'),
    blackjackGames: db.collection('blackjackGames'),

    // Trivia system
    triviaStats: db.collection('triviaStats'),
    triviaSessions: db.collection('triviaSessions'),

    // Rob system
    robCooldowns: db.collection('robCooldowns'),
    robStats: db.collection('robStats'),

    // Transfer system
    transferHistory: db.collection('transferHistory'),

    // Broadcast system
    broadcastSessions: db.collection('broadcastSessions'),
    broadcastUsers: db.collection('broadcastUsers')
  };
}

module.exports = { connectMongo, getDb, getClient, getCollections };