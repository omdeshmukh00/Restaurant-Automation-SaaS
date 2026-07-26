// src/lib/socket.ts
// Socket.IO client — connects to the backend for real-time events

import { io, Socket } from 'socket.io-client';
import { env } from './env';
import { getAccessToken, getPanelFromPath, type Panel } from '../auth/tokenStore';
import { getSessionToken } from '../shared/services/apiClient';

let socket: Socket | null = null;
const listenersMap = new Map<string, Set<(...args: any[]) => void>>();

/**
 * Connect or reconnect the Socket.IO client.
 * Attaches the current JWT and session token for authentication.
 */
export function connectSocket(forceReconnect = false): Socket {
  // If socket already exists and is either connected or connecting, do not re-create unless forced
  if (socket && !forceReconnect) {
    return socket;
  }

  if (socket && forceReconnect) {
    socket.disconnect();
    socket = null;
  }

  const panel = getPanelFromPath(window.location.pathname);
  const token = getAccessToken(panel);
  const sessionToken = getSessionToken();

  socket = io(env.socketUrl, {
    autoConnect: true,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: {
      token: token ?? undefined,
      sessionToken: sessionToken ?? undefined,
    },
  });

  // Re-attach all registered listeners
  listenersMap.forEach((handlers, event) => {
    handlers.forEach((handler) => {
      socket?.on(event, handler);
    });
  });

  socket.on('connect', () => {
    if (env.debug) {
      console.log('[Socket] Connected:', socket?.id);
    }
  });

  socket.on('disconnect', (reason) => {
    if (env.debug) {
      console.log('[Socket] Disconnected:', reason);
    }
  });

  socket.on('connect_error', (error) => {
    if (env.debug) {
      console.error('[Socket] Connection error:', error.message);
    }
  });

  return socket;
}

/**
 * Disconnect the Socket.IO client.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the current socket instance (may be null if not connected).
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Register a socket event listener safely.
 * The listener remains attached even if the socket reconnects or is initialized later.
 */
export function onSocketEvent(event: string, handler: (...args: any[]) => void): () => void {
  if (!listenersMap.has(event)) {
    listenersMap.set(event, new Set());
  }
  listenersMap.get(event)!.add(handler);

  if (socket) {
    socket.on(event, handler);
  }

  return () => {
    listenersMap.get(event)?.delete(handler);
    if (socket) {
      socket.off(event, handler);
    }
  };
}

