import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { allowedOrigins } from './cors';
import { db } from './db';
import { verifyJwtToken } from '../middlewares/auth.middleware';

let io: SocketIOServer | null = null;

/**
 * The user id a handshake token stands for, or undefined (guest). A token outlives the account, so the user must still
 * exist and not be deleted; an invalid token or a database error is a guest, never a user.
 */
export async function resolveSocketUserId(token: unknown): Promise<string | undefined> {
  if (!token || typeof token !== 'string') return undefined;
  try {
    const decoded = verifyJwtToken(token);
    const row = await db.query(`SELECT deleted_at FROM users WHERE id = $1`, [decoded.id]);
    return row.rows.length > 0 && !row.rows[0].deleted_at ? decoded.id : undefined;
  } catch {
    return undefined;
  }
}

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins(),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authenticate socket on connection if token provided
  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, ''));

    const userId = await resolveSocketUserId(token);
    if (userId) (socket as any).userId = userId; // otherwise a guest: public model live stats only
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

    socket.on('disconnect', () => {
      if (userId) {
        console.log(`[Socket.IO] User disconnected: ${userId}`);
      }
    });
  });

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

/** Close every open socket of a user (their account was deleted); a new connection is a guest (see the handshake check). */
export function disconnectUser(userId: string) {
  if (!io) return;
  io.in(`user:${userId}`).disconnectSockets(true);
}
