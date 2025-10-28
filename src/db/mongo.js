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
    // Wishlist system
    wishlists: db.collection('wishlists'),
    panels: db.collection('panels'),
    handedOut: db.collection('handedout'),
    liveSummaries: db.collection('liveSummaries'),
    tokenRegenerations: db.collection('tokenRegenerations'),
    userCooldowns: db.collection('userCooldowns'),
    guildSettings: db.collection('guildSettings'),

    // Raid system
    raidSessions: db.collection('raidSessions'),
    raidEvents: db.collection('raidEvents'),

    // Party system
    partyPlayers: db.collection('partyPlayers'),
    parties: db.collection('parties'),
    partyPanels: db.collection('partyPanels'),

    // DM context tracking
    dmContexts: db.collection('dmContexts'),

    // PvP system
    pvpEvents: db.collection('pvpEvents'),
    pvpBonuses: db.collection('pvpBonuses'),
    pvpActivityRanking: db.collection('pvpActivityRanking'),

    // Application system
    applicationPanels: db.collection('applicationPanels'),
    applicationTickets: db.collection('applicationTickets'),
    applicationResponses: db.collection('applicationResponses'),
    applicationNotes: db.collection('applicationNotes'),
    applicationBlacklist: db.collection('applicationBlacklist'),
    applicationCooldowns: db.collection('applicationCooldowns')
  };
}

module.exports = { connectMongo, getDb, getClient, getCollections };