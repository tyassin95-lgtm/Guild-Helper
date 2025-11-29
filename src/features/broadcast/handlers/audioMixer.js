/**
 * Audio mixer - combines multiple PCM audio streams into one
 */

const { Transform } = require('stream');

class AudioMixer extends Transform {
  constructor(options = {}) {
    super(options);
    this.sources = new Map();
    this.frameSize = 960 * 2 * 2;
    this.silenceBuffer = Buffer.alloc(this.frameSize);

    this.silenceInterval = setInterval(() => {
      if (this.sources.size === 0) {
        this.push(this.silenceBuffer);
      }
    }, 20);
  }

  addSource(userId, stream) {
    console.log(`[AudioMixer] Adding source for user ${userId}`);

    const sourceData = {
      buffer: null,
      lastUpdate: Date.now()
    };

    this.sources.set(userId, sourceData);

    stream.on('data', (chunk) => {
      sourceData.buffer = chunk;
      sourceData.lastUpdate = Date.now();
      this.mixAndPush();
    });

    stream.on('end', () => {
      console.log(`[AudioMixer] Source ended for user ${userId}`);
      this.removeSource(userId);
    });

    stream.on('error', (err) => {
      console.error(`[AudioMixer] Source error for user ${userId}:`, err);
      this.removeSource(userId);
    });
  }

  removeSource(userId) {
    console.log(`[AudioMixer] Removing source for user ${userId}`);
    this.sources.delete(userId);
  }

  mixAndPush() {
    const activeBuffers = [];

    const now = Date.now();
    for (const [userId, data] of this.sources.entries()) {
      if (data.buffer && (now - data.lastUpdate) < 100) {
        activeBuffers.push(data.buffer);
      }
    }

    if (activeBuffers.length === 0) {
      this.push(this.silenceBuffer);
      return;
    }

    const bufferLength = activeBuffers[0].length;
    const mixed = Buffer.alloc(bufferLength);

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
    callback();
  }

  _destroy(err, callback) {
    if (this.silenceInterval) {
      clearInterval(this.silenceInterval);
    }
    this.sources.clear();
    callback(err);
  }
}

module.exports = { AudioMixer };