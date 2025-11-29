const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  EndBehaviorType,
  StreamType
} = require('@discordjs/voice');
const prism = require('prism-media');

class AudioManager {
  constructor() {
    this.sourceConnection = null;
    this.targetConnections = new Map(); // channelId -> VoiceConnection
    this.audioPlayers = new Map();      // channelId -> AudioPlayer
    this.audioReceiver = null;
    this.activeStreams = new Map();     // userId -> Set of streams
    this.volumeLevel = 100; // 0-100
    this.guildId = null;
    this.sourceChannelId = null;
  }

  /**
   * Start broadcasting from source channel to target channels
   */
  async startBroadcast(guild, sourceChannelId, targetChannelIds, settings = {}) {
    try {
      this.guildId = guild.id;
      this.sourceChannelId = sourceChannelId;
      this.volumeLevel = settings.volume || 100;

      // Join source channel
      this.sourceConnection = joinVoiceChannel({
        channelId: sourceChannelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false, // MUST be false to receive audio
        selfMute: true   // Bot doesn't speak in source
      });

      // Wait for connection to be ready
      await this.waitForConnection(this.sourceConnection);

      // Set up audio receiver
      this.audioReceiver = this.sourceConnection.receiver;

      // Join all target channels
      for (const targetId of targetChannelIds) {
        await this.joinTargetChannel(guild, targetId, settings);
      }

      // Listen for users speaking in source channel
      this.setupSpeakingListeners();

      console.log(`✅ Broadcast started: ${sourceChannelId} -> ${targetChannelIds.length} channels`);
      return true;

    } catch (error) {
      console.error('Failed to start broadcast:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Wait for voice connection to be ready
   */
  async waitForConnection(connection, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Voice connection timeout'));
      }, timeout);

      if (connection.state.status === VoiceConnectionStatus.Ready) {
        clearTimeout(timer);
        resolve();
        return;
      }

      connection.once(VoiceConnectionStatus.Ready, () => {
        clearTimeout(timer);
        resolve();
      });

      connection.once(VoiceConnectionStatus.Destroyed, () => {
        clearTimeout(timer);
        reject(new Error('Voice connection destroyed'));
      });

      connection.once(VoiceConnectionStatus.Disconnected, () => {
        clearTimeout(timer);
        reject(new Error('Voice connection disconnected'));
      });
    });
  }

  /**
   * Join a target channel and set up audio player
   */
  async joinTargetChannel(guild, channelId, settings) {
    const connection = joinVoiceChannel({
      channelId: channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,  // Bot doesn't need to hear in targets
      selfMute: false  // Bot speaks in targets
    });

    await this.waitForConnection(connection);

    const player = createAudioPlayer();
    connection.subscribe(player);

    this.targetConnections.set(channelId, connection);
    this.audioPlayers.set(channelId, player);

    // Handle connection state changes
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.warn(`Disconnected from target channel: ${channelId}`);
      try {
        await Promise.race([
          new Promise((resolve) => connection.once(VoiceConnectionStatus.Signalling, resolve)),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Reconnect timeout')), 5000))
        ]);
      } catch {
        connection.destroy();
        this.targetConnections.delete(channelId);
        this.audioPlayers.delete(channelId);
      }
    });
  }

  /**
   * Set up listeners for users speaking in source channel
   */
  setupSpeakingListeners() {
    this.audioReceiver.speaking.on('start', (userId) => {
      console.log(`🎤 User started speaking: ${userId}`);
      this.handleUserSpeaking(userId);
    });
  }

  /**
   * Handle a user starting to speak
   */
  async handleUserSpeaking(userId) {
    // Create a set to track streams for this user
    if (!this.activeStreams.has(userId)) {
      this.activeStreams.set(userId, new Set());
    }

    const userStreams = this.activeStreams.get(userId);

    // Broadcast to all target channels
    for (const [channelId, player] of this.audioPlayers) {
      try {
        // Subscribe to user's audio stream (Opus format from Discord)
        const opusStream = this.audioReceiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 100 // Stop after 100ms of silence
          }
        });

        // Store stream for cleanup
        userStreams.add(opusStream);

        // Create audio resource with volume transformer
        const resource = createAudioResource(opusStream, {
          inputType: StreamType.Opus,
          inlineVolume: true
        });

        // Set volume
        if (resource.volume) {
          resource.volume.setVolume(this.volumeLevel / 100);
        }

        // Play in target channel
        player.play(resource);

        // Clean up when stream ends
        opusStream.on('end', () => {
          userStreams.delete(opusStream);
          if (userStreams.size === 0) {
            this.activeStreams.delete(userId);
          }
        });

        opusStream.on('error', (error) => {
          console.error(`Stream error for user ${userId} in channel ${channelId}:`, error);
          userStreams.delete(opusStream);
        });

      } catch (error) {
        console.error(`Failed to broadcast to channel ${channelId}:`, error);
      }
    }
  }

  /**
   * Set volume level for all broadcasts
   */
  setVolume(level) {
    this.volumeLevel = Math.max(0, Math.min(100, level));
    console.log(`🔊 Volume set to ${this.volumeLevel}%`);
  }

  /**
   * Add a new target channel to active broadcast
   */
  async addTargetChannel(guild, channelId, settings) {
    if (this.targetConnections.has(channelId)) {
      throw new Error('Channel is already a broadcast target');
    }

    await this.joinTargetChannel(guild, channelId, settings);
    console.log(`➕ Added target channel: ${channelId}`);
  }

  /**
   * Remove a target channel from active broadcast
   */
  async removeTargetChannel(channelId) {
    const connection = this.targetConnections.get(channelId);
    if (connection) {
      connection.destroy();
      this.targetConnections.delete(channelId);
      this.audioPlayers.delete(channelId);
      console.log(`➖ Removed target channel: ${channelId}`);
    }
  }

  /**
   * Stop broadcasting and clean up all connections
   */
  async cleanup() {
    // Destroy all active streams
    for (const streamSet of this.activeStreams.values()) {
      for (const stream of streamSet) {
        try {
          stream.destroy();
        } catch (err) {
          // Ignore errors during cleanup
        }
      }
    }
    this.activeStreams.clear();

    // Destroy source connection
    if (this.sourceConnection) {
      try {
        this.sourceConnection.destroy();
      } catch (err) {
        // Ignore errors during cleanup
      }
      this.sourceConnection = null;
    }

    // Destroy all target connections
    for (const connection of this.targetConnections.values()) {
      try {
        connection.destroy();
      } catch (err) {
        // Ignore errors during cleanup
      }
    }
    this.targetConnections.clear();
    this.audioPlayers.clear();

    this.guildId = null;
    this.sourceChannelId = null;

    console.log('🛑 Broadcast stopped and cleaned up');
  }

  /**
   * Get current broadcast status
   */
  getStatus() {
    return {
      active: this.sourceConnection !== null,
      sourceConnected: this.sourceConnection?.state.status === VoiceConnectionStatus.Ready,
      sourceChannelId: this.sourceChannelId,
      targetCount: this.targetConnections.size,
      targetChannelIds: Array.from(this.targetConnections.keys()),
      activeSpeakers: this.activeStreams.size,
      volumeLevel: this.volumeLevel,
      guildId: this.guildId
    };
  }

  /**
   * Check if broadcast is active
   */
  isActive() {
    return this.sourceConnection !== null;
  }
}

// Singleton instance per guild (you could make this a Map for multi-guild support)
const audioManagers = new Map(); // guildId -> AudioManager

function getAudioManager(guildId) {
  if (!audioManagers.has(guildId)) {
    audioManagers.set(guildId, new AudioManager());
  }
  return audioManagers.get(guildId);
}

module.exports = { getAudioManager };