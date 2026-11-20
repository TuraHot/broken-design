'use client';

import { io, type Socket } from 'socket.io-client';
import { CORE_API_URL } from './api';
import { readSession } from './session';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    return null as unknown as Socket;
  }

  const session = readSession();
  const token = session?.token ?? null;

  // If socket exists and token changed, reconnect with new credentials
  if (socket && token !== currentToken) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    currentToken = token;
    socket = io(CORE_API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    if (process.env.NODE_ENV !== 'production') {
      socket.on('connect', () => {
        console.log('[Socket.IO Client] Connected to server, id:', socket?.id);
      });

      socket.on('disconnect', (reason) => {
        console.log('[Socket.IO Client] Disconnected:', reason);
      });
    }
  }

  return socket;
}
