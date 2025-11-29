const { VoiceReceiver } = require('../handlers/voiceReceiver');
const { AudioMixer } = require('../handlers/audioMixer');
const { streamServer } = require('../server/streamServer');
const prism = require('prism-media');
const { PassThrough } = require('stream');

class BroadcastManager {
  constructor() {
    this.activeSessions = new Map(); // guildId -> { receiver, mixer, opusEncoder, ... }
  }

  isActive(guildId) {
    return this.activeSessions.has(guildId);
  }

  getSession(guildId) {
    return this.activeSessions.get(guildId);
  }

  async startBroadcast(client, collections, guildId, sourceChannelId, broadcastUserIds) {
    if (this.isActive(guildId)) {
      throw new Error('A broadcast is already active for this guild');
    }

    console.log(`[BroadcastManager] Starting broadcast for guild ${guildId}`);
    console.log(`[BroadcastManager] Source channel: ${sourceChannelId}`);
    console.log(`[BroadcastManager] Broadcasting users: ${broadcastUserIds.join(', ')}`);

    // Create components
    const receiver = new VoiceReceiver(client, collections);
    const mixer = new AudioMixer();

    // Create HTTP streams (both Opus and PCM)
    const { opusStream, pcmBroadcast } = streamServer.createStream(guildId);

    // Encode PCM to Opus
    const opusEncoder = new prism.opus.Encoder({
      frameSize: 960,
      channels: 2,
      rate: 48000
    });

    // Start receiving from source channel
    await receiver.startReceiving(guildId, sourceChannelId, broadcastUserIds, mixer);

    // CRITICAL: We need to split the mixer's PCM output to TWO destinations:
    // 1. Opus encoder → Opus HTTP stream (for Discord bots)
    // 2. Direct → PCM HTTP stream (for VLC/FFplay)

    // Pipe mixer to encoder for Opus stream
    mixer.pipe(opusEncoder);
    opusEncoder.pipe(opusStream);

    // ALSO pipe mixer to PCM broadcast (using a separate passthrough to avoid conflicts)
    const pcmSplitter = new PassThrough();
    mixer.pipe(pcmSplitter);
    pcmSplitter.pipe(pcmBroadcast);

    // Add error handlers
    opusEncoder.on('error', (err) => {
      console.error(`[BroadcastManager] Encoder error for guild ${guildId}:`, err);
    });

    mixer.on('error', (err) => {
      console.error(`[BroadcastManager] Mixer error for guild ${guildId}:`, err);
    });

    opusStream.on('error', (err) => {
      console.error(`[BroadcastManager] Opus stream error for guild ${guildId}:`, err);
    });

    pcmBroadcast.on('error', (err) => {
      console.error(`[BroadcastManager] PCM broadcast error for guild ${guildId}:`, err);
    });

    pcmSplitter.on('error', (err) => {
      console.error(`[BroadcastManager] PCM splitter error for guild ${guildId}:`, err);
    });

    // Store session
    this.activeSessions.set(guildId, {
      receiver,
      mixer,
      opusEncoder,
      pcmSplitter,
      opusStream,
      pcmBroadcast,
      sourceChannelId,
      broadcastUserIds
    });

    const opusUrl = streamServer.getStreamUrl(guildId, 'opus');
    const pcmUrl = streamServer.getStreamUrl(guildId, 'pcm');

    console.log(`[BroadcastManager] ✅ Broadcast started successfully`);
    console.log(`[BroadcastManager] 🎵 Opus Stream: ${opusUrl}`);
    console.log(`[BroadcastManager] 🎧 PCM Stream: ${pcmUrl}`);
    console.log(`[BroadcastManager] 📝 FFplay command: ffplay -f s16le -ar 48000 -ac 2 ${pcmUrl}`);

    return opusUrl;
  }

  async stopBroadcast(guildId) {
    const session = this.activeSessions.get(guildId);
    if (!session) {
      console.log(`[BroadcastManager] No active broadcast for guild ${guildId}`);
      return;
    }

    console.log(`[BroadcastManager] Stopping broadcast for guild ${guildId}`);

    try {
      // Stop receiving
      if (session.receiver) {
        await session.receiver.stopReceiving(guildId);
      }

      // Destroy streams in reverse order
      if (session.pcmSplitter) {
        session.pcmSplitter.destroy();
      }

      if (session.opusEncoder) {
        session.opusEncoder.destroy();
      }

      if (session.mixer) {
        session.mixer.destroy();
      }

      // Remove HTTP streams
      streamServer.removeStream(guildId);

      this.activeSessions.delete(guildId);
      console.log(`[BroadcastManager] ✅ Broadcast stopped successfully for guild ${guildId}`);
    } catch (err) {
      console.error(`[BroadcastManager] Error stopping broadcast:`, err);
      // Force cleanup
      this.activeSessions.delete(guildId);
      streamServer.removeStream(guildId);
    }
  }

  getStreamUrl(guildId) {
    if (!this.isActive(guildId)) {
      return null;
    }
    return streamServer.getStreamUrl(guildId);
  }

  getPcmStreamUrl(guildId) {
    if (!this.isActive(guildId)) {
      return null;
    }
    return streamServer.getStreamUrl(guildId, 'pcm');
  }

  stopAll() {
    console.log(`[BroadcastManager] Stopping all broadcasts`);
    for (const guildId of this.activeSessions.keys()) {
      this.stopBroadcast(guildId);
    }
  }
}

// Singleton instance
const broadcastManager = new BroadcastManager();

module.exports = { broadcastManager };