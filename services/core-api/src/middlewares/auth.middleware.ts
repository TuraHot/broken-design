
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { env } from '../config/env';
import { AppError } from './error.middleware';

type UserRole = 'user' | 'creator' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'creator' | 'admin';
  is_seller?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, env.jwtSecret) as AuthUser;
    next();
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired JWT token');
  }
}

export function requireSeller(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const isSeller = Boolean(req.user.is_seller || req.user.role === 'creator' || req.user.role === 'admin');
  if (!isSeller) {
    throw new AppError(403, 'FORBIDDEN', 'Seller access required. Please enable seller mode first.');
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  if (req.user.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
  next();
}

/**
 * Use AFTER requireAuth on routes that buy, pay or change something. A JWT stays valid for a day, so a token
 * alone does not prove the account is still allowed to act: the database is asked every time (AGENT.md §3.1).
 * A database error is an error, never a pass. Do NOT put this on the notice inbox (/api/me/notifications): a
 * suspended person must still be able to read why.
 */
export async function requireNotSuspended(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const result = await db.query(`SELECT suspended_at FROM users WHERE id = $1`, [req.user.id]);
  const row = result.rows[0];
  if (!row) {
    throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
  }
  if (row.suspended_at) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
  }
  next();
}
