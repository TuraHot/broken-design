// [เจี๊ยบ] Test suite สำหรับ Admin module (ตรวจสิทธิ์จาก DB, overview, ระงับ/ซ่อน, รายการ)
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { db } from '../../config/db';
import { env } from '../../config/env';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const MODEL_ID = '33333333-3333-4333-8333-333333333333';

// JWT บอกว่าเป็น admin เสมอ — สิทธิ์จริงต้องมาจากผลคิวรี DB ที่ mock ในแต่ละเทสต์
function token(role: 'user' | 'creator' | 'admin' = 'admin', id = ADMIN_ID) {
  return jwt.sign({ id, email: 'admin@example.com', role }, env.jwtSecret);
}

type Handler = (sql: string, params: any[]) => { rowCount: number; rows: any[] } | undefined;

// mock db.query: ตอบคิวรีตรวจแอดมินให้ตาม adminRow แล้วส่งที่เหลือให้ handler
async function withServer(
  adminRow: { role: string; suspended_at: string | null } | null,
  handler: Handler,
  run: (base: string) => Promise<void>,
) {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('SELECT role, suspended_at, suspended_until FROM users WHERE id = $1')) {
      return adminRow ? { rowCount: 1, rows: [adminRow] } : { rowCount: 0, rows: [] };
    }
    return handler(sql, params) ?? { rowCount: 0, rows: [] };
  };
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    await run(`http://localhost:${port}/api/admin`);
  } finally {
    server.close();
    db.query = originalQuery;
  }
}

const ACTIVE_ADMIN = { role: 'admin', suspended_at: null };

test('admin routes - 401 without token', async () => {
  await withServer(ACTIVE_ADMIN, () => undefined, async (base) => {
    const res = await fetch(`${base}/overview`);
    assert.equal(res.status, 401);
  });
});

test('admin routes - 403 when DB says user is not admin, even if JWT claims admin', async () => {
  await withServer({ role: 'user', suspended_at: null }, () => undefined, async (base) => {
    const res = await fetch(`${base}/overview`, { headers: { Authorization: `Bearer ${token('admin')}` } });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error.code, 'FORBIDDEN');
  });
});

test('admin routes - 403 for suspended admin', async () => {
  await withServer({ role: 'admin', suspended_at: '2026-11-01T00:00:00.000Z' }, () => undefined, async (base) => {
    const res = await fetch(`${base}/overview`, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error.code, 'ACCOUNT_SUSPENDED');
  });
});

test('GET /api/admin/overview - returns totals, breakdowns and recent lists', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('AS total_users')) {
        return {
          rowCount: 1,
          rows: [
            {
              total_users: 10,
              suspended_users: 1,
              admin_users: 1,
              seller_users: 3,
              new_users_7d: 2,
              total_models: 20,
              hidden_models: 2,
              free_models: 12,
              new_models_7d: 4,
              total_downloads: '340',
              total_views: '5100',
              paid_purchases: 5,
              pending_purchases: 1,
              open_complaints: 2,
              pending_applications: 3,
              pending_withdrawals: 4,
              total_revenue_cents: '12900',
              revenue_7d_cents: '2900',
            },
          ],
        };
      }
      if (sql.includes('GROUP BY license')) {
        return { rowCount: 2, rows: [{ license: 'CC0', count: 12 }, { license: 'COMMERCIAL', count: 8 }] };
      }
      if (sql.includes('ORDER BY m.download_count DESC')) {
        return {
          rowCount: 1,
          rows: [{ id: MODEL_ID, title: 'Robot', owner_name: 'Alice', download_count: '90', view_count: '700' }],
        };
      }
      if (sql.includes('FROM purchases p') && sql.includes('LIMIT 5')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'p-1',
              amount_cents: 2900,
              currency: 'USD',
              paid_at: '2026-11-12T00:00:00.000Z',
              buyer_name: 'Bob',
              model_id: MODEL_ID,
              model_title: 'Robot',
            },
          ],
        };
      }
      if (sql.includes('ORDER BY created_at DESC LIMIT 5')) {
        return {
          rowCount: 1,
          rows: [{ id: TARGET_ID, display_name: 'Alice', email: 'a@example.com', role: 'creator', created_at: '2026-11-15T00:00:00.000Z' }],
        };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/overview`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.totalUsers, 10);
      assert.equal(body.hiddenModels, 2);
      assert.equal(body.paidPurchases, 5);
      assert.equal(body.pendingApplications, 3);
      assert.equal(body.pendingWithdrawals, 4);
      assert.equal(body.pendingPurchases, 1);
      assert.equal(body.openComplaints, 2);
      assert.equal(body.totalRevenueCents, 12900);
      assert.equal(body.revenue7dCents, 2900);
      assert.equal(body.totalDownloads, 340);
      assert.equal(body.freeModels, 12);
      assert.deepEqual(body.licenseBreakdown[0], { license: 'CC0', count: 12 });
      assert.equal(body.topModels[0].downloadCount, 90);
      assert.equal(body.recentPurchases[0].buyerName, 'Bob');
      assert.equal(body.recentPurchases[0].model.title, 'Robot');
      assert.equal(body.recentUsers[0].displayName, 'Alice');
      assert.equal('password_hash' in body.recentUsers[0], false);
    },
  );
});

test('GET /api/admin/users - paginates and maps rows', async () => {
  let listParams: any[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('COUNT(*)::int AS total FROM users')) return { rowCount: 1, rows: [{ total: 42 }] };
      if (sql.includes('FROM users') && sql.includes('LIMIT')) {
        listParams = params;
        return {
          rowCount: 1,
          rows: [
            {
              id: TARGET_ID,
              email: 'a@example.com',
              display_name: 'Alice',
              role: 'creator',
              is_seller: true,
              suspended_at: '2026-11-18T00:00:00.000Z',
              suspended_until: '2026-11-25T00:00:00.000Z',
              suspension_reason: 'Uploaded stolen models.',
              created_at: '2026-11-01T00:00:00.000Z',
            },
          ],
        };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/users?page=2&pageSize=10`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.total, 42);
      assert.equal(body.page, 2);
      assert.equal(body.items[0].displayName, 'Alice');
      assert.equal(body.items[0].isSeller, true);
      assert.equal('password_hash' in body.items[0], false);
      assert.equal(body.items[0].suspensionReason, 'Uploaded stolen models.');
      assert.equal(body.items[0].suspendedUntil, '2026-11-25T00:00:00.000Z');
      assert.deepEqual(listParams, [10, 10]);
    },
  );
});

test('GET /api/admin/users - rejects bad paging with 400', async () => {
  await withServer(ACTIVE_ADMIN, () => undefined, async (base) => {
    const res = await fetch(`${base}/users?pageSize=1000`, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'INVALID_QUERY');
  });
});

test('GET /api/admin/users - search term is escaped into a LIKE pattern', async () => {
  let searchParam = '';
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('COUNT(*)::int AS total FROM users')) {
        searchParam = params[0];
        return { rowCount: 1, rows: [{ total: 0 }] };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/users?q=${encodeURIComponent('50%_off')}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      assert.equal(res.status, 200);
      assert.equal(searchParam, '%50\\%\\_off%');
    },
  );
});

// ─── PATCH /api/admin/users/:id/suspend (reason, optional end time, notice) ─────────
const SUSPEND_REASON = 'Repeated uploads of stolen models after two warnings.';
const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

function patchSuspend(base: string, body: unknown, id = TARGET_ID) {
  return fetch(`${base}/users/${id}/suspend`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('PATCH /api/admin/users/:id/suspend - suspends until a date, records it and notifies in ONE statement', async () => {
  const until = inDays(7);
  const statements: { sql: string; params: any[] }[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (!sql.includes('user_suspensions')) return undefined;
      statements.push({ sql, params });
      return { rowCount: 1, rows: [{ found: 1, changed: 1, suspended_at: '2026-11-16T00:00:00.000Z', suspended_until: until }] };
    },
    async (base) => {
      const res = await patchSuspend(base, { suspended: true, reason: `  ${SUSPEND_REASON}  `, until });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.isSuspended, true);
      assert.equal(body.suspendedUntil, until);
    },
  );
  assert.equal(statements.length, 1);
  const { sql, params } = statements[0];
  assert.match(sql, /UPDATE users/);
  assert.match(sql, /INSERT INTO user_suspensions/);
  assert.match(sql, /INSERT INTO notifications/);
  assert.match(sql, /FOR UPDATE/);
  assert.deepEqual(params, [TARGET_ID, true, until, SUSPEND_REASON, ADMIN_ID]); // reason trimmed, admin from the token
});

test('PATCH /api/admin/users/:id/suspend - without an end date the suspension has no end', async () => {
  let params: any[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, p) => {
      if (!sql.includes('user_suspensions')) return undefined;
      params = p;
      return { rowCount: 1, rows: [{ found: 1, changed: 1, suspended_at: '2026-11-16T00:00:00.000Z', suspended_until: null }] };
    },
    async (base) => {
      const res = await patchSuspend(base, { suspended: true, reason: SUSPEND_REASON });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).suspendedUntil, null);
    },
  );
  assert.deepEqual(params, [TARGET_ID, true, null, SUSPEND_REASON, ADMIN_ID]);
});

test('PATCH /api/admin/users/:id/suspend - refuses a missing or short reason and a bad end date, nothing is written', async () => {
  let writes = 0;
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('user_suspensions')) writes++;
      return undefined;
    },
    async (base) => {
      const bad: unknown[] = [
        { suspended: true },
        { suspended: true, reason: 'too short' }, // 9 characters
        { suspended: true, reason: 'x'.repeat(1001) },
        { suspended: true, reason: SUSPEND_REASON, until: 'next week' },
        { suspended: true, reason: SUSPEND_REASON, until: new Date(Date.now() - 60_000).toISOString() }, // in the past
        { suspended: true, reason: SUSPEND_REASON, until: inDays(366) }, // beyond 365 days
        { suspended: false, until: inDays(3) }, // restoring has no end date
        { suspended: false, reason: 'x'.repeat(1001) },
      ];
      for (const body of bad) {
        const res = await patchSuspend(base, body);
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal((await res.json()).error.code, 'INVALID_BODY', JSON.stringify(body));
      }
      assert.equal(writes, 0);
    },
  );
});

test('PATCH /api/admin/users/:id/suspend - restores a user; the reason is optional', async () => {
  const seen: any[][] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, p) => {
      if (!sql.includes('user_suspensions')) return undefined;
      seen.push(p);
      return { rowCount: 1, rows: [{ found: 1, changed: 1, suspended_at: null, suspended_until: null }] };
    },
    async (base) => {
      const noReason = await patchSuspend(base, { suspended: false });
      assert.equal(noReason.status, 200);
      assert.equal((await noReason.json()).isSuspended, false);
      const withReason = await patchSuspend(base, { suspended: false, reason: ' Appeal accepted. ' });
      assert.equal(withReason.status, 200);
    },
  );
  assert.deepEqual(seen[0], [TARGET_ID, false, null, null, ADMIN_ID]);
  assert.deepEqual(seen[1], [TARGET_ID, false, null, 'Appeal accepted.', ADMIN_ID]);
});

test('PATCH /api/admin/users/:id/suspend - restoring a user who is not suspended changes nothing and is not an error', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) =>
      sql.includes('user_suspensions')
        ? { rowCount: 1, rows: [{ found: 1, changed: 0, suspended_at: null, suspended_until: null }] }
        : undefined,
    async (base) => {
      const res = await patchSuspend(base, { suspended: false });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).isSuspended, false);
    },
  );
});

test('PATCH /api/admin/users/:id/suspend - admin cannot suspend self', async () => {
  let updated = false;
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('UPDATE users')) updated = true;
      return undefined;
    },
    async (base) => {
      const res = await fetch(`${base}/users/${ADMIN_ID}/suspend`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: true }),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, 'CANNOT_SUSPEND_SELF');
      assert.equal(updated, false);
    },
  );
});

test('PATCH /api/admin/users/:id/suspend - validates id and body, 404 for unknown user', async () => {
  await withServer(ACTIVE_ADMIN, () => undefined, async (base) => {
    const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };

    const badId = await fetch(`${base}/users/not-a-uuid/suspend`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ suspended: true }),
    });
    assert.equal(badId.status, 400);
    assert.equal((await badId.json()).error.code, 'INVALID_ID');

    const badBody = await fetch(`${base}/users/${TARGET_ID}/suspend`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ suspended: 'yes' }),
    });
    assert.equal(badBody.status, 400);
    assert.equal((await badBody.json()).error.code, 'INVALID_BODY');

    const missing = await fetch(`${base}/users/${TARGET_ID}/suspend`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ suspended: true, reason: 'A reason that is long enough.' }),
    });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'USER_NOT_FOUND');
  });
});

test('GET /api/admin/models - includes hidden and deleted models with owner info', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('COUNT(*)::int AS total FROM models')) return { rowCount: 1, rows: [{ total: 1 }] };
      if (sql.includes('FROM models m') && sql.includes('LIMIT')) {
        assert.equal(sql.includes('deleted_at IS NULL'), false);
        return {
          rowCount: 1,
          rows: [
            {
              id: MODEL_ID,
              title: 'Robot',
              license: 'COMMERCIAL',
              price_cents: 2900,
              currency: 'USD',
              view_count: '50',
              download_count: '3',
              hidden_at: '2026-11-10T00:00:00.000Z',
              deleted_at: '2026-11-11T00:00:00.000Z',
              created_at: '2026-11-01T00:00:00.000Z',
              owner_id: TARGET_ID,
              owner_name: 'Alice',
              owner_suspended_at: null,
            },
          ],
        };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.items[0].isHidden, true);
      assert.equal(body.items[0].isDeleted, true);
      assert.equal(body.items[0].owner.displayName, 'Alice');
      assert.equal(body.items[0].viewCount, 50);
    },
  );
});

test('GET /api/admin/models - status and license filters are combined with the search, values go in as parameters', async () => {
  const seen: { sql: string; params: any[] }[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('FROM models m')) seen.push({ sql, params });
      if (sql.includes('COUNT(*)::int AS total FROM models')) return { rowCount: 1, rows: [{ total: 0 }] };
    },
    async (base) => {
      const res = await fetch(`${base}/models?q=rob&status=hidden&license=CC-BY`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 200);
      assert.equal(seen.length, 2);
      for (const { sql } of seen) {
        assert.ok(sql.includes('m.deleted_at IS NULL AND m.hidden_at IS NOT NULL'));
        assert.ok(sql.includes('m.license = $2::license_type'));
      }
      assert.deepEqual(seen[0].params, ['%rob%', 'CC-BY']);

      seen.length = 0;
      await fetch(`${base}/models?status=deleted`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.ok(seen[0].sql.includes('m.deleted_at IS NOT NULL'));
      assert.deepEqual(seen[0].params, []);

      seen.length = 0;
      await fetch(`${base}/models?status=visible`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.ok(seen[0].sql.includes('m.deleted_at IS NULL AND m.hidden_at IS NULL'));
    },
  );
});

test('GET /api/admin/models - 400 for an unknown status or license, nothing is queried', async () => {
  let queried = false;
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('FROM models m')) queried = true;
      return undefined;
    },
    async (base) => {
      for (const qs of ['status=gone', 'license=MIT', "status=hidden'%20OR%201=1"]) {
        const res = await fetch(`${base}/models?${qs}`, { headers: { Authorization: `Bearer ${token()}` } });
        assert.equal(res.status, 400);
        assert.equal((await res.json()).error.code, 'INVALID_QUERY');
      }
      assert.equal(queried, false);
    },
  );
});

// ─── PATCH /api/admin/models/:id/hide (reason, history, notice to the owner) ────────
const HIDE_REASON = 'The preview shows content that is not allowed on the platform.';

function patchHide(base: string, body: unknown, id = MODEL_ID) {
  return fetch(`${base}/models/${id}/hide`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('PATCH /api/admin/models/:id/hide - hides with a reason, records it and notifies the owner in ONE statement', async () => {
  const statements: { sql: string; params: any[] }[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (!sql.includes('model_visibility_changes')) return undefined;
      statements.push({ sql, params });
      return { rowCount: 1, rows: [{ found: 1, changed: 1, hidden_at: '2026-11-16T00:00:00.000Z' }] };
    },
    async (base) => {
      const res = await patchHide(base, { hidden: true, reason: `  ${HIDE_REASON}  ` });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.isHidden, true);
      assert.equal(body.hiddenAt, '2026-11-16T00:00:00.000Z');
    },
  );
  assert.equal(statements.length, 1);
  const { sql, params } = statements[0];
  assert.match(sql, /UPDATE models/);
  assert.match(sql, /INSERT INTO model_visibility_changes/);
  assert.match(sql, /INSERT INTO notifications/);
  assert.match(sql, /FOR UPDATE/);
  // a deleted model is not hidden or restored (the owner already removed it), so it answers 404 like an unknown id
  assert.match(sql, /FROM models WHERE id = \$1 AND deleted_at IS NULL FOR UPDATE/);
  assert.deepEqual(params, [MODEL_ID, true, ADMIN_ID, HIDE_REASON]); // reason trimmed, admin from the token
});

test('PATCH /api/admin/models/:id/hide - hiding needs a written reason; restoring may have one', async () => {
  let writes = 0;
  const restoreParams: any[][] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, p) => {
      if (!sql.includes('model_visibility_changes')) return undefined;
      if (p[1] === true) writes++;
      else restoreParams.push(p);
      return { rowCount: 1, rows: [{ found: 1, changed: 1, hidden_at: null }] };
    },
    async (base) => {
      for (const body of [{ hidden: true }, { hidden: true, reason: 'too short' }, { hidden: true, reason: 'x'.repeat(1001) }, { hidden: false, reason: 'x'.repeat(1001) }, {}, { hidden: 'yes' }]) {
        const res = await patchHide(base, body);
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal((await res.json()).error.code, 'INVALID_BODY', JSON.stringify(body));
      }
      assert.equal(writes, 0);
      assert.equal((await patchHide(base, { hidden: false })).status, 200);
      assert.equal((await patchHide(base, { hidden: false, reason: ' Checked again, it is fine. ' })).status, 200);
    },
  );
  assert.deepEqual(restoreParams[0], [MODEL_ID, false, ADMIN_ID, null]);
  assert.deepEqual(restoreParams[1], [MODEL_ID, false, ADMIN_ID, 'Checked again, it is fine.']);
});

test('PATCH /api/admin/models/:id/hide - 404 for an unknown model, 400 for a bad id, and a no-op is not an error or a second notice', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => (sql.includes('model_visibility_changes') ? { rowCount: 1, rows: [{ found: 0, changed: 0, hidden_at: null }] } : undefined),
    async (base) => {
      const missing = await patchHide(base, { hidden: true, reason: HIDE_REASON });
      assert.equal(missing.status, 404);
      assert.equal((await missing.json()).error.code, 'MODEL_NOT_FOUND');
      assert.equal((await patchHide(base, { hidden: true, reason: HIDE_REASON }, 'not-a-uuid')).status, 400);
    },
  );
  // already hidden: nothing changes, so no second history row or notice is made, and the answer is still the current state
  await withServer(
    ACTIVE_ADMIN,
    (sql) =>
      sql.includes('model_visibility_changes')
        ? { rowCount: 1, rows: [{ found: 1, changed: 0, hidden_at: '2026-11-16T00:00:00.000Z' }] }
        : undefined,
    async (base) => {
      const res = await patchHide(base, { hidden: true, reason: HIDE_REASON });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).isHidden, true);
    },
  );
});

test('GET /api/admin/purchases - returns buyer, model and watermark, never the embed key', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('COUNT(*)::int AS total FROM purchases')) return { rowCount: 1, rows: [{ total: 1 }] };
      if (sql.includes('FROM purchases p') && sql.includes('LIMIT')) {
        assert.equal(sql.includes('embed_key'), false);
        return {
          rowCount: 1,
          rows: [
            {
              id: 'p-1',
              status: 'paid',
              amount_cents: 2900,
              currency: 'USD',
              license_type: 'COMMERCIAL',
              watermark_hash: 'abc123',
              paid_at: '2026-11-12T00:00:00.000Z',
              created_at: '2026-11-12T00:00:00.000Z',
              buyer_id: TARGET_ID,
              buyer_email: 'bob@example.com',
              buyer_name: 'Bob',
              model_id: MODEL_ID,
              model_title: 'Robot',
            },
          ],
        };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/purchases`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.items[0].watermarkHash, 'abc123');
      assert.equal(body.items[0].buyer.email, 'bob@example.com');
      assert.equal(body.items[0].model.title, 'Robot');
      assert.equal('embedKey' in body.items[0], false);
    },
  );
});

const COMPLAINT_ID = '44444444-4444-4444-8444-444444444444';

test('GET /api/admin/complaints - lists complaints with reporter, model and owner, filtered by status', async () => {
  let listParams: any[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('COUNT(*)::int AS total FROM complaints')) return { rowCount: 1, rows: [{ total: 1 }] };
      if (sql.includes('FROM complaints c') && sql.includes('LIMIT')) {
        listParams = params;
        assert.equal(sql.includes('c.status = $1'), true);
        return {
          rowCount: 1,
          rows: [
            {
              id: COMPLAINT_ID,
              category: 'model',
              message: 'This model is stolen from another site.',
              status: 'open',
              admin_note: null,
              handled_at: null,
              created_at: '2026-11-16T00:00:00.000Z',
              reporter_id: TARGET_ID,
              reporter_name: 'Bob',
              reporter_email: 'bob@example.com',
              model_id: MODEL_ID,
              model_title: 'Robot',
              model_hidden_at: null,
              owner_id: ADMIN_ID,
              owner_name: 'Alice',
              owner_suspended_at: null,
              handled_by_name: null,
            },
          ],
        };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/complaints?status=open`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.total, 1);
      assert.equal(body.items[0].category, 'model');
      assert.equal(body.items[0].reporter.email, 'bob@example.com');
      assert.equal(body.items[0].model.title, 'Robot');
      assert.equal(body.items[0].model.isHidden, false);
      assert.equal(body.items[0].owner.displayName, 'Alice');
      assert.deepEqual(listParams, ['open', 25, 0]);
    },
  );
});

test('GET /api/admin/complaints - rejects an unknown status', async () => {
  await withServer(ACTIVE_ADMIN, () => undefined, async (base) => {
    const res = await fetch(`${base}/complaints?status=bogus`, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'INVALID_QUERY');
  });
});

test('PATCH /api/admin/complaints/:id - resolves with a note and records the admin', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('UPDATE complaints')) {
        assert.deepEqual(params, [COMPLAINT_ID, 'resolved', true, 'Hidden the model.', true, ADMIN_ID]);
        return {
          rowCount: 1,
          rows: [{ id: COMPLAINT_ID, status: 'resolved', admin_note: 'Hidden the model.', handled_at: '2026-11-16T01:00:00.000Z' }],
        };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/complaints/${COMPLAINT_ID}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', adminNote: 'Hidden the model.' }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.status, 'resolved');
      assert.equal(body.adminNote, 'Hidden the model.');
    },
  );
});

test('PATCH /api/admin/complaints/:id - status only keeps the note; reopening clears the handler', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('UPDATE complaints')) {
        assert.deepEqual(params, [COMPLAINT_ID, 'open', false, null, false, ADMIN_ID]);
        return { rowCount: 1, rows: [{ id: COMPLAINT_ID, status: 'open', admin_note: 'old note', handled_at: null }] };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/complaints/${COMPLAINT_ID}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open' }),
      });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).handledAt, null);
    },
  );
});

test('PATCH /api/admin/complaints/:id - closing it notifies the reporter in the SAME statement, only on a real change to resolved/dismissed', async () => {
  const statements: string[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('UPDATE complaints')) {
        statements.push(sql);
        return {
          rowCount: 1,
          rows: [{ id: COMPLAINT_ID, status: 'resolved', admin_note: 'Hidden the model.', handled_at: '2026-11-16T01:00:00.000Z', notified: true }],
        };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/complaints/${COMPLAINT_ID}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', adminNote: 'Hidden the model.' }),
      });
      assert.equal(res.status, 200);
      assert.equal((await res.json()).reporterNotified, true);
    },
  );
  assert.equal(statements.length, 1);
  const sql = statements[0];
  assert.match(sql, /INSERT INTO notifications/);
  assert.match(sql, /'complaint_' \|\| upd\.status/);
  assert.match(sql, /upd\.status IN \('resolved', 'dismissed'\) AND old\.status <> upd\.status/); // not again for the same result
  assert.match(sql, /u\.deleted_at IS NULL/); // a deleted reporter gets nothing
  assert.match(sql, /FOR UPDATE/);
});

test('PATCH /api/admin/complaints/:id - reporterNotified is false when the statement inserted no notice', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('UPDATE complaints')) {
        return { rowCount: 1, rows: [{ id: COMPLAINT_ID, status: 'in_review', admin_note: null, handled_at: '2026-11-16T01:00:00.000Z', notified: false }] };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/complaints/${COMPLAINT_ID}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_review' }),
      });
      assert.equal((await res.json()).reporterNotified, false);
    },
  );
});

test('PATCH /api/admin/complaints/:id - validates id, status and 404', async () => {
  await withServer(ACTIVE_ADMIN, () => undefined, async (base) => {
    const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };
    const badId = await fetch(`${base}/complaints/nope`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'open' }) });
    assert.equal(badId.status, 400);
    const badStatus = await fetch(`${base}/complaints/${COMPLAINT_ID}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'done' }) });
    assert.equal(badStatus.status, 400);
    assert.equal((await badStatus.json()).error.code, 'INVALID_BODY');
    const missing = await fetch(`${base}/complaints/${COMPLAINT_ID}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'dismissed' }) });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'COMPLAINT_NOT_FOUND');
  });
});

// ─── PATCH /api/admin/models/:id/license ────────────────────────────────────
const LICENSE_REASON = 'The files are copied from a commercial pack, so CC0 is not allowed.';

function patchLicense(base: string, body: unknown) {
  return fetch(`${base}/models/${MODEL_ID}/license`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('PATCH /api/admin/models/:id/license - 400 for a bad body, nothing is written', async () => {
  let writes = 0;
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('model_license_changes')) writes++;
      return undefined;
    },
    async (base) => {
      const short = await patchLicense(base, { license: 'COMMERCIAL', reason: 'too short' }); // 9 characters
      assert.equal(short.status, 400);
      const spaces = await patchLicense(base, { license: 'COMMERCIAL', reason: '           ' });
      assert.equal(spaces.status, 400);
      const long = await patchLicense(base, { license: 'COMMERCIAL', reason: 'x'.repeat(1001) });
      assert.equal(long.status, 400);
      const unknown = await patchLicense(base, { license: 'MIT', reason: LICENSE_REASON });
      assert.equal(unknown.status, 400);
      assert.equal((await unknown.json()).error.code, 'INVALID_BODY');
      assert.equal(writes, 0);
    },
  );
});

test('PATCH /api/admin/models/:id/license - 400 for an invalid id, 403 for a non-admin', async () => {
  await withServer(ACTIVE_ADMIN, () => undefined, async (base) => {
    const res = await fetch(`${base}/models/not-a-uuid/license`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: 'COMMERCIAL', reason: LICENSE_REASON }),
    });
    assert.equal(res.status, 400);
  });
  await withServer({ role: 'user', suspended_at: null }, () => undefined, async (base) => {
    const res = await patchLicense(base, { license: 'COMMERCIAL', reason: LICENSE_REASON });
    assert.equal(res.status, 403);
  });
});

test('PATCH /api/admin/models/:id/license - 404 for an unknown or deleted model', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => (sql.includes('model_license_changes') ? { rowCount: 1, rows: [{ found: 0, changed: 0, old_license: null }] } : undefined),
    async (base) => {
      const res = await patchLicense(base, { license: 'COMMERCIAL', reason: LICENSE_REASON });
      assert.equal(res.status, 404);
      assert.equal((await res.json()).error.code, 'MODEL_NOT_FOUND');
    },
  );
});

test('PATCH /api/admin/models/:id/license - 400 when the license is already that value', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => (sql.includes('model_license_changes') ? { rowCount: 1, rows: [{ found: 1, changed: 0, old_license: null }] } : undefined),
    async (base) => {
      const res = await patchLicense(base, { license: 'CC0', reason: LICENSE_REASON });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).error.code, 'LICENSE_UNCHANGED');
    },
  );
});

test('PATCH /api/admin/models/:id/license - changes, records and notifies in ONE statement', async () => {
  const statements: { sql: string; params: any[] }[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (!sql.includes('model_license_changes')) return undefined;
      statements.push({ sql, params });
      return { rowCount: 1, rows: [{ found: 1, changed: 1, old_license: 'CC0' }] };
    },
    async (base) => {
      const res = await patchLicense(base, { license: 'COMMERCIAL', reason: `  ${LICENSE_REASON}  ` });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { id: MODEL_ID, license: 'COMMERCIAL' });
    },
  );
  assert.equal(statements.length, 1);
  const { sql, params } = statements[0];
  assert.match(sql, /UPDATE models/);
  assert.match(sql, /INSERT INTO model_license_changes/);
  assert.match(sql, /INSERT INTO notifications/);
  assert.match(sql, /FOR UPDATE/);
  assert.deepEqual(params, [MODEL_ID, 'COMMERCIAL', ADMIN_ID, LICENSE_REASON]); // reason is trimmed, admin comes from the token
});

// ─── GET /api/admin/purchases filters and GET /api/admin/purchases/:id ──────
const PURCHASE_ID = '66666666-6666-4666-8666-666666666666';
const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

test('GET /api/admin/purchases - rejects a bad status or date with 400 and queries nothing', async () => {
  let queries = 0;
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('FROM purchases p')) queries++;
      return undefined;
    },
    async (base) => {
      for (const qs of ['status=refunded', 'from=2026-13-40', 'to=yesterday', 'from=2026-11-30&to=2026-11-01']) {
        const res = await fetch(`${base}/purchases?${qs}`, { headers: authHeaders() });
        assert.equal(res.status, 400, qs);
        assert.equal((await res.json()).error.code, 'INVALID_QUERY', qs);
      }
      assert.equal(queries, 0);
    },
  );
});

test('GET /api/admin/purchases - filters by status and by an inclusive date range, together with the search', async () => {
  const seen: { sql: string; params: any[] }[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('COUNT(*)::int AS total FROM purchases')) {
        seen.push({ sql, params });
        return { rowCount: 1, rows: [{ total: 0 }] };
      }
      if (sql.includes('FROM purchases p') && sql.includes('LIMIT')) {
        seen.push({ sql, params });
        return { rowCount: 0, rows: [] };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/purchases?status=paid&from=2026-11-01&to=2026-11-30&q=bob`, { headers: authHeaders() });
      assert.equal(res.status, 200);
    },
  );
  assert.equal(seen.length, 2);
  for (const { sql } of seen) {
    assert.match(sql, /p\.status = \$\d+::purchase_status/);
    assert.match(sql, /p\.created_at >= \$\d+::date/);
    assert.match(sql, /p\.created_at < \(\$\d+::date \+ 1\)/); // the last day is included
    assert.match(sql, /ILIKE/);
  }
  assert.deepEqual(seen[0].params, ['%bob%', 'paid', '2026-11-01', '2026-11-30']);
  assert.deepEqual(seen[1].params.slice(0, 4), ['%bob%', 'paid', '2026-11-01', '2026-11-30']);
});

test('GET /api/admin/purchases/:id - 400 for a bad id, 404 for an unknown purchase, 403 for a non-admin', async () => {
  await withServer(ACTIVE_ADMIN, () => undefined, async (base) => {
    assert.equal((await fetch(`${base}/purchases/nope`, { headers: authHeaders() })).status, 400);
    const missing = await fetch(`${base}/purchases/${PURCHASE_ID}`, { headers: authHeaders() });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'PURCHASE_NOT_FOUND');
  });
  await withServer({ role: 'user', suspended_at: null }, () => undefined, async (base) => {
    assert.equal((await fetch(`${base}/purchases/${PURCHASE_ID}`, { headers: authHeaders() })).status, 403);
  });
});

test('GET /api/admin/purchases/:id - returns the full detail and never the embed key', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('FROM purchases p') && sql.includes('WHERE p.id = $1')) {
        assert.equal(sql.includes('embed_key'), false);
        assert.deepEqual(params, [PURCHASE_ID]);
        return {
          rowCount: 1,
          rows: [
            {
              id: PURCHASE_ID,
              status: 'paid',
              amount_cents: 2900,
              currency: 'USD',
              license_type: 'COMMERCIAL',
              watermark_hash: 'abc123',
              provider_session_id: 'mock_sess_1',
              paid_at: '2026-11-12T01:00:00.000Z',
              created_at: '2026-11-12T00:00:00.000Z',
              buyer_id: TARGET_ID,
              buyer_email: 'bob@example.com',
              buyer_name: 'Bob',
              buyer_suspended_at: null,
              model_id: MODEL_ID,
              model_title: 'Robot',
              model_license: 'CC-BY',
              model_hidden_at: '2026-11-13T00:00:00.000Z',
              model_deleted_at: null,
              owner_id: ADMIN_ID,
              owner_email: 'owner@example.com',
              owner_name: 'Owner',
            },
          ],
        };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/purchases/${PURCHASE_ID}`, { headers: authHeaders() });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.id, PURCHASE_ID);
      assert.equal(body.licenseType, 'COMMERCIAL');
      assert.equal(body.model.currentLicense, 'CC-BY'); // differs from the license locked at purchase
      assert.equal(body.model.isHidden, true);
      assert.equal(body.model.isDeleted, false);
      assert.equal(body.providerSessionId, 'mock_sess_1');
      assert.equal(body.watermarkHash, 'abc123');
      assert.equal(body.buyer.isSuspended, false);
      assert.deepEqual(body.owner, { id: ADMIN_ID, email: 'owner@example.com', displayName: 'Owner' });
      assert.equal(JSON.stringify(body).includes('embed'), false);
    },
  );
});

// ─── an admin cannot be suspended by another admin ───────────────────────────
test('PATCH /api/admin/users/:id/suspend - refuses to suspend another admin, but may restore one', async () => {
  const OTHER_ADMIN = '77777777-7777-4777-8777-777777777777';
  await withServer(
    ACTIVE_ADMIN,
    (sql) =>
      sql.includes('user_suspensions')
        ? { rowCount: 1, rows: [{ found: 1, changed: 0, target_role: 'admin', suspended_at: null, suspended_until: null }] }
        : undefined,
    async (base) => {
      const res = await patchSuspend(base, { suspended: true, reason: SUSPEND_REASON }, OTHER_ADMIN);
      assert.equal(res.status, 403);
      assert.equal((await res.json()).error.code, 'CANNOT_SUSPEND_ADMIN');
    },
  );
  const statements: string[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (!sql.includes('user_suspensions')) return undefined;
      statements.push(sql);
      return { rowCount: 1, rows: [{ found: 1, changed: 1, target_role: 'admin', suspended_at: null, suspended_until: null }] };
    },
    async (base) => {
      // an admin who was suspended before this rule existed must be restorable
      const res = await patchSuspend(base, { suspended: false }, OTHER_ADMIN);
      assert.equal(res.status, 200);
    },
  );
  assert.match(statements[0], /old\.role <> 'admin'/); // the rule lives in the SQL, not only in the check after it
});

// ─── history that the admin can read ─────────────────────────────────────────
test('GET /api/admin/users/:id/suspensions - 400 for a bad id, otherwise the history, newest first, with the admin who acted', async () => {
  let params: any[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, p) => {
      if (!sql.includes('FROM user_suspensions')) return undefined;
      params = p;
      assert.match(sql, /ORDER BY s\.created_at DESC/);
      assert.match(sql, /LIMIT 50/);
      return {
        rowCount: 2,
        rows: [
          { id: 'h2', action: 'expire', reason: null, until: '2026-11-25T00:00:00.000Z', created_at: '2026-11-25T00:00:01.000Z', admin_id: null, admin_name: null },
          { id: 'h1', action: 'suspend', reason: SUSPEND_REASON, until: '2026-11-25T00:00:00.000Z', created_at: '2026-11-18T00:00:00.000Z', admin_id: ADMIN_ID, admin_name: 'Admin' },
        ],
      };
    },
    async (base) => {
      const bad = await fetch(`${base}/users/nope/suspensions`, { headers: authHeaders() });
      assert.equal(bad.status, 400);
      const res = await fetch(`${base}/users/${TARGET_ID}/suspensions`, { headers: authHeaders() });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.items.length, 2);
      assert.deepEqual(body.items[0], { id: 'h2', action: 'expire', reason: null, until: '2026-11-25T00:00:00.000Z', createdAt: '2026-11-25T00:00:01.000Z', admin: null });
      assert.deepEqual(body.items[1].admin, { id: ADMIN_ID, displayName: 'Admin' });
      assert.equal(body.items[1].reason, SUSPEND_REASON);
    },
  );
  assert.deepEqual(params, [TARGET_ID]);
});

test('GET /api/admin/models/:id/history - 400 for a bad id, otherwise license and visibility changes together, newest first', async () => {
  let params: any[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, p) => {
      if (!sql.includes('FROM model_license_changes')) return undefined;
      params = p;
      assert.match(sql, /FROM model_visibility_changes/);
      assert.match(sql, /UNION ALL/);
      assert.match(sql, /ORDER BY created_at DESC/);
      assert.match(sql, /LIMIT 50/);
      return {
        rowCount: 2,
        rows: [
          { kind: 'visibility', id: 'v1', old_license: null, new_license: null, action: 'hide', reason: HIDE_REASON, created_at: '2026-11-20T00:00:00.000Z', admin_id: ADMIN_ID, admin_name: 'Admin' },
          { kind: 'license', id: 'c1', old_license: 'CC0', new_license: 'COMMERCIAL', action: null, reason: LICENSE_REASON, created_at: '2026-11-19T00:00:00.000Z', admin_id: null, admin_name: null },
        ],
      };
    },
    async (base) => {
      assert.equal((await fetch(`${base}/models/nope/history`, { headers: authHeaders() })).status, 400);
      const res = await fetch(`${base}/models/${MODEL_ID}/history`, { headers: authHeaders() });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body.items, [
        { kind: 'visibility', id: 'v1', action: 'hide', reason: HIDE_REASON, createdAt: '2026-11-20T00:00:00.000Z', admin: { id: ADMIN_ID, displayName: 'Admin' } },
        { kind: 'license', id: 'c1', oldLicense: 'CC0', newLicense: 'COMMERCIAL', reason: LICENSE_REASON, createdAt: '2026-11-19T00:00:00.000Z', admin: null },
      ]);
    },
  );
  assert.deepEqual(params, [MODEL_ID]);
});

// ─── creator applications (atomic CTE + notification + guards) & invite codes ───
test('PATCH /api/admin/creator-applications/:id - validates UUID, approves atomically, and blocks non-pending/admin/suspended', async () => {
  const APP_ID = '88888888-8888-4888-8888-888888888888';
  let cteRow: Record<string, any> = {
    found: 1,
    prev_status: 'pending',
    user_role: 'user',
    user_suspended_at: null,
    user_deleted_at: null,
    id: APP_ID,
    user_id: TARGET_ID,
    status: 'approved',
    admin_note: 'Looks great',
    reviewed_at: '2026-11-20T00:00:00.000Z',
  };
  let sawAtomicSql = false;

  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('WITH target AS') && sql.includes('creator_applications')) {
        sawAtomicSql = sql.includes('FOR UPDATE OF ca, u') && sql.includes('INSERT INTO notifications');
        return { rowCount: 1, rows: [cteRow] };
      }
      return undefined;
    },
    async (base) => {
      // 1. Bad UUID -> 400
      const badId = await fetch(`${base}/creator-applications/not-a-uuid`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.equal(badId.status, 400);

      // 2. Approve pending user -> 200 via atomic CTE
      const ok = await fetch(`${base}/creator-applications/${APP_ID}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', adminNote: 'Looks great' }),
      });
      assert.equal(ok.status, 200);
      assert.equal(sawAtomicSql, true);
      const body = await ok.json();
      assert.equal(body.application.status, 'approved');

      // 3. Already reviewed -> 409
      cteRow = { ...cteRow, prev_status: 'approved', id: null };
      const dup = await fetch(`${base}/creator-applications/${APP_ID}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.equal(dup.status, 409);
      assert.equal((await dup.json()).error.code, 'ALREADY_REVIEWED');

      // 4. Cannot approve suspended applicant -> 403
      cteRow = { ...cteRow, prev_status: 'pending', user_suspended_at: '2026-11-19T00:00:00.000Z', id: null };
      const susp = await fetch(`${base}/creator-applications/${APP_ID}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.equal(susp.status, 403);
      assert.equal((await susp.json()).error.code, 'ACCOUNT_SUSPENDED');
    },
  );
});

test('POST /api/admin/invite-codes - generates cryptographic code and returns 409 on duplicate', async () => {
  let insertedCode = '';
  let forceDuplicate = false;

  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('INSERT INTO creator_invite_codes')) {
        if (forceDuplicate) {
          const err: any = new Error('duplicate key');
          err.code = '23505';
          throw err;
        }
        insertedCode = params[0];
        return {
          rowCount: 1,
          rows: [
            {
              id: 'code-1',
              code: params[0],
              max_uses: params[1],
              used_count: 0,
              expires_at: params[3],
              created_at: '2026-11-20T00:00:00.000Z',
            },
          ],
        };
      }
      return undefined;
    },
    async (base) => {
      // 1. Default generated code has 12 uppercase hex chars (crypto.randomBytes(6))
      const res = await fetch(`${base}/invite-codes`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxUses: 3 }),
      });
      assert.equal(res.status, 201);
      assert.match(insertedCode, /^LIXYTE-[0-9A-F]{12}$/);

      // 2. Invalid custom code rejected with 400
      const bad = await fetch(`${base}/invite-codes`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'x' }),
      });
      assert.equal(bad.status, 400);

      // 3. Duplicate code -> 409 CODE_EXISTS
      forceDuplicate = true;
      const dup = await fetch(`${base}/invite-codes`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'LIXYTE-VIP2026' }),
      });
      assert.equal(dup.status, 409);
      assert.equal((await dup.json()).error.code, 'CODE_EXISTS');
    },
  );
});

const WITHDRAWAL_ID = '77777777-7777-4777-8777-777777777777';

test('GET /api/admin/withdrawals - lists paginated withdrawals with seller info and status filter', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('COUNT(*)::int AS total FROM creator_withdrawals')) {
        return { rowCount: 1, rows: [{ total: 1 }] };
      }
      if (sql.includes('FROM creator_withdrawals w') && sql.includes('LIMIT')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: WITHDRAWAL_ID,
              seller_id: TARGET_ID,
              gross_amount_cents: 5000,
              platform_fee_cents: 350,
              net_amount_cents: 4650,
              fee_rate_bps: 700,
              currency: 'USD',
              payout_method: 'promptpay',
              payout_account: '081-234-5678',
              status: 'pending',
              created_at: '2026-11-20T00:00:00.000Z',
              processed_at: null,
              seller_name: 'Demo Creator',
              seller_email: 'creator@example.com',
            },
          ],
        };
      }
      return undefined;
    },
    async (base) => {
      const bad = await fetch(`${base}/withdrawals?status=bogus`, { headers: authHeaders() });
      assert.equal(bad.status, 400);

      const res = await fetch(`${base}/withdrawals?status=pending`, { headers: authHeaders() });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.total, 1);
      assert.equal(body.items[0].id, WITHDRAWAL_ID);
      assert.equal(body.items[0].netAmountCents, 4650);
      assert.equal(body.items[0].seller.displayName, 'Demo Creator');
    },
  );
});

test('PATCH /api/admin/withdrawals/:id - transitions atomically with notification and rejects finalized transitions', async () => {
  let mockRow: any = {
    found: 1,
    prev_status: 'pending',
    id: WITHDRAWAL_ID,
    status: 'paid',
    processed_at: '2026-11-20T01:00:00.000Z',
  };
  let sawAtomicCte = false;

  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('FROM creator_withdrawals') && sql.includes('FOR UPDATE')) {
        sawAtomicCte = sql.includes('INSERT INTO notifications');
        return { rowCount: 1, rows: [mockRow] };
      }
      return undefined;
    },
    async (base) => {
      const badId = await fetch(`${base}/withdrawals/not-a-uuid`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      assert.equal(badId.status, 400);

      const ok = await fetch(`${base}/withdrawals/${WITHDRAWAL_ID}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      assert.equal(ok.status, 200);
      assert.equal(sawAtomicCte, true);
      assert.equal((await ok.json()).status, 'paid');

      // Already paid -> 409 INVALID_TRANSITION
      mockRow = { found: 1, prev_status: 'paid', id: null, status: null, processed_at: null };
      const conflict = await fetch(`${base}/withdrawals/${WITHDRAWAL_ID}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      assert.equal(conflict.status, 409);
      assert.equal((await conflict.json()).error.code, 'INVALID_TRANSITION');
    },
  );
});

// ─── DELETE /api/admin/users/:id (soft delete, history stays, email is freed) ──────────
const DELETE_REASON = 'Account used to resell stolen models, confirmed by two complaints.';

function deleteUser(base: string, body: unknown, id = TARGET_ID) {
  return fetch(`${base}/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// the row the delete statement reports back
const deleteRow = (o: Partial<{ found: number; changed: number; already_deleted: boolean | null }> = {}) => ({
  rowCount: 1,
  rows: [{ found: 1, changed: 1, already_deleted: false, ...o }],
});

test('DELETE /api/admin/users/:id - soft deletes in ONE statement, keeps the real email and frees the address', async () => {
  const statements: { sql: string; params: any[] }[] = [];
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (!sql.includes('SET deleted_at = NOW()')) return undefined;
      statements.push({ sql, params });
      return deleteRow();
    },
    async (base) => {
      const res = await deleteUser(base, { reason: `  ${DELETE_REASON}  ` });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { id: TARGET_ID, isDeleted: true });
    },
  );
  assert.equal(statements.length, 1);
  const { sql, params } = statements[0];
  assert.match(sql, /UPDATE users/);
  assert.match(sql, /original_email = old\.email/); // the real address is kept for the history
  assert.match(sql, /email = 'deleted-' \|\| old\.id::text \|\| '@deleted\.invalid'/); // a unique placeholder frees the address
  assert.match(sql, /password_hash = '!deleted'/);
  assert.match(sql, /old\.role <> 'admin'/);
  assert.match(sql, /old\.deleted_at IS NULL/);
  assert.match(sql, /FOR UPDATE/);
  assert.doesNotMatch(sql, /DELETE FROM/); // nothing is removed, so every purchase, model and complaint stays
  assert.deepEqual(params, [TARGET_ID, ADMIN_ID, DELETE_REASON]); // reason trimmed, admin from the token
});

test('DELETE /api/admin/users/:id - needs a written reason of 10 to 1000 characters', async () => {
  let touched = false;
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('SET deleted_at')) touched = true;
      return undefined;
    },
    async (base) => {
      for (const body of [{}, { reason: '' }, { reason: 'too short' }, { reason: 'x'.repeat(1001) }, { reason: 42 }]) {
        const res = await deleteUser(base, body);
        assert.equal(res.status, 400);
        assert.equal((await res.json()).error.code, 'INVALID_BODY');
      }
    },
  );
  assert.equal(touched, false);
});

test('DELETE /api/admin/users/:id - an admin cannot delete their own account, and a bad id is refused', async () => {
  let touched = false;
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('SET deleted_at')) touched = true;
      return undefined;
    },
    async (base) => {
      const self = await deleteUser(base, { reason: DELETE_REASON }, ADMIN_ID);
      assert.equal(self.status, 400);
      assert.equal((await self.json()).error.code, 'CANNOT_DELETE_SELF');
      const bad = await deleteUser(base, { reason: DELETE_REASON }, 'not-a-uuid');
      assert.equal(bad.status, 400);
      assert.equal((await bad.json()).error.code, 'INVALID_ID');
    },
  );
  assert.equal(touched, false);
});

test('DELETE /api/admin/users/:id - 404 for an unknown user, 403 for an admin, 409 when already deleted', async () => {
  const cases: { row: ReturnType<typeof deleteRow>; status: number; code: string }[] = [
    { row: deleteRow({ found: 0, changed: 0, already_deleted: null }), status: 404, code: 'USER_NOT_FOUND' },
    { row: deleteRow({ changed: 0, already_deleted: false }), status: 403, code: 'CANNOT_DELETE_ADMIN' },
    { row: deleteRow({ changed: 0, already_deleted: true }), status: 409, code: 'ALREADY_DELETED' },
  ];
  for (const c of cases) {
    await withServer(
      ACTIVE_ADMIN,
      (sql) => (sql.includes('SET deleted_at = NOW()') ? c.row : undefined),
      async (base) => {
        const res = await deleteUser(base, { reason: DELETE_REASON });
        assert.equal(res.status, c.status);
        assert.equal((await res.json()).error.code, c.code);
      },
    );
  }
});

test('DELETE /api/admin/users/:id - only an active admin (checked in the database) can delete', async () => {
  let touched = false;
  const handler = (sql: string) => {
    if (sql.includes('SET deleted_at')) touched = true;
    return undefined;
  };
  await withServer({ role: 'user', suspended_at: null }, handler, async (base) => {
    const res = await deleteUser(base, { reason: DELETE_REASON });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error.code, 'FORBIDDEN');
  });
  await withServer({ role: 'admin', suspended_at: '2026-11-01T00:00:00.000Z' }, handler, async (base) => {
    const res = await deleteUser(base, { reason: DELETE_REASON });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error.code, 'ACCOUNT_SUSPENDED');
  });
  assert.equal(touched, false);
});

test('admin routes - an admin whose own account was deleted is refused with 401 ACCOUNT_DELETED', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => (sql.includes('SELECT deleted_at FROM users') ? { rowCount: 1, rows: [{ deleted_at: '2026-11-20T00:00:00.000Z' }] } : undefined),
    async (base) => {
      const res = await fetch(`${base}/overview`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, 'ACCOUNT_DELETED');
    },
  );
});

// ─── GET /api/admin/notifications (what waits for an admin) ──────────────────────────
test('GET /api/admin/notifications/summary - counts pending applications and open complaints', async () => {
  let sql = '';
  await withServer(
    ACTIVE_ADMIN,
    (q) => {
      if (!q.includes('AS creator_applications')) return undefined;
      sql = q;
      return { rowCount: 1, rows: [{ creator_applications: 3, complaints: 2 }] };
    },
    async (base) => {
      const res = await fetch(`${base}/notifications/summary`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { creatorApplications: 3, complaints: 2, total: 5 });
    },
  );
  assert.match(sql, /ca\.status = 'pending'/);
  assert.match(sql, /u\.deleted_at IS NULL/); // an applicant whose account was deleted is not waiting for anyone
  assert.match(sql, /status = 'open'/);
});

test('GET /api/admin/notifications - lists the waiting items newest first with the counts, and needs an admin', async () => {
  let feedSql = '';
  await withServer(
    ACTIVE_ADMIN,
    (q) => {
      if (q.includes('AS creator_applications') && !q.includes('UNION')) {
        return { rowCount: 1, rows: [{ creator_applications: 1, complaints: 1 }] };
      }
      if (q.includes('UNION ALL')) {
        feedSql = q;
        return {
          rowCount: 2,
          rows: [
            { kind: 'complaint', id: 'c1', created_at: '2026-11-20T10:00:00.000Z', person_id: TARGET_ID, person_name: 'Bob', person_email: 'bob@example.com', text: 'x'.repeat(400), category: 'copyright', model_title: 'Robot' },
            { kind: 'creator_application', id: 'a1', created_at: '2026-11-19T10:00:00.000Z', person_id: TARGET_ID, person_name: 'Alice', person_email: 'alice@example.com', text: 'I make robots', category: null, model_title: null },
          ],
        };
      }
      return undefined;
    },
    async (base) => {
      const res = await fetch(`${base}/notifications`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body.counts, { creatorApplications: 1, complaints: 1, total: 2 });
      assert.equal(body.items.length, 2);
      assert.equal(body.items[0].kind, 'complaint');
      assert.equal(body.items[0].text.length, 300); // long messages are cut for the list
      assert.equal(body.items[0].modelTitle, 'Robot');
      assert.deepEqual(body.items[1].person, { id: TARGET_ID, displayName: 'Alice', email: 'alice@example.com' });
      assert.equal(JSON.stringify(body).includes('password'), false);
    },
  );
  assert.match(feedSql, /ORDER BY created_at DESC/);
  assert.match(feedSql, /LIMIT 50/);
  assert.match(feedSql, /ca\.status = 'pending' AND u\.deleted_at IS NULL/);

  await withServer({ role: 'user', suspended_at: null }, () => undefined, async (base) => {
    const res = await fetch(`${base}/notifications`, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(res.status, 403);
    const sum = await fetch(`${base}/notifications/summary`, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(sum.status, 403);
  });
});

test('creator applications - an application of a deleted account is not listed and cannot be approved', async () => {
  let listSql = '';
  let patchSql = '';
  const APP_ID = '66666666-6666-4666-8666-666666666666';
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('FROM creator_applications ca') && sql.includes('LIMIT 100')) {
        listSql = sql;
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('WITH target AS') && sql.includes('creator_applications')) {
        patchSql = sql;
        return {
          rowCount: 1,
          rows: [
            {
              found: 1,
              prev_status: 'pending',
              user_role: 'user',
              user_suspended_at: null,
              user_deleted_at: '2026-11-20T00:00:00.000Z',
              id: null,
              user_id: null,
              status: null,
              admin_note: null,
              reviewed_at: null,
            },
          ],
        };
      }
      return undefined;
    },
    async (base) => {
      const list = await fetch(`${base}/creator-applications`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(list.status, 200);
      const res = await fetch(`${base}/creator-applications/${APP_ID}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.equal(res.status, 409);
      assert.equal((await res.json()).error.code, 'ACCOUNT_DELETED');
    },
  );
  assert.match(listSql, /u\.deleted_at IS NULL/);
  assert.match(patchSql, /t\.user_deleted_at IS NULL/); // neither the application nor the user is updated when deleted
});

test('GET /api/admin/users - a deleted account shows the address it had, not the placeholder, and can be searched by it', async () => {
  let where = '';
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('COUNT(*)::int AS total FROM users')) return { rowCount: 1, rows: [{ total: 1 }] };
      if (sql.includes('FROM users') && sql.includes('LIMIT')) {
        where = sql;
        return {
          rowCount: 1,
          rows: [
            {
              id: TARGET_ID,
              email: `deleted-${TARGET_ID}@deleted.invalid`,
              original_email: 'alice@example.com',
              display_name: 'Alice',
              role: 'creator',
              is_seller: false,
              suspended_at: null,
              suspended_until: null,
              suspension_reason: null,
              created_at: '2026-11-01T00:00:00.000Z',
              deleted_at: '2026-11-20T00:00:00.000Z',
              deleted_reason: DELETE_REASON,
            },
          ],
        };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/users?q=alice`, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(res.status, 200);
      const u = (await res.json()).items[0];
      assert.equal(u.email, 'alice@example.com');
      assert.equal(u.deletedAt, '2026-11-20T00:00:00.000Z');
      assert.equal(u.deletedReason, DELETE_REASON);
      assert.equal(JSON.stringify(u).includes('deleted.invalid'), false);
    },
  );
  assert.match(where, /original_email ILIKE/);
});
