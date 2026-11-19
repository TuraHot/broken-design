// Tests for the owner's notification inbox (list, mark one, mark all). Every query must be scoped to the caller.
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { db } from '../../config/db';
import { env } from '../../config/env';

const USER_ID = '44444444-4444-4444-8444-444444444444';
const NOTICE_ID = '55555555-5555-4555-8555-555555555555';

const token = () => jwt.sign({ id: USER_ID, email: 'owner@example.com', role: 'creator' }, env.jwtSecret);

async function withServer(
  handler: (sql: string, params: any[]) => { rowCount: number; rows: any[] } | undefined,
  run: (base: string, headers: Record<string, string>) => Promise<void>,
) {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string, params: any[]) => handler(sql, params) ?? { rowCount: 0, rows: [] };
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    await run(`http://localhost:${port}/api/me/notifications`, {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    });
  } finally {
    server.close();
    db.query = originalQuery;
  }
}

test('GET /api/me/notifications - 401 without a token', async () => {
  await withServer(() => undefined, async (base) => {
    assert.equal((await fetch(base)).status, 401);
  });
});

test('GET /api/me/notifications - lists only the callers notices with the unread count', async () => {
  const seen: any[][] = [];
  await withServer(
    (sql, params) => {
      if (sql.includes('FROM notifications')) {
        seen.push(params);
        return {
          rowCount: 2,
          rows: [
            { id: NOTICE_ID, kind: 'license_changed', model_id: null, data: { reason: 'r' }, read_at: null, created_at: '2026-11-19T00:00:00.000Z', unread: 1 },
            { id: 'x', kind: 'license_changed', model_id: null, data: {}, read_at: '2026-11-18T00:00:00.000Z', created_at: '2026-11-18T00:00:00.000Z', unread: 1 },
          ],
        };
      }
      return undefined;
    },
    async (base, headers) => {
      const res = await fetch(base, { headers });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.unread, 1);
      assert.equal(body.items.length, 2);
      assert.equal(body.items[0].id, NOTICE_ID);
      assert.equal(body.items[0].readAt, null);
      assert.equal(body.items[0].data.reason, 'r');
    },
  );
  assert.deepEqual(seen[0], [USER_ID]);
});

test('PATCH /api/me/notifications/:id/read - 404 for a notice that is not the callers, 400 for a bad id', async () => {
  await withServer(() => ({ rowCount: 0, rows: [] }), async (base, headers) => {
    const foreign = await fetch(`${base}/${NOTICE_ID}/read`, { method: 'PATCH', headers });
    assert.equal(foreign.status, 404);
    const bad = await fetch(`${base}/nope/read`, { method: 'PATCH', headers });
    assert.equal(bad.status, 400);
  });
});

test('PATCH /api/me/notifications/:id/read - marks the callers own notice', async () => {
  let params: any[] = [];
  await withServer(
    (sql, p) => {
      if (sql.includes('UPDATE notifications')) {
        params = p;
        assert.match(sql, /user_id = \$2/);
        return { rowCount: 1, rows: [{ id: NOTICE_ID }] };
      }
      return undefined;
    },
    async (base, headers) => {
      const res = await fetch(`${base}/${NOTICE_ID}/read`, { method: 'PATCH', headers });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { id: NOTICE_ID });
    },
  );
  assert.deepEqual(params, [NOTICE_ID, USER_ID]);
});

test('PATCH /api/me/notifications/read-all - only touches the callers unread notices', async () => {
  await withServer(
    (sql, p) => {
      if (sql.includes('UPDATE notifications')) {
        assert.match(sql, /user_id = \$1 AND read_at IS NULL/);
        assert.deepEqual(p, [USER_ID]);
        return { rowCount: 3, rows: [] };
      }
      return undefined;
    },
    async (base, headers) => {
      const res = await fetch(`${base}/read-all`, { method: 'PATCH', headers });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { updated: 3 });
    },
  );
});

// The reason for a suspension is delivered as a notice, so the inbox must stay open to a suspended account.
// requireAuth reads no user row: if a "suspended" check were added to it, these requests would start failing.
test('GET and PATCH /api/me/notifications - stay open to a suspended account and never look at the user row', async () => {
  let userLookups = 0;
  await withServer(
    (sql) => {
      if (sql.includes('FROM users')) {
        userLookups++;
        return { rowCount: 1, rows: [{ suspended_at: '2026-11-18T00:00:00.000Z' }] };
      }
      if (sql.includes('FROM notifications')) return { rowCount: 0, rows: [] };
      if (sql.includes('UPDATE notifications')) return { rowCount: 1, rows: [{ id: NOTICE_ID }] };
      return undefined;
    },
    async (base, headers) => {
      assert.equal((await fetch(base, { headers })).status, 200);
      assert.equal((await fetch(`${base}/${NOTICE_ID}/read`, { method: 'PATCH', headers })).status, 200);
      assert.equal((await fetch(`${base}/read-all`, { method: 'PATCH', headers })).status, 200);
    },
  );
  assert.equal(userLookups, 0);
});
