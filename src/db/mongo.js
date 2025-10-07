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
    wishlists: db.collection('wishlists'),
    panels: db.collection('panels'),
    handedOut: db.collection('handedout'),
    liveSummaries: db.collection('liveSummaries'),
    tokenRegenerations: db.collection('tokenRegenerations'),
    userCooldowns: db.collection('userCooldowns')
  };
}

module.exports = { connectMongo, getDb, getClient, getCollections };