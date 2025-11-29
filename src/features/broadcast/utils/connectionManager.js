/**
 * Manages voice connection states and reconnection logic
 */

const { VoiceConnectionStatus } = require('@discordjs/voice');

class ConnectionManager {
  constructor() {
    this.reconnectAttempts = new Map(); // connectionId -> attempt count
    this.maxReconnectAttempts = 5;
  }

  /**
   * Set up auto-reconnect for a voice connection
   */
  setupAutoReconnect(connection, channelId, onReconnectFailed) {
    const connectionId = `${connection.joinConfig.guildId}-${channelId}`;

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.warn(`Voice connection disconnected: ${channelId}`);

      const attempts = this.reconnectAttempts.get(connectionId) || 0;

      if (attempts >= this.maxReconnectAttempts) {
        console.error(`Max reconnect attempts reached for ${channelId}`);
        this.reconnectAttempts.delete(connectionId);
        if (onReconnectFailed) {
          onReconnectFailed(channelId);
        }
        return;
      }

      this.reconnectAttempts.set(connectionId, attempts + 1);

      try {
        await Promise.race([
          new Promise((resolve) => {
            connection.once(VoiceConnectionStatus.Signalling, resolve);
            connection.once(VoiceConnectionStatus.Connecting, resolve);
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Reconnect timeout')), 5000)
          )
        ]);

        // Reconnected successfully
        this.reconnectAttempts.set(connectionId, 0);
        console.log(`Successfully reconnected to ${channelId}`);

      } catch (error) {
        console.error(`Failed to reconnect to ${channelId}:`, error);
        connection.destroy();
        this.reconnectAttempts.delete(connectionId);

        if (onReconnectFailed) {
          onReconnectFailed(channelId);
        }
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.reconnectAttempts.delete(connectionId);
    });
  }

  /**
   * Clear reconnect attempts for a connection
   */
  clearReconnectAttempts(guildId, channelId) {
    const connectionId = `${guildId}-${channelId}`;
    this.reconnectAttempts.delete(connectionId);
  }
}

const connectionManager = new ConnectionManager();

module.exports = { connectionManager };