
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/error.middleware';
import { requireAuth } from '../../middlewares/auth.middleware';

export const authRouter = Router();

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
       RETURNING id, email, display_name, role, is_seller, avatar_url`,
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
        avatar_url: user.avatar_url || null,
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
    `SELECT id, email, password_hash, display_name, role, is_seller, avatar_url, suspended_at
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

  if (user.suspended_at) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account has been suspended');
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
      avatar_url: user.avatar_url || null,
    },
  });
});

// GET /api/auth/me
// ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน
authRouter.get('/me', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT id, email, display_name, role, is_seller, avatar_url, created_at
     FROM users
     WHERE id = $1`,
    [req.user!.id],
  );

  const user = result.rows[0];
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  res.json({ user });
});

// PATCH /api/auth/profile
// อัปเดตรูปโปรไฟล์ (avatarUrl) หรือชื่อผู้ใช้ (displayName)
const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().max(1000000).nullable().optional(), // รองรับ Data URL หรือ Image URL
});

authRouter.patch('/profile', requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(400, 'INVALID_INPUT', 'Invalid profile update data');
  }

  const { displayName, avatarUrl } = parsed.data;
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (displayName !== undefined) {
    updates.push(`display_name = $${idx++}`);
    values.push(displayName);
  }
  if (avatarUrl !== undefined) {
    updates.push(`avatar_url = $${idx++}`);
    values.push(avatarUrl);
  }

  if (updates.length === 0) {
    throw new AppError(400, 'NO_UPDATES', 'No update fields provided');
  }

  values.push(req.user!.id);
  const result = await db.query(
    `UPDATE users
     SET ${updates.join(', ')}
     WHERE id = $${idx}
     RETURNING id, email, display_name, role, is_seller, avatar_url`,
    values,
  );

  const updatedUser = result.rows[0];
  if (!updatedUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  res.json({
    message: 'Profile updated successfully',
    user: updatedUser,
  });
});
