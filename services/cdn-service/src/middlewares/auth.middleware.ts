import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { AppError } from './error.middleware';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'creator' | 'admin';
  is_seller?: boolean;
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

interface DbUserStatus {
  id: string;
  role: 'user' | 'creator' | 'admin';
  is_seller: boolean;
  suspended_at: Date | string | null;
}

/** Look up live user permissions from PostgreSQL (with Supabase REST fallback). Never fails open. */
async function loadUserStatus(userId: string): Promise<DbUserStatus | null> {
  try {
    const res = await db.query<DbUserStatus>(
      `SELECT id, role, is_seller, suspended_at FROM users WHERE id = $1`,
      [userId],
    );
    return res.rows[0] ?? null;
  } catch (err) {
    if (!supabase) throw err;
    const { data, error } = await supabase
      .from('users')
      .select('id, role, is_seller, suspended_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw err;
    return (data as DbUserStatus | null) ?? null;
  }
}

/** True when an admin has deleted this account (core-api keeps the row and sets deleted_at). A database error is thrown, never a pass. */
export async function isAccountDeleted(userId: string): Promise<boolean> {
  const result = await db.query(`SELECT deleted_at FROM users WHERE id = $1`, [userId]);
  return Boolean(result.rows[0]?.deleted_at);
}

/** Checks the JWT and that the account has not been deleted (a token lives a day, so the database is asked every time). */
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
  if (await isAccountDeleted(user.id)) {
    throw new AppError(401, 'ACCOUNT_DELETED', 'This account has been deleted');
  }
  req.user = user;
  next();
}

/**
 * DB-backed seller guard (AGENT.md §3.2).
 * - Checks live DB status so newly approved creators can upload immediately without re-login.
 * - Blocks suspended accounts and admin accounts (admins never sell/upload).
 * - Never fails open if the database is unreachable.
 */
export async function requireSeller(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }
  const dbUser = await loadUserStatus(req.user.id);
  if (!dbUser) {
    throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
  }
  if (dbUser.suspended_at !== null) {
    throw new AppError(
      403,
      'ACCOUNT_SUSPENDED',
      'Your account has been suspended by an administrator. Upload access is blocked.',
    );
  }
  if (dbUser.role === 'admin') {
    throw new AppError(403, 'ADMIN_CANNOT_SELL', 'Admin accounts cannot upload or sell models.');
  }
  if (!dbUser.is_seller && dbUser.role !== 'creator') {
    throw new AppError(403, 'FORBIDDEN', 'Seller access required. Please apply to become a creator first.');
  }
  // Refresh request user claims from DB
  req.user.role = dbUser.role;
  req.user.is_seller = Boolean(dbUser.is_seller);
  next();
}

