// [ต้า & ทีม] Test suite สำหรับ Auth module (check-email, register, login)
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { db } from '../../config/db';
import { env } from '../../config/env';

test('POST /api/auth/check-email - validates email and checks existence', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('SELECT EXISTS')) {
      const email = params[0];
      return { rows: [{ exists: email === 'known@example.com' }] };
    }
    return { rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    // 1. Invalid email format
    const badRes = await fetch(`http://localhost:${port}/api/auth/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    assert.equal(badRes.status, 400);

    // 2. Known email returns exists: true
    const knownRes = await fetch(`http://localhost:${port}/api/auth/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'known@example.com' }),
    });
    assert.equal(knownRes.status, 200);
    const knownBody = await knownRes.json();
    assert.equal(knownBody.exists, true);

    // 3. Unknown email returns exists: false
    const unknownRes = await fetch(`http://localhost:${port}/api/auth/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com' }),
    });
    assert.equal(unknownRes.status, 200);
    const unknownBody = await unknownRes.json();
    assert.equal(unknownBody.exists, false);
  } finally {
    (db as any).query = originalQuery;
    server.close();
  }
});

test('POST /api/auth/login - authenticates user with password', async () => {
  const originalQuery = db.query.bind(db);
  const hashedPassword = await bcrypt.hash('Secret1234!', 10);

  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('FROM users')) {
      const email = params[0];
      if (email === 'user@example.com') {
        return {
          rows: [
            {
              id: 'u-123',
              email: 'user@example.com',
              password_hash: hashedPassword,
              display_name: 'Test User',
              role: 'user',
              is_seller: false,
              suspended_at: null,
            },
          ],
        };
      }
      return { rows: [] };
    }
    return { rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    // 1. Wrong password
    const wrongRes = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'wrongpassword' }),
    });
    assert.equal(wrongRes.status, 401);

    // 2. Correct credentials return JWT token and user info
    const okRes = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'Secret1234!' }),
    });
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.ok(okBody.token);
    assert.equal(okBody.user.id, 'u-123');
    assert.equal(okBody.user.email, 'user@example.com');
  } finally {
    (db as any).query = originalQuery;
    server.close();
  }
});

test('PATCH /api/auth/profile - updates display_name and validates auth, input, and suspension', async () => {
  const originalQuery = db.query.bind(db);
  let suspended = false;
  const avatarHash = 'a'.repeat(64);

  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('SELECT id, suspended_at FROM users')) {
      return {
        rows: [
          {
            id: params[0],
            suspended_at: suspended ? new Date().toISOString() : null,
          },
        ],
      };
    }
    if (sql.includes('UPDATE users') && sql.includes('SET display_name')) {
      return {
        rows: [
          {
            id: params[1],
            email: 'user@example.com',
            display_name: params[0],
            role: 'creator',
            is_seller: true,
            avatar_hash: avatarHash,
          },
        ],
      };
    }
    return { rows: [] };
  };

  const token = jwt.sign(
    { id: 'u-123', email: 'user@example.com', role: 'creator' },
    env.jwtSecret,
    { expiresIn: '1h' },
  );

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    // 1. Missing Authorization header -> 401
    const unauthRes = await fetch(`http://localhost:${port}/api/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'New Creator Name' }),
    });
    assert.equal(unauthRes.status, 401);

    // 2. Blank or overlong displayName -> 400
    const blankRes = await fetch(`http://localhost:${port}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: '   ' }),
    });
    assert.equal(blankRes.status, 400);

    const longRes = await fetch(`http://localhost:${port}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: 'x'.repeat(101) }),
    });
    assert.equal(longRes.status, 400);

    // 3. Suspended user -> 403
    suspended = true;
    const suspRes = await fetch(`http://localhost:${port}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: 'New Creator Name' }),
    });
    assert.equal(suspRes.status, 403);

    // 4. Valid active user -> 200 with trimmed display_name and computed avatar_url
    suspended = false;
    const okRes = await fetch(`http://localhost:${port}/api/auth/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: '  New Creator Name  ' }),
    });
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.equal(okBody.user.display_name, 'New Creator Name');
    assert.ok(okBody.user.avatar_url.includes(`/cdn/users/u-123/avatar.webp?v=${avatarHash.slice(0, 12)}`));
  } finally {
    (db as any).query = originalQuery;
    server.close();
  }
});
