/**
 * Central broadcast manager - coordinates voice receiving and streaming
 */

const { VoiceReceiver } = require('../handlers/voiceReceiver');
const { AudioMixer } = require('../handlers/audioMixer');
const { streamServer } = require('../server/streamServer');
const prism = require('prism-media');

class BroadcastManager {
  constructor() {
    this.activeSessions = new Map(); // guildId -> { receiver, mixer, opusEncoder, oggMuxer }
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

    // Create HTTP stream
    const httpStream = streamServer.createStream(guildId);

    // Create components
    const receiver = new VoiceReceiver(client, collections);
    const mixer = new AudioMixer();

    // Encode PCM to Opus
    const opusEncoder = new prism.opus.Encoder({
      frameSize: 960,
      channels: 2,
      rate: 48000
    });

    // Wrap Opus in Ogg container for streaming compatibility
    const oggMuxer = new prism.opus.OggLogicalBitstream({
      opusHead: new prism.opus.OpusHead({
        channelCount: 2,
        sampleRate: 48000
      }),
      pageSizeControl: {
        maxPackets: 10
      }
    });

    // Start receiving from source channel
    await receiver.startReceiving(guildId, sourceChannelId, broadcastUserIds, mixer);

    // Pipe: Mixer (PCM) -> Opus Encoder -> Ogg Muxer -> HTTP Stream
    mixer.pipe(opusEncoder).pipe(oggMuxer).pipe(httpStream);

    // Add error handlers
    opusEncoder.on('error', (err) => {
      console.error(`[BroadcastManager] Encoder error for guild ${guildId}:`, err);
    });

    oggMuxer.on('error', (err) => {
      console.error(`[BroadcastManager] OggMuxer error for guild ${guildId}:`, err);
    });

    mixer.on('error', (err) => {
      console.error(`[BroadcastManager] Mixer error for guild ${guildId}:`, err);
    });

    httpStream.on('error', (err) => {
      console.error(`[BroadcastManager] HTTP stream error for guild ${guildId}:`, err);
    });

    // Store session
    this.activeSessions.set(guildId, {
      receiver,
      mixer,
      opusEncoder,
      oggMuxer,
      httpStream,
      sourceChannelId,
      broadcastUserIds
    });

    const streamUrl = streamServer.getStreamUrl(guildId);
    console.log(`[BroadcastManager] Broadcast started successfully`);
    console.log(`[BroadcastManager] Stream URL: ${streamUrl}`);

    return streamUrl;
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
      if (session.oggMuxer) {
        session.oggMuxer.destroy();
      }

      if (session.opusEncoder) {
        session.opusEncoder.destroy();
      }

      if (session.mixer) {
        session.mixer.destroy();
      }

      // Remove HTTP stream
      streamServer.removeStream(guildId);

      this.activeSessions.delete(guildId);
      console.log(`[BroadcastManager] Broadcast stopped successfully for guild ${guildId}`);
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