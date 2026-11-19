
import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { requireAuth } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { liftExpiredSuspensions } from '../admin/suspensionSweeper';

export const authRouter = Router();

function buildAvatarUrl(userId: string, avatarHash?: string | null): string | null {
  const clean = avatarHash?.trim();
  return clean ? `${env.cdnServiceUrl}/cdn/users/${userId}/avatar.webp?v=${clean.slice(0, 12)}` : null;
}

// [Member 1] POST /api/auth/register
// authRouter.post('/register', async (_req, res) => {
//   res.status(201).json({ message: 'TODO [Member 1]: Register user with bcrypt & return JWT' });
// });

// [Member 1] POST /api/auth/login
// authRouter.post('/login', async (_req, res) => {
//   res.json({ message: 'TODO [Member 1]: Verify credentials & issue JWT' });
// });

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

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name cannot be empty')
    .max(100, 'Display name must not exceed 100 characters'),
});

// POST /api/auth/check-email
// ตรวจสอบว่า Email มีบัญชีอยู่ในระบบแล้วหรือไม่
authRouter.post('/check-email', async (req, res) => {
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
authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Invalid registration information');
  }

  const { email, password, displayName } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Hash password before saving it.
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await db.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, role, is_seller, avatar_hash`,
      [normalizedEmail, passwordHash, displayName],
    );

    const user = result.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      env.jwtSecret,
      { expiresIn: '1d' },
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
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
authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Invalid login information');
  }

  const { email, password } = parsed.data;

  const result = await db.query(
    `SELECT id, email, password_hash, display_name, role, is_seller, avatar_hash, suspended_at, suspended_until, suspension_reason
     FROM users
     WHERE email = $1`,
    [email.toLowerCase()],
  );

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
    },
    env.jwtSecret,
    { expiresIn: '1d' },
  );

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      is_seller: user.is_seller,
      avatar_url: buildAvatarUrl(user.id, user.avatar_hash),
    },
  });
});

// GET /api/auth/me — return latest profile & avatar URL for the signed-in account
authRouter.get('/me', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT id, email, display_name, role, is_seller, avatar_hash, suspended_at
     FROM users
     WHERE id = $1`,
    [req.user!.id],
  );

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
      role: user.role,
      is_seller: user.is_seller,
      avatar_url: buildAvatarUrl(user.id, user.avatar_hash),
    },
  });
});

// PATCH /api/auth/profile — update display_name for the signed-in account
// (User avatar binaries are managed separately by cdn-service in the `profile_logo` bucket.)
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
    `SELECT id, suspended_at FROM users WHERE id = $1`,
    [req.user!.id],
  );
  const currentUser = existing.rows[0];
  if (!currentUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  if (currentUser.suspended_at) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended');
  }

  const updated = await db.query(
    `UPDATE users
     SET display_name = $1
     WHERE id = $2
     RETURNING id, email, display_name, role, is_seller, avatar_hash`,
    [parsed.data.displayName, req.user!.id],
  );
  const user = updated.rows[0];

  res.json({
    message: 'Profile updated',
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      is_seller: user.is_seller,
      avatar_url: buildAvatarUrl(user.id, user.avatar_hash),
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
authRouter.post('/forgot-password', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Invalid email address');
  }

  const found = await db.query(
    `SELECT id, email FROM users WHERE email = $1 AND suspended_at IS NULL`,
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
    console.log(`[password-reset] OTP for ${user.email} (valid ${OTP_TTL_MINUTES} min): ${otp}`);
    if (mockMailbox) devOtp = otp;
  }

  res.json({
    message: 'If that email has an account, a verification code has been sent.',
    ...(devOtp ? { devOtp } : {}),
  });
});

// POST /api/auth/verify-reset-otp
// Checks the code (max 5 tries) and swaps it for a one-time reset token to use with /reset-password.
authRouter.post('/verify-reset-otp', async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Enter the 6-digit code');
  }
  const invalid = () => new AppError(400, 'INVALID_OTP', 'The code is incorrect or has expired');

  const found = await db.query(`SELECT id FROM users WHERE email = $1`, [parsed.data.email.toLowerCase()]);
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

  if (row.token_hash !== hashOtp(user.id, parsed.data.otp)) {
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
authRouter.post('/reset-password', async (req, res) => {
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
    await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, used.rows[0].user_id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  res.json({ message: 'Password updated. You can now log in.' });
});
