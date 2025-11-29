const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  EndBehaviorType,
  StreamType
} = require('@discordjs/voice');

class AudioManager {
  constructor() {
    this.sourceConnection = null;
    this.targetConnections = new Map();
    this.audioPlayers = new Map();
    this.audioReceiver = null;
    this.activeStreams = new Map();
    this.volumeLevel = 100;
    this.guildId = null;
    this.sourceChannelId = null;
  }

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
        selfDeaf: false,
        selfMute: true
      });

      await this.waitForConnection(this.sourceConnection);

      this.audioReceiver = this.sourceConnection.receiver;

      // Join all target channels
      for (const targetId of targetChannelIds) {
        await this.joinTargetChannel(guild, targetId, settings);
      }

      this.setupSpeakingListeners();

      console.log(`✅ Broadcast started: ${sourceChannelId} -> ${targetChannelIds.length} channels`);
      return true;

    } catch (error) {
      console.error('Failed to start broadcast:', error);
      await this.cleanup();
      throw error;
    }
  }

  async waitForConnection(connection, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Voice connection timeout'));
      }, timeout);

      if (connection.state.status === VoiceConnectionStatus.Ready) {
        clearTimeout(timer);
        resolve();
        return;
      }

      const readyHandler = () => {
        clearTimeout(timer);
        cleanup();
        resolve();
      };

      const destroyHandler = () => {
        clearTimeout(timer);
        cleanup();
        reject(new Error('Voice connection destroyed'));
      };

      const disconnectHandler = async () => {
        // Don't reject immediately, wait a bit for reconnection
        await new Promise(r => setTimeout(r, 2000));
        if (connection.state.status !== VoiceConnectionStatus.Ready) {
          clearTimeout(timer);
          cleanup();
          reject(new Error('Voice connection disconnected'));
        }
      };

      const cleanup = () => {
        connection.off(VoiceConnectionStatus.Ready, readyHandler);
        connection.off(VoiceConnectionStatus.Destroyed, destroyHandler);
        connection.off(VoiceConnectionStatus.Disconnected, disconnectHandler);
      };

      connection.once(VoiceConnectionStatus.Ready, readyHandler);
      connection.once(VoiceConnectionStatus.Destroyed, destroyHandler);
      connection.once(VoiceConnectionStatus.Disconnected, disconnectHandler);
    });
  }

  async joinTargetChannel(guild, channelId, settings) {
    const connection = joinVoiceChannel({
      channelId: channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    await this.waitForConnection(connection);

    const player = createAudioPlayer();
    connection.subscribe(player);

    this.targetConnections.set(channelId, connection);
    this.audioPlayers.set(channelId, player);

    // Simplified connection handling - no auto-reconnect
    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.warn(`Disconnected from target channel: ${channelId}`);
      // Just remove it, don't try to reconnect automatically
      this.targetConnections.delete(channelId);
      this.audioPlayers.delete(channelId);
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.targetConnections.delete(channelId);
      this.audioPlayers.delete(channelId);
    });
  }

  setupSpeakingListeners() {
    this.audioReceiver.speaking.on('start', (userId) => {
      console.log(`🎤 User started speaking: ${userId}`);
      this.handleUserSpeaking(userId);
    });
  }

  async handleUserSpeaking(userId) {
    if (!this.activeStreams.has(userId)) {
      this.activeStreams.set(userId, new Set());
    }

    const userStreams = this.activeStreams.get(userId);

    for (const [channelId, player] of this.audioPlayers) {
      try {
        const opusStream = this.audioReceiver.subscribe(userId, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 100
          }
        });

        userStreams.add(opusStream);

        const resource = createAudioResource(opusStream, {
          inputType: StreamType.Opus,
          inlineVolume: true
        });

        if (resource.volume) {
          resource.volume.setVolume(this.volumeLevel / 100);
        }

        player.play(resource);

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

  setVolume(level) {
    this.volumeLevel = Math.max(0, Math.min(100, level));
    console.log(`🔊 Volume set to ${this.volumeLevel}%`);
  }

  async addTargetChannel(guild, channelId, settings) {
    if (this.targetConnections.has(channelId)) {
      throw new Error('Channel is already a broadcast target');
    }

    await this.joinTargetChannel(guild, channelId, settings);
    console.log(`➕ Added target channel: ${channelId}`);
  }

  async removeTargetChannel(channelId) {
    const connection = this.targetConnections.get(channelId);
    if (connection) {
      try {
        connection.destroy();
      } catch (err) {
        // Ignore if already destroyed
      }
      this.targetConnections.delete(channelId);
      this.audioPlayers.delete(channelId);
      console.log(`➖ Removed target channel: ${channelId}`);
    }
  }

  async cleanup() {
    for (const streamSet of this.activeStreams.values()) {
      for (const stream of streamSet) {
        try {
          stream.destroy();
        } catch (err) {
          // Ignore
        }
      }
    }
    this.activeStreams.clear();

    if (this.sourceConnection) {
      try {
        this.sourceConnection.destroy();
      } catch (err) {
        // Ignore
      }
      this.sourceConnection = null;
    }

    for (const connection of this.targetConnections.values()) {
      try {
        connection.destroy();
      } catch (err) {
        // Ignore
      }
    }
    this.targetConnections.clear();
    this.audioPlayers.clear();

    this.guildId = null;
    this.sourceChannelId = null;

    console.log('🛑 Broadcast stopped and cleaned up');
  }

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

  isActive() {
    return this.sourceConnection !== null;
  }
}

const audioManagers = new Map();

function getAudioManager(guildId) {
  if (!audioManagers.has(guildId)) {
    audioManagers.set(guildId, new AudioManager());
  }
  return audioManagers.get(guildId);
}

module.exports = { getAudioManager };