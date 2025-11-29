const express = require('express');
const { PassThrough } = require('stream');

class StreamServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.streams = new Map(); // guildId -> { stream, listeners }
  }

  start() {
    if (this.server) {
      console.log('[StreamServer] Already running');
      return;
    }

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        activeStreams: this.streams.size,
        streams: Array.from(this.streams.keys())
      });
    });

    // Stream endpoint - /stream/:guildId (DCA format for Discord bots)
    this.app.get('/stream/:guildId', (req, res) => {
      const { guildId } = req.params;

      const streamData = this.streams.get(guildId);
      if (!streamData) {
        console.log(`[StreamServer] ❌ No active stream for guild ${guildId}`);
        return res.status(404).json({ error: 'No active stream for this guild' });
      }

      console.log(`[StreamServer] 🎧 New listener connected for guild ${guildId}`);

      // Set headers for DCA/Opus streaming (compatible with Discord music bots)
      res.writeHead(200, {
        'Content-Type': 'audio/opus',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      });

      // Create a new passthrough for this listener
      const listenerStream = new PassThrough();
      streamData.stream.pipe(listenerStream);
      listenerStream.pipe(res);

      // Track listener
      const listenerId = Date.now() + Math.random();
      streamData.listeners.set(listenerId, listenerStream);

      console.log(`[StreamServer] 📊 Active listeners for guild ${guildId}: ${streamData.listeners.size}`);

      // Handle client disconnect
      req.on('close', () => {
        console.log(`[StreamServer] 👋 Listener disconnected from guild ${guildId}`);
        listenerStream.destroy();
        streamData.listeners.delete(listenerId);
        console.log(`[StreamServer] 📊 Remaining listeners for guild ${guildId}: ${streamData.listeners.size}`);
      });

      // Handle errors
      listenerStream.on('error', (err) => {
        console.error(`[StreamServer] ❌ Listener stream error:`, err);
        streamData.listeners.delete(listenerId);
      });
    });

    // Alternative endpoint - /stream/:guildId/pcm (Raw PCM for FFmpeg/VLC)
    this.app.get('/stream/:guildId/pcm', (req, res) => {
      const { guildId } = req.params;

      const streamData = this.streams.get(guildId);
      if (!streamData) {
        console.log(`[StreamServer] ❌ No active stream for guild ${guildId}`);
        return res.status(404).json({ error: 'No active stream for this guild' });
      }

      console.log(`[StreamServer] 🎧 New PCM listener connected for guild ${guildId}`);

      // Set headers for raw PCM audio
      res.writeHead(200, {
        'Content-Type': 'audio/pcm',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      });

      // Get the PCM stream directly from mixer (before encoding)
      const mixer = streamData.pcmMixer;
      if (!mixer) {
        return res.status(500).json({ error: 'PCM stream not available' });
      }

      const pcmListener = new PassThrough();
      mixer.pipe(pcmListener);
      pcmListener.pipe(res);

      const listenerId = Date.now() + Math.random();
      streamData.pcmListeners = streamData.pcmListeners || new Map();
      streamData.pcmListeners.set(listenerId, pcmListener);

      req.on('close', () => {
        console.log(`[StreamServer] 👋 PCM listener disconnected from guild ${guildId}`);
        pcmListener.destroy();
        streamData.pcmListeners.delete(listenerId);
      });

      pcmListener.on('error', (err) => {
        console.error(`[StreamServer] ❌ PCM listener error:`, err);
        streamData.pcmListeners.delete(listenerId);
      });
    });

    // Start server
    this.server = this.app.listen(this.port, () => {
      console.log(`[StreamServer] 🚀 HTTP audio server listening on port ${this.port}`);
      console.log(`[StreamServer] 🌐 Opus stream: http://your-server:${this.port}/stream/{guildId}`);
      console.log(`[StreamServer] 🌐 PCM stream: http://your-server:${this.port}/stream/{guildId}/pcm`);
    });

    this.server.on('error', (err) => {
      console.error('[StreamServer] ❌ Server error:', err);
    });
  }

  stop() {
    if (!this.server) return;

    console.log('[StreamServer] 🛑 Stopping server...');

    // Close all streams
    for (const [guildId, streamData] of this.streams) {
      this.removeStream(guildId);
    }

    this.server.close(() => {
      console.log('[StreamServer] ✅ Server stopped');
    });

    this.server = null;
  }

  createStream(guildId, pcmMixer = null) {
    if (this.streams.has(guildId)) {
      throw new Error('Stream already exists for this guild');
    }

    const stream = new PassThrough();
    const listeners = new Map();

    this.streams.set(guildId, { 
      stream, 
      listeners,
      pcmMixer,  // Store reference to PCM mixer for direct access
      pcmListeners: new Map()
    });

    console.log(`[StreamServer] 📡 Created stream for guild ${guildId}`);

    // Log when data flows through the stream
    let dataCount = 0;
    stream.on('data', (chunk) => {
      dataCount++;
      if (dataCount % 100 === 0) {
        console.log(`[StreamServer] 📤 Streaming data to guild ${guildId} (${dataCount} chunks sent, ${listeners.size} listeners)`);
      }
    });

    stream.on('error', (err) => {
      console.error(`[StreamServer] ❌ Stream error for guild ${guildId}:`, err);
    });

    return stream;
  }

  getStream(guildId) {
    const streamData = this.streams.get(guildId);
    return streamData ? streamData.stream : null;
  }

  removeStream(guildId) {
    const streamData = this.streams.get(guildId);
    if (!streamData) return;

    console.log(`[StreamServer] 🗑️ Removing stream for guild ${guildId}`);

    // Close all opus listeners
    for (const [id, listener] of streamData.listeners) {
      try {
        listener.destroy();
      } catch (err) {
        // Ignore
      }
    }

    // Close all PCM listeners
    if (streamData.pcmListeners) {
      for (const [id, listener] of streamData.pcmListeners) {
        try {
          listener.destroy();
        } catch (err) {
          // Ignore
        }
      }
    }

    // Destroy main stream
    try {
      streamData.stream.destroy();
    } catch (err) {
      // Ignore
    }

    this.streams.delete(guildId);
    console.log(`[StreamServer] ✅ Stream removed for guild ${guildId}`);
  }

  getStreamUrl(guildId, format = 'opus') {
    // Use environment variable or default
    const baseUrl = process.env.STREAM_BASE_URL || `http://localhost:${this.port}`;
    if (format === 'pcm') {
      return `${baseUrl}/stream/${guildId}/pcm`;
    }
    return `${baseUrl}/stream/${guildId}`;
  }

  hasStream(guildId) {
    return this.streams.has(guildId);
  }

  getActiveStreams() {
    return Array.from(this.streams.keys());
  }
}

// Singleton instance
const streamServer = new StreamServer(process.env.STREAM_PORT || 3000);

module.exports = { streamServer };