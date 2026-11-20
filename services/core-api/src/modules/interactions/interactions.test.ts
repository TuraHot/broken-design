// Tests for likes endpoints (GET /api/me/likes, GET/POST /api/models/:id/like)
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { db } from '../../config/db';
import { env } from '../../config/env';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const MODEL_ID = '33333333-3333-4333-8333-333333333333';

function token(id = USER_ID) {
  return jwt.sign({ id, email: `${id}@example.com`, role: 'user' }, env.jwtSecret, { algorithm: 'HS256' });
}

test('GET /api/me/likes - returns all liked model IDs for authenticated user', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT model_id FROM likes WHERE user_id = $1')) {
      return { rowCount: 2, rows: [{ model_id: MODEL_ID }, { model_id: '44444444-4444-4444-8444-444444444444' }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const unauth = await fetch(`http://localhost:${port}/api/me/likes`);
    assert.equal(unauth.status, 401);

    const res = await fetch(`http://localhost:${port}/api/me/likes`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.modelIds, [MODEL_ID, '44444444-4444-4444-8444-444444444444']);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/models/:id/like - toggles like, writes owner notification, and blocks suspended users', async () => {
  const originalQuery = db.query.bind(db);
  let isLiked = false;
  let suspended = false;
  let notified = false;

  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT suspended_at FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ suspended_at: suspended ? new Date() : null }] };
    }
    if (sql.includes('FROM models m') && sql.includes('u.suspended_at IS NULL')) {
      return { rowCount: 1, rows: [{ id: MODEL_ID, owner_id: OWNER_ID, title: 'Crystal Sword' }] };
    }
    if (sql.includes('DELETE FROM likes')) {
      if (isLiked) {
        isLiked = false;
        return { rowCount: 1, rows: [{ user_id: USER_ID }] };
      }
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('INSERT INTO likes')) {
      isLiked = true;
      return { rowCount: 1, rows: [] };
    }
    if (sql.includes('AS like_count FROM likes')) {
      return { rowCount: 1, rows: [{ like_count: isLiked ? 1 : 0 }] };
    }
    if (sql.includes('SELECT display_name FROM users')) {
      return { rowCount: 1, rows: [{ display_name: 'Alice' }] };
    }
    if (sql.includes('INSERT INTO notifications')) {
      notified = true;
      return { rowCount: 1, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    // 1. Like -> liked=true, likeCount=1, notifies owner
    const likeRes = await fetch(`http://localhost:${port}/api/models/${MODEL_ID}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    });
    assert.equal(likeRes.status, 200);
    assert.deepEqual(await likeRes.json(), { liked: true, likeCount: 1 });
    assert.equal(notified, true);

    // 2. Unlike -> liked=false, likeCount=0
    const unlikeRes = await fetch(`http://localhost:${port}/api/models/${MODEL_ID}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    });
    assert.equal(unlikeRes.status, 200);
    assert.deepEqual(await unlikeRes.json(), { liked: false, likeCount: 0 });

    // 3. Suspended user -> 403
    suspended = true;
    const suspRes = await fetch(`http://localhost:${port}/api/models/${MODEL_ID}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
    });
    assert.equal(suspRes.status, 403);
    assert.equal((await suspRes.json()).error?.code, 'ACCOUNT_SUSPENDED');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});
