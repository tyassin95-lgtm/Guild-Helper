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
    guildSettings: db.collection('guildSettings'),
    raidEvents: db.collection('raidEvents'),
    partyPlayers: db.collection('partyPlayers'),
    parties: db.collection('parties'),
    partyPanels: db.collection('partyPanels'),
    guildRosters: db.collection('guildRosters'),
    dmContexts: db.collection('dmContexts'),
    pvpEvents: db.collection('pvpEvents'),
    pvpBonuses: db.collection('pvpBonuses'),
    pvpActivityRanking: db.collection('pvpActivityRanking'),
    pvpCalendars: db.collection('pvpCalendars'),
    itemRolls: db.collection('itemRolls'),
    applicationPanels: db.collection('applicationPanels'),
    applicationTickets: db.collection('applicationTickets'),
    applicationResponses: db.collection('applicationResponses'),
    applicationNotes: db.collection('applicationNotes'),
    applicationBlacklist: db.collection('applicationBlacklist'),
    applicationCooldowns: db.collection('applicationCooldowns'),
    gamblingBalances: db.collection('gamblingBalances'),
    gamblingFunds: db.collection('gamblingFunds'),
    gamblingGames: db.collection('gamblingGames'),
    blackjackGames: db.collection('blackjackGames'),
    gamblingRaids: db.collection('gamblingRaids'),
    triviaStats: db.collection('triviaStats'),
    triviaSessions: db.collection('triviaSessions'),
    robCooldowns: db.collection('robCooldowns'),
    robStats: db.collection('robStats'),
    killCooldowns: db.collection('killCooldowns'),
    killStats: db.collection('killStats'),
    killBiases: db.collection('killBiases'),
    transferHistory: db.collection('transferHistory'),
    wishlistSubmissions: db.collection('wishlistSubmissions'),
    wishlistPanels: db.collection('wishlistPanels'),
    wishlistSettings: db.collection('wishlistSettings'),
    wishlistGivenItems: db.collection('wishlistGivenItems'),
    guildPolls: db.collection('guildPolls'),
    automodSettings: db.collection('automodSettings'),
    automodLogs: db.collection('automodLogs'),
    automodWarnings: db.collection('automodWarnings'),
    messageTranslations: db.collection('messageTranslations'),
    eventParties: db.collection('eventParties'),
    staticEvents: db.collection('staticEvents'),
    guildSupportConfig: db.collection('guildSupportConfig'),
    guildSupportRequests: db.collection('guildSupportRequests'),
    guildSupportQueue: db.collection('guildSupportQueue'),
    inboxMessages: db.collection('inboxMessages')
  };
}

module.exports = { connectMongo, getDb, getClient, getCollections };