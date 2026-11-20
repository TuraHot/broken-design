
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { env } from '../config/env';
import { AppError } from './error.middleware';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'creator' | 'admin';
  is_seller?: boolean;
}

/**
 * Whether an account is suspended right now. A timed suspension whose end has passed no longer counts, even though
 * `suspended_at` stays set until the sweeper or the next login clears it (login does the same check).
 */
export function isSuspended(row: { suspended_at?: unknown; suspended_until?: Date | string | null }): boolean {
  if (!row.suspended_at) return false;
  return !(row.suspended_until && new Date(row.suspended_until).getTime() <= Date.now());
}

const VALID_ROLES = new Set(['user', 'creator', 'admin']);

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function verifyJwtToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Malformed JWT payload');
  }
  const { id, email, role, is_seller } = decoded as Record<string, unknown>;
  if (
    typeof id !== 'string' ||
    id.trim() === '' ||
    typeof email !== 'string' ||
    typeof role !== 'string' ||
    !VALID_ROLES.has(role)
  ) {
    throw new Error('Invalid JWT claims');
  }
  return {
    id,
    email,
    role: role as AuthUser['role'],
    ...(typeof is_seller === 'boolean' ? { is_seller } : {}),
  };
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
    user = verifyJwtToken(header.slice(7));
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

/**
 * Use AFTER requireAuth on seller routes. Always verifies is_seller, role <> 'admin', and suspended_at (unless a timed suspension has ended) from the DB.
 */
export async function requireActiveSeller(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const result = await db.query<{ is_seller: boolean; role: string; suspended_at: Date | string | null; suspended_until: Date | string | null }>(
    `SELECT is_seller, role, suspended_at, suspended_until FROM users WHERE id = $1`,
    [req.user.id],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
  }
  if (isSuspended(row)) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
  }
  if (row.role === 'admin') {
    throw new AppError(403, 'ADMIN_CANNOT_SELL', 'Admin accounts cannot act as sellers');
  }
  if (!row.is_seller) {
    throw new AppError(403, 'NOT_SELLER', 'You must be an approved creator to access seller tools');
  }
  next();
}

/**
 * Use AFTER requireAuth on admin routes. Always verifies role === 'admin' and suspended_at IS NULL from the DB.
 */
export async function requireActiveAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const result = await db.query<{ role: string; suspended_at: Date | string | null; suspended_until: Date | string | null }>(
    `SELECT role, suspended_at, suspended_until FROM users WHERE id = $1`,
    [req.user.id],
  );
  const row = result.rows[0];
  if (!row || row.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin access required');
  }
  if (isSuspended(row)) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
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
  const result = await db.query(`SELECT suspended_at, suspended_until FROM users WHERE id = $1`, [req.user.id]);
  const row = result.rows[0];
  if (!row) {
    throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
  }
  if (isSuspended(row)) {
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
  const result = await db.query(`SELECT suspended_at, suspended_until, role FROM users WHERE id = $1`, [req.user.id]);
  const row = result.rows[0];
  if (!row) {
    throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
  }
  if (isSuspended(row)) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
  }
  if (row.role === 'admin') {
    throw new AppError(403, 'ADMIN_CANNOT_BUY', 'Admin accounts cannot buy models');
  }
  next();
}
