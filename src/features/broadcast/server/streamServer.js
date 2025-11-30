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

    // Stream readiness check endpoint
    this.app.get('/ready/:guildId', (req, res) => {
      const { guildId } = req.params;
      const streamData = this.streams.get(guildId);

      res.json({
        ready: !!streamData,
        hasOpusListeners: streamData ? streamData.opusListeners.size : 0,
        hasPcmListeners: streamData ? streamData.pcmListeners.size : 0
      });
    });

    // CRITICAL FIX: Properly handle multiple concurrent listeners
    this.app.get('/stream/:guildId', (req, res) => {
      const { guildId } = req.params;

      const streamData = this.streams.get(guildId);
      if (!streamData) {
        console.log(`[StreamServer] ❌ No stream for guild ${guildId}`);
        return res.status(404).json({ error: 'No active stream' });
      }

      console.log(`[StreamServer] 🎧 New Opus listener connecting for guild ${guildId}`);

      // Write headers immediately
      res.writeHead(200, {
        'Content-Type': 'audio/opus',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      res.flushHeaders();

      // CRITICAL: Create independent passthrough for THIS listener
      // Each listener gets their own stream copy
      const listenerStream = new PassThrough({
        highWaterMark: 16384
      });

      const listenerId = Date.now() + '-' + Math.random();
      streamData.opusListeners = streamData.opusListeners || new Map();
      streamData.opusListeners.set(listenerId, listenerStream);

      console.log(`[StreamServer] 📊 Active Opus listeners for guild ${guildId}: ${streamData.opusListeners.size}`);

      // CRITICAL FIX: Don't pipe the main stream directly!
      // Instead, listen to data events and write to each listener independently
      // This prevents one listener's issues from affecting others

      let isActive = true;

      const dataHandler = (chunk) => {
        if (!isActive || listenerStream.destroyed || res.destroyed) {
          return;
        }

        // Write to this specific listener's stream
        try {
          if (!listenerStream.write(chunk)) {
            // Backpressure - pause briefly
            // But DON'T stop the main stream
          }
        } catch (err) {
          console.error(`[StreamServer] ❌ Write error for listener ${listenerId}:`, err.message);
          cleanup();
        }
      };

      // Listen to the main opus stream
      streamData.opusStream.on('data', dataHandler);

      // Pipe listener stream to response
      listenerStream.pipe(res);

      const cleanup = () => {
        if (!isActive) return;
        isActive = false;

        console.log(`[StreamServer] 👋 Opus listener ${listenerId} disconnecting from guild ${guildId}`);

        // Remove data handler from main stream
        streamData.opusStream.removeListener('data', dataHandler);

        // Destroy listener stream
        if (!listenerStream.destroyed) {
          listenerStream.destroy();
        }

        // Remove from active listeners
        streamData.opusListeners.delete(listenerId);

        console.log(`[StreamServer] 📊 Remaining Opus listeners for guild ${guildId}: ${streamData.opusListeners.size}`);
      };

      // Handle client disconnect
      req.on('close', cleanup);
      req.on('error', (err) => {
        console.error(`[StreamServer] ❌ Request error:`, err.message);
        cleanup();
      });

      listenerStream.on('error', (err) => {
        console.error(`[StreamServer] ❌ Listener stream error:`, err.message);
        cleanup();
      });

      res.on('error', (err) => {
        console.error(`[StreamServer] ❌ Response error:`, err.message);
        cleanup();
      });

      res.on('close', cleanup);
    });

    // PCM endpoint (same fix)
    this.app.get('/stream/:guildId/pcm', (req, res) => {
      const { guildId } = req.params;

      const streamData = this.streams.get(guildId);
      if (!streamData || !streamData.pcmBroadcast) {
        return res.status(404).json({ error: 'No active PCM stream' });
      }

      console.log(`[StreamServer] 🎧 New PCM listener for guild ${guildId}`);

      res.writeHead(200, {
        'Content-Type': 'audio/pcm',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Audio-Channels': '2',
        'X-Audio-Sample-Rate': '48000',
        'X-Audio-Format': 's16le',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      res.flushHeaders();

      const pcmListener = new PassThrough({
        highWaterMark: 16384
      });

      const listenerId = Date.now() + '-' + Math.random();
      streamData.pcmListeners = streamData.pcmListeners || new Map();
      streamData.pcmListeners.set(listenerId, pcmListener);

      console.log(`[StreamServer] 📊 Active PCM listeners for guild ${guildId}: ${streamData.pcmListeners.size}`);

      let isActive = true;

      const dataHandler = (chunk) => {
        if (!isActive || pcmListener.destroyed || res.destroyed) {
          return;
        }

        try {
          pcmListener.write(chunk);
        } catch (err) {
          console.error(`[StreamServer] ❌ PCM write error:`, err.message);
          cleanup();
        }
      };

      streamData.pcmBroadcast.on('data', dataHandler);
      pcmListener.pipe(res);

      const cleanup = () => {
        if (!isActive) return;
        isActive = false;

        console.log(`[StreamServer] 👋 PCM listener disconnected from guild ${guildId}`);
        streamData.pcmBroadcast.removeListener('data', dataHandler);

        if (!pcmListener.destroyed) {
          pcmListener.destroy();
        }

        streamData.pcmListeners.delete(listenerId);
        console.log(`[StreamServer] 📊 Remaining PCM listeners for guild ${guildId}: ${streamData.pcmListeners.size}`);
      };

      req.on('close', cleanup);
      req.on('error', cleanup);
      pcmListener.on('error', cleanup);
      res.on('error', cleanup);
      res.on('close', cleanup);
    });

    // Start server
    this.server = this.app.listen(this.port, () => {
      console.log(`[StreamServer] 🚀 Server listening on port ${this.port}`);
      console.log(`[StreamServer] 🌐 Opus: http://your-server:${this.port}/stream/{guildId}`);
      console.log(`[StreamServer] 🌐 PCM: http://your-server:${this.port}/stream/{guildId}/pcm`);
    });

    this.server.on('error', (err) => {
      console.error('[StreamServer] ❌ Server error:', err);
    });

    // Disable timeouts for streaming
    this.server.timeout = 0;
    this.server.keepAliveTimeout = 0;
    this.server.headersTimeout = 0;
  }

  stop() {
    if (!this.server) return;

    console.log('[StreamServer] 🛑 Stopping...');

    for (const [guildId, streamData] of this.streams) {
      this.removeStream(guildId);
    }

    this.server.close(() => {
      console.log('[StreamServer] ✅ Stopped');
    });

    this.server = null;
  }

  createStream(guildId) {
    if (this.streams.has(guildId)) {
      throw new Error('Stream already exists for this guild');
    }

    // Create main opus stream
    const opusStream = new PassThrough({
      highWaterMark: 16384
    });

    // Create main PCM stream
    const pcmBroadcast = new PassThrough({
      highWaterMark: 16384
    });

    const streamData = {
      opusStream,
      pcmBroadcast,
      opusListeners: new Map(),
      pcmListeners: new Map(),
      createdAt: Date.now()
    };

    this.streams.set(guildId, streamData);

    console.log(`[StreamServer] 📡 Created streams for guild ${guildId}`);

    // Log data flow
    let opusDataCount = 0;
    opusStream.on('data', (chunk) => {
      opusDataCount++;
      if (opusDataCount % 100 === 0) {
        console.log(`[StreamServer] 📤 Opus streaming (${opusDataCount} chunks, ${streamData.opusListeners.size} listeners)`);
      }
    });

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