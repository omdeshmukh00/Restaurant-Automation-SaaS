import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { verifyAccessToken } from '../services/jwt.service';
import { validateSession } from '../modules/tableSessions/tableSessions.service';
import { socketService } from './socket.service';

import { initSessionEvents } from '../services/sessionEvents';

let io: Server | null = null;

export function createSocketServer(server: HttpServer): Server {
  if (io) {
    return io;
  }

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        if (env.isDevelopment) {
          const isLocalNetwork = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
          if (isLocalNetwork) {
            callback(null, true);
            return;
          }
        }
        callback(new Error('CORS origin denied'), false);
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const sessionToken = socket.handshake.auth?.sessionToken;

      if (token) {
        const decoded = verifyAccessToken(token);
        socket.data.user = decoded;
        return next();
      }

      if (sessionToken) {
        const session = await validateSession(sessionToken);
        socket.data.session = session;
        return next();
      }

      next(new Error('Authentication error'));
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('Socket client connected', { socketId: socket.id });

    const user = socket.data.user as
      | { _id?: string; restaurantId?: string; role?: string }
      | undefined;
    const session = socket.data.session as
      | { _id?: string; restaurantId?: string }
      | undefined;

    if (user?.restaurantId) {
      socket.join(`restaurant:${user.restaurantId}`);
    }
    if (user?._id) {
      socket.join(`user:${user._id}`);
    }
    if (user?.role) {
      socket.join(`role:${user.role}:${user.restaurantId ?? ''}`);
    }
    if (session?.restaurantId) {
      socket.join(`restaurant:${session.restaurantId}`);
    }
    if (session?._id) {
      socket.join(`session:${session._id}`);
    }

    socket.on('disconnect', (reason) => {
      logger.info('Socket client disconnected', { socketId: socket.id, reason });
    });
  });

  socketService.setIO(io);
  initSessionEvents(io);

  return io;
}
