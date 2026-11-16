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
    if (sql.includes('SELECT role, suspended_at FROM users WHERE id = $1')) {
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
              suspended_at: null,
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

test('PATCH /api/admin/users/:id/suspend - suspends a user', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql, params) => {
      if (sql.includes('UPDATE users') && sql.includes('suspended_at')) {
        assert.deepEqual(params, [TARGET_ID, true]);
        return { rowCount: 1, rows: [{ id: TARGET_ID, suspended_at: '2026-11-16T00:00:00.000Z' }] };
      }
    },
    async (base) => {
      const res = await fetch(`${base}/users/${TARGET_ID}/suspend`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: true }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.isSuspended, true);
    },
  );
});

test('PATCH /api/admin/users/:id/suspend - restores a user', async () => {
  await withServer(
    ACTIVE_ADMIN,
    (sql) => {
      if (sql.includes('UPDATE users')) return { rowCount: 1, rows: [{ id: TARGET_ID, suspended_at: null }] };
    },
    async (base) => {
      const res = await fetch(`${base}/users/${TARGET_ID}/suspend`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: false }),
      });
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
      body: JSON.stringify({ suspended: true }),
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

test('PATCH /api/admin/models/:id/hide - hides and restores', async () => {
  for (const hidden of [true, false]) {
    await withServer(
      ACTIVE_ADMIN,
      (sql, params) => {
        if (sql.includes('UPDATE models')) {
          assert.deepEqual(params, [MODEL_ID, hidden]);
          return { rowCount: 1, rows: [{ id: MODEL_ID, hidden_at: hidden ? '2026-11-16T00:00:00.000Z' : null }] };
        }
      },
      async (base) => {
        const res = await fetch(`${base}/models/${MODEL_ID}/hide`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden }),
        });
        assert.equal(res.status, 200);
        assert.equal((await res.json()).isHidden, hidden);
      },
    );
  }
});

test('PATCH /api/admin/models/:id/hide - 404 for unknown model, 400 for bad body', async () => {
  await withServer(ACTIVE_ADMIN, () => undefined, async (base) => {
    const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };
    const missing = await fetch(`${base}/models/${MODEL_ID}/hide`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ hidden: true }),
    });
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'MODEL_NOT_FOUND');

    const bad = await fetch(`${base}/models/${MODEL_ID}/hide`, { method: 'PATCH', headers, body: '{}' });
    assert.equal(bad.status, 400);
  });
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
