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

    // CRITICAL FIX: Create Opus encoder with proper error handling and settings
    const opusEncoder = new prism.opus.Encoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
      fec: true,           // Forward Error Correction for better quality
      plp: 0               // Packet loss percentage
    });

    console.log(`[BroadcastManager] 🎵 Opus encoder created with settings:`, {
      frameSize: 960,
      channels: 2,
      rate: 48000,
      fec: true
    });

    // Start receiving from source channel
    await receiver.startReceiving(guildId, sourceChannelId, broadcastUserIds, mixer);

    // Track encoder health
    let encoderPacketCount = 0;
    let encoderErrorCount = 0;

    // CRITICAL: We need to split the mixer's PCM output to TWO destinations:
    // 1. Opus encoder → Opus HTTP stream (for Discord bots)
    // 2. Direct → PCM HTTP stream (for VLC/FFplay)

    // Create separate passthroughs for each destination to avoid backpressure issues
    const encoderPassthrough = new PassThrough({
      highWaterMark: 16384
    });

    const pcmPassthrough = new PassThrough({
      highWaterMark: 16384
    });

    // Pipe mixer to both destinations
    mixer.pipe(encoderPassthrough);
    mixer.pipe(pcmPassthrough);

    // Pipe encoder passthrough to opus encoder, then to opus stream
    encoderPassthrough.pipe(opusEncoder);
    opusEncoder.pipe(opusStream);

    // Pipe PCM passthrough directly to PCM broadcast
    pcmPassthrough.pipe(pcmBroadcast);

    // Monitor Opus encoder output
    opusEncoder.on('data', (chunk) => {
      encoderPacketCount++;
      if (encoderPacketCount % 100 === 0) {
        console.log(`[BroadcastManager] 📤 Opus encoder: ${encoderPacketCount} packets encoded`);
      }
    });

    // Add comprehensive error handlers with recovery
    opusEncoder.on('error', (err) => {
      encoderErrorCount++;
      console.error(`[BroadcastManager] ❌ Encoder error #${encoderErrorCount} for guild ${guildId}:`, err);

      // If encoder keeps failing, something is seriously wrong
      if (encoderErrorCount > 10) {
        console.error(`[BroadcastManager] 🔥 Too many encoder errors, stopping broadcast`);
        this.stopBroadcast(guildId);
      }
    });

    mixer.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ Mixer error for guild ${guildId}:`, err);
    });

    opusStream.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ Opus stream error for guild ${guildId}:`, err);
    });

    pcmBroadcast.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ PCM broadcast error for guild ${guildId}:`, err);
    });

    encoderPassthrough.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ Encoder passthrough error for guild ${guildId}:`, err);
    });

    pcmPassthrough.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ PCM passthrough error for guild ${guildId}:`, err);
    });

    // Monitor for stream end events (shouldn't happen with continuous silence)
    opusEncoder.on('end', () => {
      console.warn(`[BroadcastManager] ⚠️ Opus encoder ended for guild ${guildId}`);
    });

    encoderPassthrough.on('end', () => {
      console.warn(`[BroadcastManager] ⚠️ Encoder passthrough ended for guild ${guildId}`);
    });

    // Store session
    this.activeSessions.set(guildId, {
      receiver,
      mixer,
      opusEncoder,
      encoderPassthrough,
      pcmPassthrough,
      opusStream,
      pcmBroadcast,
      sourceChannelId,
      broadcastUserIds,
      startedAt: Date.now()
    });

    const opusUrl = streamServer.getStreamUrl(guildId, 'opus');
    const pcmUrl = streamServer.getStreamUrl(guildId, 'pcm');

    console.log(`[BroadcastManager] ✅ Broadcast started successfully`);
    console.log(`[BroadcastManager] 🎵 Opus Stream: ${opusUrl}`);
    console.log(`[BroadcastManager] 🎧 PCM Stream: ${pcmUrl}`);
    console.log(`[BroadcastManager] 📝 FFplay command: ffplay -f s16le -ar 48000 -ac 2 ${pcmUrl}`);

    // Start a health check interval
    const healthCheckInterval = setInterval(() => {
      const session = this.activeSessions.get(guildId);
      if (!session) {
        clearInterval(healthCheckInterval);
        return;
      }

      const uptime = Math.floor((Date.now() - session.startedAt) / 1000);
      console.log(`[BroadcastManager] 💓 Health check for guild ${guildId}:`);
      console.log(`  - Uptime: ${uptime}s`);
      console.log(`  - Opus packets: ${encoderPacketCount}`);
      console.log(`  - Encoder errors: ${encoderErrorCount}`);
      console.log(`  - Active sources: ${mixer.sources.size}`);
    }, 60000); // Every 60 seconds

    // Store interval for cleanup
    this.activeSessions.get(guildId).healthCheckInterval = healthCheckInterval;

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
      // Clear health check interval
      if (session.healthCheckInterval) {
        clearInterval(session.healthCheckInterval);
      }

      // Stop receiving
      if (session.receiver) {
        await session.receiver.stopReceiving(guildId);
      }

      // Destroy streams in reverse order
      if (session.pcmPassthrough) {
        session.pcmPassthrough.destroy();
      }

      if (session.encoderPassthrough) {
        session.encoderPassthrough.destroy();
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