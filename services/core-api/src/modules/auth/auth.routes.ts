
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
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
       RETURNING id, email, display_name, role, is_seller, avatar_url, avatar_hash`,
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
        avatar_hash: user.avatar_hash || null,
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
    `SELECT id, email, password_hash, display_name, role, is_seller, avatar_url, avatar_hash, suspended_at
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
      avatar_hash: user.avatar_hash || null,
    },
  });
});

// GET /api/auth/avatar/:hash
// สตรีมรูปโปรไฟล์ตาม Content Hash (SHA-256) พร้อม ETag และ Cache-Control immutable
authRouter.get('/avatar/:hash', async (req, res) => {
  const { hash } = req.params;
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new AppError(400, 'INVALID_HASH', 'Invalid avatar content hash');
  }

  const avatarsDir = path.join(process.cwd(), 'storage', 'avatars');
  const possibleExts = ['jpg', 'png', 'webp', 'svg'];
  let foundPath: string | null = null;
  let foundExt = 'jpg';

  for (const ext of possibleExts) {
    const candidate = path.join(avatarsDir, `${hash}.${ext}`);
    if (fs.existsSync(candidate)) {
      foundPath = candidate;
      foundExt = ext;
      break;
    }
  }

  if (!foundPath) {
    throw new AppError(404, 'NOT_FOUND', 'Avatar not found');
  }

  const mime =
    foundExt === 'png'
      ? 'image/png'
      : foundExt === 'webp'
      ? 'image/webp'
      : foundExt === 'svg'
      ? 'image/svg+xml'
      : 'image/jpeg';

  res.setHeader('Content-Type', mime);
  res.setHeader('ETag', `"${hash}"`);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(foundPath);
});

// GET /api/auth/me
// ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน
authRouter.get('/me', requireAuth, async (req, res) => {
  const result = await db.query(
    `SELECT id, email, display_name, role, is_seller, avatar_url, avatar_hash, created_at
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
// อัปเดตรูปโปรไฟล์ (คำนวณ Content Hash SHA-256) หรือชื่อผู้ใช้ (displayName)
const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().max(2000000).nullable().optional(), // รองรับ Data URL หรือ Image URL
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
    let computedHash: string | null = null;
    let finalUrl: string | null = null;

    if (avatarUrl) {
      if (avatarUrl.startsWith('data:')) {
        // แตกข้อมูลรูป Base64 / SVG และคำนวณ Content Hash (SHA-256)
        const commaIdx = avatarUrl.indexOf(',');
        const rawData = commaIdx >= 0 ? avatarUrl.slice(commaIdx + 1) : avatarUrl;
        const isBase64 = avatarUrl.includes(';base64');
        const buffer = isBase64
          ? Buffer.from(rawData, 'base64')
          : Buffer.from(decodeURIComponent(rawData), 'utf8');

        // คำนวณ SHA-256 Hash
        computedHash = crypto.createHash('sha256').update(buffer).digest('hex');

        // ตรวจสอบนามสกุลไฟล์
        const mimeMatch = avatarUrl.match(/^data:([^;]+);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const ext = mime.includes('png') ? 'png' : mime.includes('svg') ? 'svg' : mime.includes('webp') ? 'webp' : 'jpg';

        // บันทึกไฟล์ลง storage/avatars/<hash>.<ext>
        const avatarsDir = path.join(process.cwd(), 'storage', 'avatars');
        if (!fs.existsSync(avatarsDir)) {
          fs.mkdirSync(avatarsDir, { recursive: true });
        }
        const filePath = path.join(avatarsDir, `${computedHash}.${ext}`);
        fs.writeFileSync(filePath, buffer);

        // กำหนด URL ที่อ้างอิงผ่าน Content Hash
        finalUrl = `/api/auth/avatar/${computedHash}`;
      } else {
        // หากส่งมาเป็น URL ให้คำนวณแฮชจาก URL
        computedHash = crypto.createHash('sha256').update(avatarUrl).digest('hex');
        finalUrl = avatarUrl;
      }
    }

    updates.push(`avatar_url = $${idx++}`);
    values.push(finalUrl);

    updates.push(`avatar_hash = $${idx++}`);
    values.push(computedHash);
  }

  if (updates.length === 0) {
    throw new AppError(400, 'NO_UPDATES', 'No update fields provided');
  }

  values.push(req.user!.id);
  const result = await db.query(
    `UPDATE users
     SET ${updates.join(', ')}
     WHERE id = $${idx}
     RETURNING id, email, display_name, role, is_seller, avatar_url, avatar_hash`,
    values,
  );

  const updatedUser = result.rows[0];
  if (!updatedUser) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }

  res.json({
    message: 'Profile updated successfully with SHA-256 content hash',
    user: updatedUser,
  });
});
