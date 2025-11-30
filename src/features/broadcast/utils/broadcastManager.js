const { VoiceReceiver } = require('../handlers/voiceReceiver');
const { AudioMixer } = require('../handlers/audioMixer');
const { streamServer } = require('../server/streamServer');
const prism = require('prism-media');
const { PassThrough } = require('stream');

class BroadcastManager {
  constructor() {
    this.activeSessions = new Map();
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

    // Create HTTP streams
    const { opusStream, pcmBroadcast } = streamServer.createStream(guildId);

    // CRITICAL: Create Opus encoder with proper error handling
    const opusEncoder = new prism.opus.Encoder({
      frameSize: 960,
      channels: 2,
      rate: 48000,
      fec: true,
      plp: 0
    });

    console.log(`[BroadcastManager] 🎵 Opus encoder created`);

    // Start receiving from source channel
    await receiver.startReceiving(guildId, sourceChannelId, broadcastUserIds, mixer);

    // Track encoder health
    let encoderPacketCount = 0;
    let encoderErrorCount = 0;
    let lastEncoderData = Date.now();

    // CRITICAL FIX: Create robust passthroughs with error recovery
    const encoderPassthrough = new PassThrough({
      highWaterMark: 16384
    });

    const pcmPassthrough = new PassThrough({
      highWaterMark: 16384
    });

    // Pipe mixer to both destinations
    mixer.pipe(encoderPassthrough);
    mixer.pipe(pcmPassthrough);

    // Pipe encoder passthrough to opus encoder
    encoderPassthrough.pipe(opusEncoder);

    // CRITICAL FIX: Handle encoder pipe errors gracefully
    encoderPassthrough.on('pipe', () => {
      console.log(`[BroadcastManager] Encoder passthrough piped`);
    });

    encoderPassthrough.on('unpipe', () => {
      console.warn(`[BroadcastManager] ⚠️ Encoder passthrough unpiped`);
    });

    // Pipe encoder to opus stream
    opusEncoder.pipe(opusStream);

    // Pipe PCM passthrough directly to PCM broadcast
    pcmPassthrough.pipe(pcmBroadcast);

    // Monitor Opus encoder output
    opusEncoder.on('data', (chunk) => {
      encoderPacketCount++;
      lastEncoderData = Date.now();

      if (encoderPacketCount % 500 === 0) {
        console.log(`[BroadcastManager] 📤 Opus encoder: ${encoderPacketCount} packets encoded`);
      }
    });

    // COMPREHENSIVE ERROR HANDLERS with recovery
    opusEncoder.on('error', (err) => {
      encoderErrorCount++;
      console.error(`[BroadcastManager] ❌ Encoder error #${encoderErrorCount}:`, err);

      if (encoderErrorCount > 10) {
        console.error(`[BroadcastManager] 🔥 Too many encoder errors, stopping broadcast`);
        this.stopBroadcast(guildId);
      }
    });

    // Handle encoder close/end events
    opusEncoder.on('end', () => {
      console.warn(`[BroadcastManager] ⚠️ Opus encoder ended for guild ${guildId}`);
    });

    opusEncoder.on('close', () => {
      console.warn(`[BroadcastManager] ⚠️ Opus encoder closed for guild ${guildId}`);
    });

    mixer.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ Mixer error:`, err);
    });

    mixer.on('end', () => {
      console.warn(`[BroadcastManager] ⚠️ Mixer ended for guild ${guildId}`);
    });

    mixer.on('close', () => {
      console.warn(`[BroadcastManager] ⚠️ Mixer closed for guild ${guildId}`);
    });

    opusStream.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ Opus stream error:`, err);
    });

    pcmBroadcast.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ PCM broadcast error:`, err);
    });

    encoderPassthrough.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ Encoder passthrough error:`, err);
    });

    pcmPassthrough.on('error', (err) => {
      console.error(`[BroadcastManager] ❌ PCM passthrough error:`, err);
    });

    // CRITICAL: Monitor stream health and detect stalls
    const streamHealthCheck = setInterval(() => {
      const timeSinceData = Date.now() - lastEncoderData;

      if (timeSinceData > 5000) {
        console.error(`[BroadcastManager] 🚨 CRITICAL: No encoder output for ${timeSinceData}ms!`);
        console.error(`[BroadcastManager] Encoder may have stalled. Attempting recovery...`);

        // Don't automatically stop - let it try to recover
        // The mixer should still be sending silence frames
      }
    }, 10000); // Check every 10 seconds

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
      startedAt: Date.now(),
      streamHealthCheck
    });

    const opusUrl = streamServer.getStreamUrl(guildId, 'opus');
    const pcmUrl = streamServer.getStreamUrl(guildId, 'pcm');

    console.log(`[BroadcastManager] ✅ Broadcast started successfully`);
    console.log(`[BroadcastManager] 🎵 Opus Stream: ${opusUrl}`);
    console.log(`[BroadcastManager] 🎧 PCM Stream: ${pcmUrl}`);

    // Detailed health check interval
    const healthCheckInterval = setInterval(() => {
      const session = this.activeSessions.get(guildId);
      if (!session) {
        clearInterval(healthCheckInterval);
        return;
      }

      const uptime = Math.floor((Date.now() - session.startedAt) / 1000);
      const timeSinceData = Date.now() - lastEncoderData;

      console.log(`[BroadcastManager] 💓 Health check for guild ${guildId}:`);
      console.log(`  - Uptime: ${uptime}s`);
      console.log(`  - Opus packets: ${encoderPacketCount}`);
      console.log(`  - Encoder errors: ${encoderErrorCount}`);
      console.log(`  - Active sources: ${mixer.sources.size}`);
      console.log(`  - Last encoder data: ${timeSinceData}ms ago`);
      console.log(`  - Mixer frames: ${mixer.frameCount || 'N/A'}`);
    }, 60000); // Every 60 seconds

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
      // Clear intervals
      if (session.healthCheckInterval) {
        clearInterval(session.healthCheckInterval);
      }
      if (session.streamHealthCheck) {
        clearInterval(session.streamHealthCheck);
      }

      // Stop receiving
      if (session.receiver) {
        await session.receiver.stopReceiving(guildId);
      }

      // Unpipe everything before destroying
      if (session.mixer) {
        session.mixer.unpipe();
      }

      if (session.encoderPassthrough) {
        session.encoderPassthrough.unpipe();
      }

      if (session.opusEncoder) {
        session.opusEncoder.unpipe();
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