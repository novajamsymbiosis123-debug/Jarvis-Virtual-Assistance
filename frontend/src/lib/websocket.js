/**
 * WebSocket client for real-time AI chat streaming.
 * Handles connection, reconnection, and message dispatch.
 */

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
    : "ws://localhost:8000");

export class JarvisWebSocket {
  constructor({ onToken, onDone, onError, onOpen, onClose }) {
    this.onToken = onToken;
    this.onDone = onDone;
    this.onError = onError;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnect = 5;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(`${WS_BASE}/api/chat/ws`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "token":
            this.onToken?.(msg.data);
            break;
          case "done":
            this.onDone?.(msg.data);
            break;
          case "start":
            // conversation started, data = conversation_id
            break;
          case "error":
            this.onError?.(msg.data);
            break;
        }
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    this.ws.onclose = () => {
      this.onClose?.();
      this._tryReconnect();
    };

    this.ws.onerror = () => {
      this.onError?.("Connection error");
    };
  }

  send(token, message, conversationId = null) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.onError?.("Not connected");
      return;
    }
    this.ws.send(
      JSON.stringify({
        token,
        message,
        conversation_id: conversationId,
      })
    );
  }

  disconnect() {
    this.maxReconnect = 0; // prevent reconnect
    this.ws?.close();
  }

  _tryReconnect() {
    if (this.reconnectAttempts >= this.maxReconnect) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000);
    setTimeout(() => this.connect(), delay);
  }
}
