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

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
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
    user = jwt.verify(header.slice(7), env.jwtSecret) as AuthUser;
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid or expired JWT token');
  }
  if (await isAccountDeleted(user.id)) {
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

