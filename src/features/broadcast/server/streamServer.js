const express = require('express');
const { PassThrough } = require('stream');

class StreamServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.streams = new Map(); // guildId -> { opusStream, pcmBroadcast, listeners }
  }

  start() {
    if (this.server) {
      console.log('[StreamServer] Already running');
      return;
    }

    // Disable express's default buffering
    this.app.disable('etag');
    this.app.disable('x-powered-by');

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        activeStreams: this.streams.size,
        streams: Array.from(this.streams.keys())
      });
    });

    // Stream endpoint - /stream/:guildId (Opus format for Discord bots)
    this.app.get('/stream/:guildId', (req, res) => {
      const { guildId } = req.params;

      const streamData = this.streams.get(guildId);
      if (!streamData) {
        console.log(`[StreamServer] ❌ No active stream for guild ${guildId}`);
        return res.status(404).json({ error: 'No active stream for this guild' });
      }

      console.log(`[StreamServer] 🎧 New Opus listener connected for guild ${guildId}`);

      // Write headers immediately and flush
      res.writeHead(200, {
        'Content-Type': 'audio/opus',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering if behind proxy
      });

      // Force flush headers
      res.flushHeaders();

      // Create a new passthrough with MINIMAL buffering for low latency
      const listenerStream = new PassThrough({
        highWaterMark: 512 // 16KB buffer
      });

      // Track listener
      const listenerId = Date.now() + Math.random();
      streamData.opusListeners = streamData.opusListeners || new Map();
      streamData.opusListeners.set(listenerId, listenerStream);

      console.log(`[StreamServer] 📊 Active Opus listeners for guild ${guildId}: ${streamData.opusListeners.size}`);

      // CRITICAL FIX: Don't pipe old data, only new data from this point forward
      // We track when this listener connected and only send data after that
      let shouldStream = false;

      const dataHandler = (chunk) => {
        if (!shouldStream) {
          shouldStream = true; // Start streaming from first new chunk
        }
        listenerStream.write(chunk);
      };

      streamData.opusStream.on('data', dataHandler);
      listenerStream.pipe(res);

      // Handle client disconnect
      req.on('close', () => {
        console.log(`[StreamServer] 👋 Opus listener disconnected from guild ${guildId}`);
        streamData.opusStream.removeListener('data', dataHandler);
        listenerStream.destroy();
        streamData.opusListeners.delete(listenerId);
        console.log(`[StreamServer] 📊 Remaining Opus listeners for guild ${guildId}: ${streamData.opusListeners.size}`);
      });

      // Handle errors
      listenerStream.on('error', (err) => {
        console.error(`[StreamServer] ❌ Opus listener error:`, err);
        streamData.opusStream.removeListener('data', dataHandler);
        streamData.opusListeners.delete(listenerId);
      });

      res.on('error', (err) => {
        console.error(`[StreamServer] ❌ Response error:`, err);
        streamData.opusStream.removeListener('data', dataHandler);
        listenerStream.destroy();
        streamData.opusListeners.delete(listenerId);
      });
    });

    // PCM endpoint - /stream/:guildId/pcm (Raw PCM for VLC/FFmpeg)
    this.app.get('/stream/:guildId/pcm', (req, res) => {
      const { guildId } = req.params;

      const streamData = this.streams.get(guildId);
      if (!streamData || !streamData.pcmBroadcast) {
        console.log(`[StreamServer] ❌ No active PCM stream for guild ${guildId}`);
        return res.status(404).json({ error: 'No active stream for this guild' });
      }

      console.log(`[StreamServer] 🎧 New PCM listener connected for guild ${guildId}`);

      // Write headers immediately and flush
      res.writeHead(200, {
        'Content-Type': 'audio/pcm',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'X-Audio-Channels': '2',
        'X-Audio-Sample-Rate': '48000',
        'X-Audio-Format': 's16le',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering if behind proxy
      });

      // Force flush headers immediately
      res.flushHeaders();

      // Create a new listener stream with MINIMAL buffering for low latency
      const pcmListener = new PassThrough({
        highWaterMark: 512 // 16KB buffer
      });

      const listenerId = Date.now() + Math.random();
      streamData.pcmListeners = streamData.pcmListeners || new Map();
      streamData.pcmListeners.set(listenerId, pcmListener);

      console.log(`[StreamServer] 📊 Active PCM listeners for guild ${guildId}: ${streamData.pcmListeners.size}`);

      // CRITICAL FIX: Don't pipe old data, only new data from this point forward
      let shouldStream = false;

      const dataHandler = (chunk) => {
        if (!shouldStream) {
          shouldStream = true; // Start streaming from first new chunk
        }
        pcmListener.write(chunk);
      };

      streamData.pcmBroadcast.on('data', dataHandler);
      pcmListener.pipe(res);

      req.on('close', () => {
        console.log(`[StreamServer] 👋 PCM listener disconnected from guild ${guildId}`);
        streamData.pcmBroadcast.removeListener('data', dataHandler);
        pcmListener.destroy();
        streamData.pcmListeners.delete(listenerId);
        console.log(`[StreamServer] 📊 Remaining PCM listeners for guild ${guildId}: ${streamData.pcmListeners.size}`);
      });

      pcmListener.on('error', (err) => {
        console.error(`[StreamServer] ❌ PCM listener error:`, err);
        streamData.pcmBroadcast.removeListener('data', dataHandler);
        streamData.pcmListeners.delete(listenerId);
      });

      res.on('error', (err) => {
        console.error(`[StreamServer] ❌ Response error:`, err);
        streamData.pcmBroadcast.removeListener('data', dataHandler);
        pcmListener.destroy();
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

    // Set timeouts
    this.server.timeout = 0; // Disable timeout for streaming
    this.server.keepAliveTimeout = 0;
    this.server.headersTimeout = 0;
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

  createStream(guildId) {
    if (this.streams.has(guildId)) {
      throw new Error('Stream already exists for this guild');
    }

    // Create the Opus stream with MINIMAL buffering
    const opusStream = new PassThrough({
      highWaterMark: 512 // 16KB buffer
    });

    // Create PCM broadcast stream with MINIMAL buffering
    const pcmBroadcast = new PassThrough({
      highWaterMark: 512 // 16KB buffer
    });

    const streamData = {
      opusStream,
      pcmBroadcast,
      opusListeners: new Map(),
      pcmListeners: new Map()
    };

    this.streams.set(guildId, streamData);

    console.log(`[StreamServer] 📡 Created LOW-LATENCY streams for guild ${guildId}`);

    // Log when data flows through the Opus stream
    let opusDataCount = 0;
    opusStream.on('data', (chunk) => {
      opusDataCount++;
      if (opusDataCount % 100 === 0) {
        console.log(`[StreamServer] 📤 Opus streaming (${opusDataCount} chunks, ${streamData.opusListeners.size} listeners)`);
      }
    });

    // Log when data flows through the PCM stream
    let pcmDataCount = 0;
    pcmBroadcast.on('data', (chunk) => {
      pcmDataCount++;
      if (pcmDataCount % 100 === 0) {
        console.log(`[StreamServer] 📤 PCM streaming (${pcmDataCount} chunks, ${streamData.pcmListeners.size} listeners)`);
      }
    });

    opusStream.on('error', (err) => {
      console.error(`[StreamServer] ❌ Opus stream error for guild ${guildId}:`, err);
    });

    pcmBroadcast.on('error', (err) => {
      console.error(`[StreamServer] ❌ PCM stream error for guild ${guildId}:`, err);
    });

    return { opusStream, pcmBroadcast };
  }

  getStream(guildId) {
    const streamData = this.streams.get(guildId);
    return streamData ? streamData.opusStream : null;
  }

  getPcmStream(guildId) {
    const streamData = this.streams.get(guildId);
    return streamData ? streamData.pcmBroadcast : null;
  }

  removeStream(guildId) {
    const streamData = this.streams.get(guildId);
    if (!streamData) return;

    console.log(`[StreamServer] 🗑️ Removing streams for guild ${guildId}`);

    // Close all opus listeners
    if (streamData.opusListeners) {
      for (const [id, listener] of streamData.opusListeners) {
        try {
          listener.destroy();
        } catch (err) {
          // Ignore
        }
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

    // Destroy main streams
    try {
      streamData.opusStream.destroy();
    } catch (err) {
      // Ignore
    }

    try {
      streamData.pcmBroadcast.destroy();
    } catch (err) {
      // Ignore
    }

    this.streams.delete(guildId);
    console.log(`[StreamServer] ✅ Streams removed for guild ${guildId}`);
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