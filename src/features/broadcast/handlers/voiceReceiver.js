/**
 * Voice receiver - joins voice channel and captures audio from selected users
 */

const { 
  joinVoiceChannel, 
  VoiceConnectionStatus, 
  EndBehaviorType 
} = require('@discordjs/voice');
const prism = require('prism-media');

class VoiceReceiver {
  constructor(client, collections) {
    this.client = client;
    this.collections = collections;
    this.connection = null;
    this.userStreams = new Map();
  }

  async startReceiving(guildId, channelId, broadcastUserIds, mixer) {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isVoiceBased()) {
      throw new Error('Invalid voice channel');
    }

    console.log(`[VoiceReceiver] Joining channel ${channelId} in guild ${guildId}`);
    console.log(`[VoiceReceiver] Will broadcast users: ${broadcastUserIds.join(', ')}`);

    this.connection = joinVoiceChannel({
      channelId: channelId,
      guildId: guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true
    });

    this.connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`[VoiceReceiver] ✅ Connected to voice channel ${channelId}`);
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log(`[VoiceReceiver] ⚠️ Disconnected from channel ${channelId}`);
      try {
        await this.connection.destroy();
      } catch (err) {
        console.error('[VoiceReceiver] Error destroying connection:', err);
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.log(`[VoiceReceiver] Connection destroyed`);
      this.cleanup();
    });

    const receiver = this.connection.receiver;

    receiver.speaking.on('start', (userId) => {
      if (!broadcastUserIds.includes(userId)) {
        console.log(`[VoiceReceiver] ⏭️ Ignoring non-broadcast user ${userId}`);
        return;
      }

      console.log(`[VoiceReceiver] 🎙️ User ${userId} started speaking (BROADCASTING)`);

      const opusStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 100
        }
      });

      let packetCount = 0;
      opusStream.on('data', (chunk) => {
        packetCount++;
        if (packetCount % 50 === 0) {
          console.log(`[VoiceReceiver] 📦 Received ${packetCount} packets from user ${userId}`);
        }
      });

      const decoder = new prism.opus.Decoder({
        frameSize: 960,
        channels: 2,
        rate: 48000
      });

      decoder.on('error', (err) => {
        console.error(`[VoiceReceiver] Decoder error for user ${userId}:`, err);
      });

      const pcmStream = opusStream.pipe(decoder);

      mixer.addSource(userId, pcmStream);
      this.userStreams.set(userId, pcmStream);

      pcmStream.on('end', () => {
        console.log(`[VoiceReceiver] 🔇 User ${userId} stopped speaking (${packetCount} packets total)`);
        mixer.removeSource(userId);
        this.userStreams.delete(userId);
      });

      pcmStream.on('error', (err) => {
        console.error(`[VoiceReceiver] ❌ Stream error for user ${userId}:`, err);
        mixer.removeSource(userId);
        this.userStreams.delete(userId);
      });
    });

    console.log(`[VoiceReceiver] 👂 Now listening for ${broadcastUserIds.length} broadcast users`);
  }

  async stopReceiving(guildId) {
    console.log(`[VoiceReceiver] Stopping receiver for guild ${guildId}`);

    if (this.connection) {
      try {
        this.connection.destroy();
      } catch (err) {
        console.error('[VoiceReceiver] Error destroying connection:', err);
      }
    }

    this.cleanup();
  }

  cleanup() {
    console.log(`[VoiceReceiver] Cleaning up ${this.userStreams.size} user streams`);
    for (const stream of this.userStreams.values()) {
      try {
        stream.destroy();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    this.userStreams.clear();
    this.connection = null;
  }
}

module.exports = { VoiceReceiver };