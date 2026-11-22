// [เจี๊ยบ] Test suite สำหรับ POST /api/complaints (ผู้ใช้ส่งคำร้องเรียน)
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { db } from '../../config/db';
import { env } from '../../config/env';

const USER_ID = '55555555-5555-4555-8555-555555555555';
const MODEL_ID = '66666666-6666-4666-8666-666666666666';
const token = () => jwt.sign({ id: USER_ID, email: 'u@example.com', role: 'user' }, env.jwtSecret);

type Handler = (sql: string, params: any[]) => { rowCount: number; rows: any[] } | undefined;

async function withServer(handler: Handler, run: (url: string) => Promise<void>) {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string, params: any[]) => handler(sql, params) ?? { rowCount: 0, rows: [] };
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    await run(`http://localhost:${port}/api/complaints`);
  } finally {
    server.close();
    db.query = originalQuery;
  }
}

const post = (url: string, body: unknown, auth = true) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token()}` } : {}) },
    body: JSON.stringify(body),
  });

const OK_USER = (sql: string) =>
  sql.includes('SELECT suspended_at') ? { rowCount: 1, rows: [{ suspended_at: null, suspended_until: null }] } : undefined;

test('POST /api/complaints - requires login', async () => {
  await withServer(() => undefined, async (url) => {
    const res = await post(url, { category: 'other', message: 'Something is wrong here.' }, false);
    assert.equal(res.status, 401);
  });
});

test('POST /api/complaints - saves a model complaint with the reporter from the token', async () => {
  let insertParams: any[] = [];
  await withServer(
    (sql, params) => {
      const user = OK_USER(sql);
      if (user) return user;
      if (sql.includes('COUNT(*)::int AS total FROM complaints')) return { rowCount: 1, rows: [{ total: 0 }] };
      if (sql.includes('FROM models WHERE id = $1')) return { rowCount: 1, rows: [{ id: MODEL_ID }] };
      if (sql.includes('INSERT INTO complaints')) {
        insertParams = params;
        return { rowCount: 1, rows: [{ id: 'c-1', status: 'open', created_at: '2026-11-16T00:00:00.000Z' }] };
      }
    },
    async (url) => {
      const res = await post(url, { category: 'model', modelId: MODEL_ID, message: '  This model is copied from another site.  ' });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.status, 'open');
      assert.deepEqual(insertParams, [USER_ID, 'model', MODEL_ID, 'This model is copied from another site.']);
    },
  );
});

test('POST /api/complaints - validates the body', async () => {
  await withServer(OK_USER, async (url) => {
    for (const bad of [
      { category: 'other', message: 'short' },
      { category: 'other', message: 'x'.repeat(2001) },
      { category: 'weird', message: 'A long enough message.' },
      { category: 'model', message: 'A long enough message.' }, // model complaint without a model
      { category: 'other', modelId: 'not-a-uuid', message: 'A long enough message.' },
    ]) {
      const res = await post(url, bad);
      assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 60));
      assert.equal((await res.json()).error.code, 'INVALID_BODY');
    }
  });
});

test('POST /api/complaints - 404 for an unknown model, 403 for a suspended account', async () => {
  await withServer(
    (sql) => {
      const user = OK_USER(sql);
      if (user) return user;
      if (sql.includes('COUNT(*)::int AS total FROM complaints')) return { rowCount: 1, rows: [{ total: 0 }] };
    },
    async (url) => {
      const res = await post(url, { category: 'model', modelId: MODEL_ID, message: 'A long enough message.' });
      assert.equal(res.status, 404);
      assert.equal((await res.json()).error.code, 'MODEL_NOT_FOUND');
    },
  );

  await withServer(
    (sql) => (sql.includes('SELECT suspended_at') ? { rowCount: 1, rows: [{ suspended_at: '2026-11-01T00:00:00.000Z' }] } : undefined),
    async (url) => {
      const res = await post(url, { category: 'other', message: 'A long enough message.' });
      assert.equal(res.status, 403);
      assert.equal((await res.json()).error.code, 'ACCOUNT_SUSPENDED');
    },
  );
});

test('POST /api/complaints - 429 after 5 reports in an hour, nothing is saved', async () => {
  let inserted = false;
  await withServer(
    (sql) => {
      const user = OK_USER(sql);
      if (user) return user;
      if (sql.includes('COUNT(*)::int AS total FROM complaints')) return { rowCount: 1, rows: [{ total: 5 }] };
      if (sql.includes('INSERT INTO complaints')) inserted = true;
    },
    async (url) => {
      const res = await post(url, { category: 'other', message: 'A long enough message.' });
      assert.equal(res.status, 429);
      assert.equal((await res.json()).error.code, 'TOO_MANY_COMPLAINTS');
      assert.equal(inserted, false);
    },
  );
});
