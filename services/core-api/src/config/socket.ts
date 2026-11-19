import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { allowedOrigins } from './cors';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins(),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authenticate socket on connection if token provided
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, ''));

    if (token && typeof token === 'string') {
      try {
        const decoded = jwt.verify(token, env.jwtSecret) as { id: string; role?: string };
        (socket as any).userId = decoded.id;
      } catch {
        // Allow unauthenticated connection for public model live stats
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId as string | undefined;

    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[Socket.IO] User connected: ${userId} (socket ${socket.id})`);
    } else {
      console.log(`[Socket.IO] Guest connected (socket ${socket.id})`);
    }

    // Client can join a specific model room to listen for live updates
    socket.on('join:model', (modelId: string) => {
      if (typeof modelId === 'string' && modelId.trim()) {
        socket.join(`model:${modelId.trim()}`);
      }
    });

    socket.on('leave:model', (modelId: string) => {
      if (typeof modelId === 'string' && modelId.trim()) {
        socket.leave(`model:${modelId.trim()}`);
      }
    });

    socket.on('disconnect', () => {
      if (userId) {
        console.log(`[Socket.IO] User disconnected: ${userId}`);
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast live like count update to all clients viewing the model or in general
 */
export function notifyModelLike(modelId: string, likeCount: number) {
  if (!io) return;
  // Broadcast to everyone so all tabs and gallery/model pages receive the live count update
  io.emit('model:like_updated', { modelId, likeCount });
}

/**
 * Send real-time notification to a specific user (e.g. model owner)
 */
export function notifyUser(
  userId: string,
  payload: {
    type: string;
    title: string;
    message: string;
    modelId?: string;
    data?: Record<string, unknown>;
  },
) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification', {
    ...payload,
    createdAt: new Date().toISOString(),
  });
}
