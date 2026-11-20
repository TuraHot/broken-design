
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

/**
 * Checks the JWT and that the account has not been deleted by an admin. A JWT stays valid for a day, so the token alone
 * cannot prove the account still exists: one indexed lookup asks the database every time (AGENT.md §3.2). A database
 * error is an error, never a pass. A deleted account gets 401 ACCOUNT_DELETED.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
  }

  let user: AuthUser;
  try {
    user = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser;
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired JWT token');
  }

  const result = await db.query(`SELECT deleted_at FROM users WHERE id = $1`, [user.id]);
  if (result.rows[0]?.deleted_at) {
    throw new AppError(401, 'ACCOUNT_DELETED', 'This account has been deleted');
  }
  req.user = user;
  next();
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

/**
 * Use AFTER requireAuth on routes that BUY: checkout, payment, QR. The person must be allowed to act (not
 * suspended) and must not be an admin: admins moderate the platform and never buy (PRD). Like requireNotSuspended
 * it asks the database every time, so a token that says "user" cannot hide an admin account, and it never lets a
 * request through when the database fails.
 */
export async function requireBuyer(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const result = await db.query(`SELECT suspended_at, role FROM users WHERE id = $1`, [req.user.id]);
  const row = result.rows[0];
  if (!row) {
    throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
  }
  if (row.suspended_at) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
  }
  if (row.role === 'admin') {
    throw new AppError(403, 'ADMIN_CANNOT_BUY', 'Admin accounts cannot buy models');
  }
  next();
}
