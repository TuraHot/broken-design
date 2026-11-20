// Security & correctness tests for PATCH /api/models/:id and DELETE /api/models/:id
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { db } from '../../config/db';
import { env } from '../../config/env';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const MODEL_ID = '44444444-4444-4444-8444-444444444444';

function makeToken(id: string, role: 'user' | 'creator' | 'admin' = 'creator') {
  return jwt.sign({ id, email: `${id}@example.com`, role }, env.jwtSecret, { algorithm: 'HS256' });
}

test('PATCH /api/models/:id - enforces UUID, DB-backed admin check, and PREVIEW_REQUIRED for paid models', async () => {
  const originalQuery = db.query.bind(db);
  let dbUser = { role: 'creator', suspended_at: null as string | null };
  let dbModel = {
    id: MODEL_ID,
    owner_id: OWNER_ID,
    title: 'Original Cube',
    description: 'Desc',
    tags: ['props'],
    price_cents: 0,
    license: 'CC0',
    preview_hash: null as string | null,
    deleted_at: null as string | null,
  };

  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('SELECT role, suspended_at FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [dbUser] };
    }
    if (sql.includes('FROM models WHERE id = $1')) {
      return { rowCount: 1, rows: [dbModel] };
    }
    if (sql.includes('UPDATE models')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: params[5],
            title: params[0],
            description: params[1],
            tags: params[2],
            price_cents: params[3],
            license: params[4],
          },
        ],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    // 1. Malformed UUID -> 404 (no Postgres 22P02 500)
    const badId = await fetch(`http://localhost:${port}/api/models/not-a-uuid`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${makeToken(OWNER_ID)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    });
    assert.equal(badId.status, 404);

    // 2. Forged JWT claiming admin when DB says user -> 403 FORBIDDEN
    dbUser = { role: 'user', suspended_at: null };
    const forgedAdmin = await fetch(`http://localhost:${port}/api/models/${MODEL_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${makeToken(OTHER_ID, 'admin')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hijacked' }),
    });
    assert.equal(forgedAdmin.status, 403);
    assert.equal((await forgedAdmin.json()).error?.code, 'FORBIDDEN');

    // 3. Owner setting price > 0 without preview_hash -> 400 PREVIEW_REQUIRED
    dbUser = { role: 'creator', suspended_at: null };
    const noPreview = await fetch(`http://localhost:${port}/api/models/${MODEL_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${makeToken(OWNER_ID)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceCents: 1500, license: 'COMMERCIAL' }),
    });
    assert.equal(noPreview.status, 400);
    assert.equal((await noPreview.json()).error?.code, 'PREVIEW_REQUIRED');

    // 4. With preview_hash present, setting price > 0 and tags succeeds
    dbModel.preview_hash = 'a'.repeat(64);
    const ok = await fetch(`http://localhost:${port}/api/models/${MODEL_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${makeToken(OWNER_ID)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Cube', priceCents: 1500, license: 'COMMERCIAL', tags: ['Sci-Fi', 'sci-fi', 'Props'] }),
    });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.model.priceCents, 1500);
    assert.deepEqual(body.model.tags, ['sci-fi', 'props']);

    // 5. DB-verified admin can edit another user's model
    dbUser = { role: 'admin', suspended_at: null };
    const realAdmin = await fetch(`http://localhost:${port}/api/models/${MODEL_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${makeToken(ADMIN_ID, 'admin')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Admin Fixed Title' }),
    });
    assert.equal(realAdmin.status, 200);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('DELETE /api/models/:id - checks DB role rather than JWT claim', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT role, suspended_at FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ role: 'user', suspended_at: null }] };
    }
    if (sql.includes('FROM models WHERE id = $1')) {
      return { rowCount: 1, rows: [{ id: MODEL_ID, owner_id: OWNER_ID, deleted_at: null }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/models/${MODEL_ID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${makeToken(OTHER_ID, 'admin')}` },
    });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error?.code, 'FORBIDDEN');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});
