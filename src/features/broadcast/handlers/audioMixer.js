const { Transform } = require('stream');

class AudioMixer extends Transform {
  constructor(options = {}) {
    super(options);
    this.sources = new Map();
    this.frameSize = 960 * 2 * 2; // 960 samples * 2 bytes per sample * 2 channels
    this.silenceBuffer = Buffer.alloc(this.frameSize);

    // Send initial silence frames IMMEDIATELY to establish the stream
    // This ensures all listeners connecting early get synchronized
    console.log('[AudioMixer] 🔇 Sending initial silence frames for stream synchronization');
    for (let i = 0; i < 10; i++) {
      this.push(this.silenceBuffer);
    }

    // ALWAYS send frames at 20ms intervals to maintain continuous stream
    // This ensures constant bitrate even when no one is speaking
    this.silenceInterval = setInterval(() => {
      this.mixAndPush();
    }, 20);

    this.mixCount = 0;
    console.log('[AudioMixer] ✅ Mixer initialized with continuous silence stream');
  }

  addSource(userId, stream) {
    console.log(`[AudioMixer] ➕ Adding source for user ${userId}`);

    const sourceData = {
      buffer: null,
      lastUpdate: Date.now()
    };

    this.sources.set(userId, sourceData);

    stream.on('data', (chunk) => {
      sourceData.buffer = chunk;
      sourceData.lastUpdate = Date.now();
      // Don't call mixAndPush here - let the interval handle it
    });

    stream.on('end', () => {
      console.log(`[AudioMixer] 🔚 Source ended for user ${userId}`);
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
    for (const [userId, data] of this.sources.entries()) {
      // Only use buffers that are recent (within 100ms)
      if (data.buffer && (now - data.lastUpdate) < 100) {
        activeBuffers.push(data.buffer);
      }
    }

    if (activeBuffers.length === 0) {
      // Push silence when no active audio - keeps stream alive and synchronized
      this.push(this.silenceBuffer);
      return;
    }

    // Log mixing activity periodically
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

    this.push(mixed);
  }

  _transform(chunk, encoding, callback) {
    // Just pass through - mixing happens on interval
    callback();
  }

  _destroy(err, callback) {
    if (this.silenceInterval) {
      clearInterval(this.silenceInterval);
    }
    console.log(`[AudioMixer] 🧹 Destroying mixer, had ${this.sources.size} sources`);
    this.sources.clear();
    callback(err);
  }
}

module.exports = { AudioMixer };