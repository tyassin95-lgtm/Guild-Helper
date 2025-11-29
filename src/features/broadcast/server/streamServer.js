/**
 * HTTP Audio Stream Server
 * Provides audio stream that music bots can connect to
 */

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
      res.json({ status: 'ok', activeStreams: this.streams.size });
    });

    // Stream endpoint - /stream/:guildId
    this.app.get('/stream/:guildId', (req, res) => {
      const { guildId } = req.params;

      const streamData = this.streams.get(guildId);
      if (!streamData) {
        return res.status(404).json({ error: 'No active stream for this guild' });
      }

      console.log(`[StreamServer] New listener for guild ${guildId}`);

      // Set headers for audio streaming
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

      // Handle client disconnect
      req.on('close', () => {
        console.log(`[StreamServer] Listener disconnected for guild ${guildId}`);
        listenerStream.destroy();
        streamData.listeners.delete(listenerId);
      });

      // Handle errors
      listenerStream.on('error', (err) => {
        console.error(`[StreamServer] Listener stream error:`, err);
        streamData.listeners.delete(listenerId);
      });
    });

    // Start server
    this.server = this.app.listen(this.port, () => {
      console.log(`[StreamServer] HTTP audio server listening on port ${this.port}`);
    });
  }

  stop() {
    if (!this.server) return;

    console.log('[StreamServer] Stopping server...');

    // Close all streams
    for (const [guildId, streamData] of this.streams) {
      this.removeStream(guildId);
    }

    this.server.close(() => {
      console.log('[StreamServer] Server stopped');
    });

    this.server = null;
  }

  createStream(guildId) {
    if (this.streams.has(guildId)) {
      throw new Error('Stream already exists for this guild');
    }

    const stream = new PassThrough();
    const listeners = new Map();

    this.streams.set(guildId, { stream, listeners });

    console.log(`[StreamServer] Created stream for guild ${guildId}`);
    return stream;
  }

  getStream(guildId) {
    const streamData = this.streams.get(guildId);
    return streamData ? streamData.stream : null;
  }

  removeStream(guildId) {
    const streamData = this.streams.get(guildId);
    if (!streamData) return;

    console.log(`[StreamServer] Removing stream for guild ${guildId}`);

    // Close all listeners
    for (const [id, listener] of streamData.listeners) {
      listener.destroy();
    }

    // Destroy main stream
    streamData.stream.destroy();

    this.streams.delete(guildId);
  }

  getStreamUrl(guildId) {
    // Use environment variable or default
    const baseUrl = process.env.STREAM_BASE_URL || `http://localhost:${this.port}`;
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