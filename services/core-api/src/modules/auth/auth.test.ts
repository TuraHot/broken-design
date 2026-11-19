// [ต้า & ทีม] Test suite สำหรับ Auth module (check-email, register, login)
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { app } from '../../app';
import { db } from '../../config/db';

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

// ─── login of a suspended account: the message says why and until when ──────
async function loginWith(row: Record<string, unknown>, extra?: (sql: string) => any, options: { sweepLifts: boolean } = { sweepLifts: true }) {
  const originalQuery = db.query.bind(db);
  const hashedPassword = await bcrypt.hash('Secret1234!', 10);
  let swept = 0;
  (db as any).query = async (sql: string) => {
    if (sql.includes('INSERT INTO user_suspensions')) {
      swept++;
      return { rowCount: 1, rows: [{ lifted: options.sweepLifts ? 1 : 0 }] };
    }
    const custom = extra?.(sql);
    if (custom) return custom;
    if (sql.includes('FROM users WHERE id = $1')) {
      // the row read again after a sweep: lifted, or still suspended when the sweep did nothing
      return {
        rows: [swept > 0 && options.sweepLifts ? { suspended_at: null, suspended_until: null, suspension_reason: null } : { suspended_at: row.suspended_at, suspended_until: row.suspended_until, suspension_reason: row.suspension_reason }],
      };
    }
    if (sql.includes('FROM users')) {
      return {
        rows: [{ id: 'u-9', email: 'sus@example.com', password_hash: hashedPassword, display_name: 'Sus', role: 'user', is_seller: false, ...row }],
      };
    }
    return { rows: [] };
  };
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sus@example.com', password: 'Secret1234!' }),
    });
    return { res, body: await res.json(), swept };
  } finally {
    (db as any).query = originalQuery;
    server.close();
  }
}

test('POST /api/auth/login - a suspended account gets the reason and the end date in the message', async () => {
  const until = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const { res, body } = await loginWith({
    suspended_at: new Date().toISOString(),
    suspended_until: until.toISOString(),
    suspension_reason: 'Uploading stolen models.',
  });
  assert.equal(res.status, 403);
  assert.equal(body.error.code, 'ACCOUNT_SUSPENDED');
  assert.match(body.error.message, /Uploading stolen models\./);
  assert.ok(body.error.message.includes(until.toISOString().slice(0, 10)), body.error.message);
});

test('POST /api/auth/login - a suspension with no end says it lasts until an admin restores the account', async () => {
  const { res, body } = await loginWith({
    suspended_at: new Date().toISOString(),
    suspended_until: null,
    suspension_reason: 'Fraud.',
  });
  assert.equal(res.status, 403);
  assert.match(body.error.message, /Fraud\./);
  assert.match(body.error.message, /until an administrator restores/);
});

test('POST /api/auth/login - a suspension whose end time has passed is lifted and the login succeeds', async () => {
  const { res, body, swept } = await loginWith({
    suspended_at: '2026-11-01T00:00:00.000Z',
    suspended_until: new Date(Date.now() - 60_000).toISOString(),
    suspension_reason: 'Old reason.',
  });
  assert.equal(res.status, 200);
  assert.ok(body.token);
  assert.equal(swept, 1);
});

// The sweep compares with the DATABASE clock, the login check with the APP clock. If the app clock is ahead, the
// sweep lifts nothing; the login must not assume it did, and must not issue a token for a suspended account.
test('POST /api/auth/login - when the sweep lifts nothing (clock difference) the account stays suspended and gets no token', async () => {
  const { res, body, swept } = await loginWith(
    {
      suspended_at: '2026-11-01T00:00:00.000Z',
      suspended_until: new Date(Date.now() - 5_000).toISOString(), // over by the app clock only
      suspension_reason: 'Still counts for the database.',
    },
    undefined,
    { sweepLifts: false },
  );
  assert.equal(swept, 1);
  assert.equal(res.status, 403);
  assert.equal(body.error.code, 'ACCOUNT_SUSPENDED');
  assert.equal(body.token, undefined);
  assert.match(body.error.message, /Still counts for the database\./);
});
