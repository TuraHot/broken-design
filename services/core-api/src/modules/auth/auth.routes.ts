
import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { isSuspended, requireAuth } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { liftExpiredSuspensions } from '../admin/suspensionSweeper';

export const authRouter = Router();

const numEnv = (key: string, fallback: number) => {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const authLimitHandler = (_req: Request, res: Response) => {
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts, please try again later.',
    },
  });
};

const makeAuthLimiter = (
  limit: number,
  extra: Partial<Parameters<typeof rateLimit>[0]> = {},
) =>
  rateLimit({
    windowMs: 15 * 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' && process.env.ENFORCE_AUTH_RATE_LIMIT !== 'true',
    handler: authLimitHandler,
    ...extra,
  });

const checkEmailLimiter = makeAuthLimiter(numEnv('AUTH_CHECK_EMAIL_LIMIT_PER_15MIN', 30));
const registerLimiter = makeAuthLimiter(numEnv('AUTH_REGISTER_LIMIT_PER_15MIN', 10));
const loginLimiter = makeAuthLimiter(numEnv('AUTH_LOGIN_LIMIT_PER_15MIN', 20), {
  skipSuccessfulRequests: true,
});
const passwordResetLimiter = makeAuthLimiter(numEnv('AUTH_RESET_LIMIT_PER_15MIN', 10));

function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a.trim(), 'utf8');
  const bufB = Buffer.from(b.trim(), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function buildAvatarUrl(userId: string, avatarHash?: string | null): string | null {
  const clean = avatarHash?.trim();
  return clean ? `${env.cdnServiceUrl}/cdn/users/${userId}/avatar.webp?v=${clean.slice(0, 12)}` : null;
}

const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1),
});

// ตรวจสอบรูปแบบ Email ก่อนนำไปค้นหาในฐานข้อมูล
const checkEmailSchema = z.object({
  email: z.string().trim().email().max(255),
});

const updateProfileSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name cannot be empty')
      .max(100, 'Display name must not exceed 100 characters')
      .optional(),
    bio: z
      .string()
      .trim()
      .max(1000, 'Bio must not exceed 1000 characters')
      .optional(),
    featuredModelIds: z
      .array(z.string().uuid())
      .max(5, 'Maximum 5 featured models allowed')
      .optional(),
  })
  .refine(
    (data) =>
      data.displayName !== undefined ||
      data.bio !== undefined ||
      data.featuredModelIds !== undefined,
    {
      message: 'At least one field (displayName, bio, or featuredModelIds) must be provided',
    },
  );

// POST /api/auth/check-email
// ตรวจสอบว่า Email มีบัญชีอยู่ในระบบแล้วหรือไม่
authRouter.post('/check-email', checkEmailLimiter, async (req, res) => {
  const parsed = checkEmailSchema.safeParse(req.body);

  // ตรวจสอบว่า Email ถูกต้องตามรูปแบบหรือไม่
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Invalid email address');
  }

  const email = parsed.data.email.toLowerCase();

  // ค้นหาว่ามี Email นี้อยู่ในตาราง users หรือไม่
  const result = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM users WHERE email = $1
     ) AS exists`,
    [email],
  );

  // ส่งผลลัพธ์กลับไปให้ Frontend
  res.json({
    exists: result.rows[0].exists,
  });
});

// POST /api/auth/register
authRouter.post('/register', registerLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Invalid registration information');
  }

  const { email, password, displayName } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  // The placeholder domain of deleted accounts (see the admin delete route) is never a real address to sign up with.
  if (normalizedEmail.endsWith('@deleted.invalid')) {
    throw new AppError(400, 'INVALID_INPUT', 'Invalid registration information');
  }

  // Hash password before saving it.
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await db.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, COALESCE(bio, '') AS bio, role, is_seller, avatar_hash`,
      [normalizedEmail, passwordHash, displayName],
    );

    const user = result.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        is_seller: Boolean(user.is_seller),
      },
      env.jwtSecret,
      { algorithm: 'HS256', expiresIn: '1d' },
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        bio: user.bio || '',
        role: user.role,
        is_seller: user.is_seller,
        avatar_url: buildAvatarUrl(user.id, user.avatar_hash),
      },
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new AppError(409, 'EMAIL_EXISTS', 'This email is already registered');
    }

    throw error;
  }
});

// POST /api/auth/login
authRouter.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Invalid login information');
  }

  const { email, password } = parsed.data;

  let result;
  try {
    result = await db.query(
      `SELECT id, email, password_hash, display_name, COALESCE(bio, '') AS bio, role, is_seller, avatar_hash, suspended_at, suspended_until, suspension_reason, featured_model_ids
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()],
    );
  } catch (err: any) {
    if (err?.code === '42703') {
      result = await db.query(
        `SELECT id, email, password_hash, display_name, COALESCE(bio, '') AS bio, role, is_seller, avatar_hash, suspended_at, suspended_until, suspension_reason
         FROM users
         WHERE email = $1`,
        [email.toLowerCase()],
      );
    } else {
      throw err;
    }
  }

  const user = result.rows[0];

  // Use the same response for unknown email and wrong password.
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  // The end time has passed but the sweeper has not run yet: lift it now so the person is not turned away.
  if (user.suspended_at && user.suspended_until && new Date(user.suspended_until).getTime() <= Date.now()) {
    await liftExpiredSuspensions();
    // The sweep uses the DATABASE clock and this check the app clock, so it may have lifted nothing yet.
    // Read the row again instead of assuming; a suspended account never gets a token.
    const fresh = await db.query(
      `SELECT suspended_at, suspended_until, suspension_reason FROM users WHERE id = $1`,
      [user.id],
    );
    if (fresh.rows[0]) Object.assign(user, fresh.rows[0]);
  }

  if (user.suspended_at) {
    // The person cannot sign in to read their notices, so the reason and the end date are in this message.
    const ends = user.suspended_until
      ? `until ${new Date(user.suspended_until).toISOString().slice(0, 10)} (UTC)`
      : 'until an administrator restores the account';
    const why = user.suspension_reason ? ` Reason: ${user.suspension_reason}` : '';
    throw new AppError(403, 'ACCOUNT_SUSPENDED', `This account is suspended ${ends}.${why}`);
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      is_seller: Boolean(user.is_seller),
    },
    env.jwtSecret,
    { algorithm: 'HS256', expiresIn: '1d' },
  );

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      bio: user.bio || '',
      role: user.role,
      is_seller: user.is_seller,
      avatar_url: buildAvatarUrl(user.id, user.avatar_hash),
      featured_model_ids: Array.isArray(user.featured_model_ids) ? user.featured_model_ids : null,
    },
  });
});

// GET /api/auth/me — return latest profile & avatar URL for the signed-in account
authRouter.get('/me', requireAuth, async (req, res) => {
  let result;
  try {
    result = await db.query(
      `SELECT id, email, display_name, bio, role, is_seller, avatar_hash, suspended_at, featured_model_ids
       FROM users
       WHERE id = $1`,
      [req.user!.id],
    );
  } catch {
    result = await db.query(
      `SELECT id, email, display_name, role, is_seller, avatar_hash, suspended_at
       FROM users
       WHERE id = $1`,
      [req.user!.id],
    );
  }

  const user = result.rows[0];
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  if (user.suspended_at) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended');
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      bio: (user as any).bio || '',
      role: user.role,
      is_seller: user.is_seller,
      avatar_url: buildAvatarUrl(user.id, user.avatar_hash),
      featured_model_ids: Array.isArray((user as any).featured_model_ids) ? (user as any).featured_model_ids : null,
    },
  });
});

// PATCH /api/auth/profile — update display_name, bio, and/or featured_model_ids for the signed-in account
authRouter.patch('/profile', requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(
      400,
      'INVALID_INPUT',
      parsed.error.issues[0]?.message || 'Invalid profile update data',
    );
  }

  const existing = await db.query(
    `SELECT id, display_name, suspended_at, suspended_until FROM users WHERE id = $1`,
    [req.user!.id],
  );
  const currentUser = existing.rows[0];
  if (!currentUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  if (isSuspended(currentUser)) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended');
  }

  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (parsed.data.displayName !== undefined) {
    setClauses.push(`display_name = $${idx++}`);
    values.push(parsed.data.displayName);
  }
  if (parsed.data.bio !== undefined) {
    setClauses.push(`bio = $${idx++}`);
    values.push(parsed.data.bio);
  }
  if (parsed.data.featuredModelIds !== undefined) {
    const uniqueFeaturedIds = Array.from(new Set(parsed.data.featuredModelIds));
    if (uniqueFeaturedIds.length > 0) {
      const ownedRes = await db.query<{ id: string }>(
        `SELECT id FROM models WHERE owner_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
        [req.user!.id, uniqueFeaturedIds],
      );
      if (ownedRes.rows.length !== uniqueFeaturedIds.length) {
        throw new AppError(
          400,
          'INVALID_FEATURED_MODELS',
          'All featured models must belong to your account and not be deleted',
        );
      }
    }
    setClauses.push(`featured_model_ids = $${idx++}`);
    values.push(uniqueFeaturedIds);
  }

  values.push(req.user!.id);
  let updated;
  try {
    updated = await db.query(
      `UPDATE users
       SET ${setClauses.join(', ')}
       WHERE id = $${idx}
       RETURNING id, email, display_name, bio, role, is_seller, avatar_hash, featured_model_ids`,
      values,
    );
  } catch (err: any) {
    if (err?.code === '42703') {
      await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS featured_model_ids UUID[] DEFAULT NULL');
      updated = await db.query(
        `UPDATE users
         SET ${setClauses.join(', ')}
         WHERE id = $${idx}
         RETURNING id, email, display_name, bio, role, is_seller, avatar_hash, featured_model_ids`,
        values,
      );
    } else {
      throw err;
    }
  }
  const user = updated.rows[0];

  res.json({
    message: 'Profile updated',
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      bio: user.bio || '',
      role: user.role,
      is_seller: user.is_seller,
      avatar_url: buildAvatarUrl(user.id, user.avatar_hash),
      featured_model_ids: Array.isArray(user.featured_model_ids) ? user.featured_model_ids : null,
    },
  });
});

// ---- Password reset (email -> 6-digit OTP -> one-time reset token -> new password) ----
const OTP_TTL_MINUTES = 10;
const RESET_TOKEN_TTL_MINUTES = 15;
const MAX_OTP_ATTEMPTS = 5;
const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const hashOtp = (userId: string, otp: string) => hashResetToken(`${userId}:${otp}`);

const forgotPasswordSchema = z.object({ email: z.string().trim().email().max(255) });
const verifyOtpSchema = z.object({
  email: z.string().trim().email().max(255),
  otp: z.string().regex(/^\d{6}$/),
});
const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(72),
});

// POST /api/auth/forgot-password
// Always answers the same way so it cannot be used to discover which emails have an account.
// No mail provider is configured: the OTP is logged, and outside production also returned as `devOtp`
// (mock mailbox) so the page can show it instead of an email.
authRouter.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Invalid email address');
  }

  const found = await db.query(
    `SELECT id, email FROM users WHERE email = $1 AND (suspended_at IS NULL OR suspended_until <= NOW())`,
    [parsed.data.email.toLowerCase()],
  );
  const user = found.rows[0];
  const mockMailbox = process.env.NODE_ENV !== 'production';
  let devOtp: string | undefined;

  if (user) {
    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await db.query(`DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL`, [user.id]);
    await db.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
      [user.id, hashOtp(user.id, otp), String(OTP_TTL_MINUTES)],
    );
    if (mockMailbox) {
      console.log(`[password-reset] OTP for ${user.email} (valid ${OTP_TTL_MINUTES} min): ${otp}`);
      devOtp = otp;
    } else {
      console.warn('[password-reset] Password reset OTP generated in production without a configured mail provider.');
    }
  }

  res.json({
    message: 'If that email has an account, a verification code has been sent.',
    ...(devOtp ? { devOtp } : {}),
  });
});

// POST /api/auth/verify-reset-otp
// Checks the code (max 5 tries) and swaps it for a one-time reset token to use with /reset-password.
authRouter.post('/verify-reset-otp', passwordResetLimiter, async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Enter the 6-digit code');
  }
  const invalid = () => new AppError(400, 'INVALID_OTP', 'The code is incorrect or has expired');

  const found = await db.query(
    `SELECT id FROM users WHERE email = $1 AND (suspended_at IS NULL OR suspended_until <= NOW())`,
    [parsed.data.email.toLowerCase()],
  );
  const user = found.rows[0];
  if (!user) throw invalid();

  const row = (
    await db.query(
      `SELECT id, token_hash, attempts FROM password_resets
       WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id],
    )
  ).rows[0];
  if (!row || row.attempts >= MAX_OTP_ATTEMPTS) throw invalid();

  if (!timingSafeHexEqual(String(row.token_hash), hashOtp(user.id, parsed.data.otp))) {
    await db.query(`UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    throw invalid();
  }

  const token = crypto.randomBytes(32).toString('hex');
  await db.query(
    `UPDATE password_resets
     SET token_hash = $1, attempts = 0, expires_at = NOW() + ($2 || ' minutes')::interval
     WHERE id = $3`,
    [hashResetToken(token), String(RESET_TOKEN_TTL_MINUTES), row.id],
  );
  res.json({ token });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', passwordResetLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Password must be at least 8 characters');
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Mark the token used first; only one request can win, and it must be unused and unexpired.
    const used = await client.query(
      `UPDATE password_resets SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`,
      [hashResetToken(parsed.data.token)],
    );
    if (used.rowCount === 0) {
      await client.query('ROLLBACK');
      throw new AppError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired');
    }
    const updUser = await client.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 AND suspended_at IS NULL RETURNING id`,
      [passwordHash, used.rows[0].user_id],
    );
    if (updUser.rowCount === 0) {
      await client.query('ROLLBACK');
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  res.json({ message: 'Password updated. You can now log in.' });
});
