const { Transform } = require('stream');

class AudioMixer extends Transform {
  constructor(options = {}) {
    super(options);
    this.sources = new Map();
    this.frameSize = 960 * 2 * 2; // 960 samples * 2 bytes per sample * 2 channels (PCM)
    this.silenceBuffer = Buffer.alloc(this.frameSize);

    // Track if we've sent any data yet
    this.hasStarted = false;
    this.frameCount = 0;

    console.log('[AudioMixer] ✅ Mixer initialized - will send continuous frames');

    // CRITICAL: Send frames at EXACTLY 20ms intervals
    // Discord expects a constant stream of Opus packets
    this.silenceInterval = setInterval(() => {
      this.mixAndPush();
    }, 20); // 20ms = 50 frames per second

    this.mixCount = 0;
  }

  addSource(userId, stream) {
    console.log(`[AudioMixer] ➕ Adding source for user ${userId}`);

    const sourceData = {
      buffer: null,
      lastUpdate: Date.now(),
      packetsReceived: 0
    };

    this.sources.set(userId, sourceData);

    stream.on('data', (chunk) => {
      sourceData.buffer = chunk;
      sourceData.lastUpdate = Date.now();
      sourceData.packetsReceived++;

      // Log every 100 packets to confirm audio is flowing
      if (sourceData.packetsReceived % 100 === 0) {
        console.log(`[AudioMixer] 📦 User ${userId}: ${sourceData.packetsReceived} packets received`);
      }
    });

    stream.on('end', () => {
      console.log(`[AudioMixer] 🔚 Source ended for user ${userId} (${sourceData.packetsReceived} packets total)`);
      this.removeSource(userId);
    });

    stream.on('error', (err) => {
      console.error(`[AudioMixer] ❌ Source error for user ${userId}:`, err);
      this.removeSource(userId);
    });
  }

  removeSource(userId) {
    console.log(`[AudioMixer] ➖ Removing source for user ${userId}`);
    this.sources.delete(userId);
  }

  mixAndPush() {
    const activeBuffers = [];
    const now = Date.now();

    // Check for active sources with recent data
    for (const [userId, data] of this.sources.entries()) {
      // Use buffers that are recent (within 100ms)
      if (data.buffer && (now - data.lastUpdate) < 100) {
        activeBuffers.push(data.buffer);
      }
    }

    let outputBuffer;

    if (activeBuffers.length === 0) {
      // No active audio - send silence
      outputBuffer = this.silenceBuffer;
    } else {
      // Mix active audio sources
      this.mixCount++;
      if (this.mixCount % 100 === 0) {
        console.log(`[AudioMixer] 🎵 Mixing ${activeBuffers.length} active sources (${this.mixCount} frames mixed)`);
      }

      const bufferLength = activeBuffers[0].length;
      const mixed = Buffer.alloc(bufferLength);

      // Mix by averaging samples
      for (let i = 0; i < bufferLength; i += 2) {
        let sum = 0;
        let count = 0;

        for (const buffer of activeBuffers) {
          if (i + 1 < buffer.length) {
            const sample = buffer.readInt16LE(i);
            sum += sample;
            count++;
          }
        }

        if (count > 0) {
          const averaged = Math.floor(sum / count);
          const clamped = Math.max(-32768, Math.min(32767, averaged));
          mixed.writeInt16LE(clamped, i);
        }
      }

      outputBuffer = mixed;
    }

    // CRITICAL: Always push exactly one frame every 20ms
    // This maintains the stream continuity
    this.frameCount++;

    // Log every 500 frames (10 seconds) to show stream is alive
    if (this.frameCount % 500 === 0) {
      console.log(`[AudioMixer] 📊 Stream alive: ${this.frameCount} frames sent (${activeBuffers.length} active sources)`);
    }

    // Push the frame
    this.push(outputBuffer);
  }

  _transform(chunk, encoding, callback) {
    // Just pass through - mixing happens on interval
    callback();
  }

  _destroy(err, callback) {
    if (this.silenceInterval) {
      clearInterval(this.silenceInterval);
    }
    console.log(`[AudioMixer] 🧹 Destroying mixer, sent ${this.frameCount} total frames, had ${this.sources.size} sources`);
    this.sources.clear();
    callback(err);
  }
}

module.exports = { AudioMixer };