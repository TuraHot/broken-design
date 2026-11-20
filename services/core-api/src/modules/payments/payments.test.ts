// [ภีม] Test suite สำหรับ Payments module (ระบบซื้อจำลองและจัดการ embed_key)
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { generateEmbedKey } from './payments.routes';

const JWT_SECRET = env.jwtSecret;

const MODEL_1 = '11111111-1111-4111-8111-111111111111';
const MODEL_MISSING = '22222222-2222-4222-8222-222222222222';
const MODEL_FREE = '33333333-3333-4333-8333-333333333333';
const MODEL_PAID = '44444444-4444-4444-8444-444444444444';
const PURCHASE_1 = '55555555-5555-4555-8555-555555555555';

function makeToken(user: { id?: string; email?: string; role?: 'user' | 'creator' } = {}) {
  const payload = {
    id: user.id || 'u-1',
    email: user.email || 'buyer@example.com',
    role: user.role || 'user',
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

test('generateEmbedKey generates a 48-character hex string and unique keys', () => {
  const k1 = generateEmbedKey();
  const k2 = generateEmbedKey();
  assert.equal(typeof k1, 'string');
  assert.equal(k1.length, 48); // 24 bytes = 48 hex chars
  assert.notEqual(k1, k2);
});

test('POST /api/models/:id/checkout - rejects unauthenticated requests', async () => {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/models/${MODEL_1}/checkout`, {
      method: 'POST',
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('payments - rejects malformed non-UUID ids with 400 INVALID_ID before hitting Postgres', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    }
    throw new Error(`Unexpected DB query for invalid id: ${sql}`);
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const headers = { Authorization: `Bearer ${makeToken()}` };
    for (const [method, path] of [
      ['POST', '/api/models/not-a-uuid/checkout'],
      ['POST', '/api/purchases/not-a-uuid/confirm-mock'],
      ['POST', '/api/models/not-a-uuid/pay-mock'],
      ['POST', '/api/purchases/not-a-uuid/qr'],
      ['POST', '/api/purchases/not-a-uuid/regenerate-key'],
      ['GET', '/api/purchases/not-a-uuid'],
    ]) {
      const res = await fetch(`http://localhost:${port}${path}`, { method, headers });
      assert.equal(res.status, 400, path);
      assert.equal((await res.json()).error?.code, 'INVALID_ID', path);
    }
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/models/:id/checkout - returns 404 when model not found', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('FROM models m')) {
      return { rowCount: 0, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/models/${MODEL_MISSING}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error?.code, 'MODEL_NOT_FOUND');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/models/:id/checkout - rejects models whose owner is suspended', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('FROM models m')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: MODEL_PAID,
            title: 'Suspended Owner Model',
            price_cents: 1500,
            currency: 'USD',
            owner_id: 'creator-suspended',
            deleted_at: null,
            hidden_at: null,
            owner_suspended_at: new Date().toISOString(),
          },
        ],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/models/${MODEL_PAID}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error?.code, 'MODEL_UNAVAILABLE');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/models/:id/checkout - rejects purchasing own model', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('FROM models m')) {
      return {
        rowCount: 1,
        rows: [{ id: MODEL_1, title: 'My Model', price_cents: 1500, currency: 'USD', owner_id: 'u-1', owner_suspended_at: null }],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/models/${MODEL_1}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken({ id: 'u-1', email: 'owner@example.com', role: 'creator' })}` },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error?.code, 'OWN_MODEL');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/models/:id/checkout - rejects purchasing free model', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('FROM models m')) {
      return {
        rowCount: 1,
        rows: [{ id: MODEL_FREE, title: 'Free Model', price_cents: 0, currency: 'USD', owner_id: 'other-user', owner_suspended_at: null }],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/models/${MODEL_FREE}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error?.code, 'FREE_MODEL');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/models/:id/checkout - creates pending purchase with price from database', async () => {
  const originalQuery = db.query.bind(db);
  let insertedData: any = null;

  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('FROM models m')) {
      return {
        rowCount: 1,
        rows: [{ id: MODEL_PAID, title: 'Paid Model', price_cents: 2900, currency: 'USD', owner_id: 'creator-9', owner_suspended_at: null }],
      };
    }
    if (sql.includes('FROM purchases WHERE user_id = $1 AND model_id = $2')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('INSERT INTO purchases')) {
      insertedData = { userId: params[0], modelId: params[1], embedKey: params[2] };
      return { rowCount: 1, rows: [{ id: PURCHASE_1 }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/models/${MODEL_PAID}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken({ id: 'buyer-1', email: 'b@example.com', role: 'user' })}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.purchaseId, PURCHASE_1);
    assert.equal(body.checkoutUrl, `/checkout/${PURCHASE_1}`);
    assert.equal(body.provider, 'mock');
    assert.equal(insertedData.userId, 'buyer-1');
    assert.equal(insertedData.modelId, MODEL_PAID);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/models/:id/checkout - recovers gracefully from concurrent 23505 insert race', async () => {
  const originalQuery = db.query.bind(db);
  let selectCalls = 0;

  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('FROM models m')) {
      return {
        rowCount: 1,
        rows: [{ id: MODEL_PAID, title: 'Paid Model', price_cents: 2900, currency: 'USD', owner_id: 'creator-9', owner_suspended_at: null }],
      };
    }
    if (sql.includes('FROM purchases WHERE user_id = $1 AND model_id = $2')) {
      selectCalls++;
      if (selectCalls === 1) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [{ id: PURCHASE_1, status: 'pending' }] };
    }
    if (sql.includes('INSERT INTO purchases')) {
      const err: any = new Error('duplicate key');
      err.code = '23505';
      throw err;
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/models/${MODEL_PAID}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.purchaseId, PURCHASE_1);
    assert.equal(body.checkoutUrl, `/checkout/${PURCHASE_1}`);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/models/:id/checkout - prevents duplicate purchase if already paid', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('FROM models m')) {
      return {
        rowCount: 1,
        rows: [{ id: MODEL_PAID, title: 'Paid Model', price_cents: 2900, currency: 'USD', owner_id: 'creator-9', owner_suspended_at: null }],
      };
    }
    if (sql.includes('FROM purchases WHERE user_id = $1 AND model_id = $2')) {
      return { rowCount: 1, rows: [{ id: PURCHASE_1, status: 'paid' }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/models/${MODEL_PAID}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error?.code, 'ALREADY_PURCHASED');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/purchases/:id/confirm-mock - confirms payment and changes status to paid', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('UPDATE purchases') && sql.includes("status = 'paid'")) {
      return {
        rowCount: 1,
        rows: [{ id: params[0], model_id: MODEL_1, embed_key: 'mock-embed-key-123' }],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/purchases/${PURCHASE_1}/confirm-mock`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.purchaseId, PURCHASE_1);
    assert.equal(body.embedKey, 'mock-embed-key-123');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/purchases/:id/confirm-mock - prevents duplicate confirmation (cannot get new key)', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('UPDATE purchases')) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes('SELECT status FROM purchases WHERE id = $1 AND user_id = $2')) {
      return { rowCount: 1, rows: [{ status: 'paid' }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/purchases/${PURCHASE_1}/confirm-mock`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error?.code, 'ALREADY_PAID');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/purchases/:id/confirm-mock - rejects when PAYMENT_PROVIDER is not mock', async () => {
  const originalProvider = env.paymentProvider;
  (env as any).paymentProvider = 'stripe';

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/purchases/${PURCHASE_1}/confirm-mock`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error?.code, 'MOCK_DISABLED');
  } finally {
    server.close();
    (env as any).paymentProvider = originalProvider;
  }
});

test('GET /api/me/purchases - lists only paid purchases with embed_key', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('FROM purchases p') && sql.includes("p.status = 'paid'")) {
      return {
        rowCount: 1,
        rows: [
          {
            id: PURCHASE_1,
            model_id: MODEL_1,
            embed_key: 'embed-key-1',
            created_at: '2026-11-11T00:00:00.000Z',
            title: 'Sample Model',
            price_cents: 1000,
            currency: 'USD',
          },
        ],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/me/purchases`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.purchases.length, 1);
    assert.equal(body.purchases[0].embedKey, 'embed-key-1');
    assert.equal(body.purchases[0].title, 'Sample Model');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/purchases/:id/regenerate-key - generates a new key and invalidates the old key', async () => {
  const originalQuery = db.query.bind(db);
  let updatedKey: string | null = null;

  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) return { rowCount: 1, rows: [{ suspended_at: null, role: 'user' }] };
    if (sql.includes('UPDATE purchases') && sql.includes('SET embed_key = $1')) {
      updatedKey = params[0];
      return {
        rowCount: 1,
        rows: [{ id: params[1], model_id: MODEL_1 }],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/purchases/${PURCHASE_1}/regenerate-key`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.embedKey, 'string');
    assert.equal(body.embedKey.length, 48);
    assert.equal(body.embedKey, updatedKey);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

// ─── a suspended user cannot buy or change keys, even with a token that is still valid ───
async function withUser(
  userRow: { suspended_at: string | null; role?: string } | null,
  run: (base: string, writes: string[]) => Promise<void>,
) {
  const originalQuery = db.query.bind(db);
  const writes: string[] = [];
  (db as any).query = async (sql: string) => {
    if (sql.includes('suspended_at') && sql.includes('FROM users WHERE id = $1')) {
      return userRow ? { rowCount: 1, rows: [{ role: 'user', ...userRow }] } : { rowCount: 0, rows: [] };
    }
    if (/INSERT INTO purchases|UPDATE purchases/.test(sql)) writes.push(sql);
    if (sql.includes('FROM purchases p') && sql.includes("p.status = 'paid'")) return { rowCount: 0, rows: [] };
    return { rowCount: 0, rows: [] };
  };
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    await run(`http://localhost:${port}/api`, writes);
  } finally {
    server.close();
    db.query = originalQuery;
  }
}

const SUSPENDED = { suspended_at: '2026-11-18T00:00:00.000Z' };

test('payments - a suspended user is refused on checkout, confirm, pay and key change, and nothing is written', async () => {
  await withUser(SUSPENDED, async (base, writes) => {
    const headers = { Authorization: `Bearer ${makeToken()}` };
    for (const path of [
      `/models/${MODEL_1}/checkout`,
      `/purchases/${PURCHASE_1}/confirm-mock`,
      `/models/${MODEL_1}/pay-mock`,
      `/purchases/${PURCHASE_1}/qr`,
      `/purchases/${PURCHASE_1}/regenerate-key`,
    ]) {
      const res = await fetch(`${base}${path}`, { method: 'POST', headers });
      assert.equal(res.status, 403, path);
      assert.equal((await res.json()).error.code, 'ACCOUNT_SUSPENDED', path);
    }
    assert.equal(writes.length, 0);
  });
});

test('payments - a token whose user no longer exists is refused with 401', async () => {
  await withUser(null, async (base, writes) => {
    const res = await fetch(`${base}/models/${MODEL_1}/checkout`, { method: 'POST', headers: { Authorization: `Bearer ${makeToken()}` } });
    assert.equal(res.status, 401);
    assert.equal(writes.length, 0);
  });
});

test('payments - a suspended user can still read their purchases (read only)', async () => {
  await withUser(SUSPENDED, async (base) => {
    const res = await fetch(`${base}/me/purchases`, { headers: { Authorization: `Bearer ${makeToken()}` } });
    assert.equal(res.status, 200);
  });
});

// ─── an admin cannot buy: the role is read from the database, not from the token ───
test('payments - an admin cannot checkout, confirm, pay or start a QR payment, and nothing is written', async () => {
  await withUser({ suspended_at: null, role: 'admin' }, async (base, writes) => {
    const headers = { Authorization: `Bearer ${makeToken()}` };
    for (const path of [
      `/models/${MODEL_1}/checkout`,
      `/purchases/${PURCHASE_1}/confirm-mock`,
      `/models/${MODEL_1}/pay-mock`,
      `/purchases/${PURCHASE_1}/qr`,
    ]) {
      const res = await fetch(`${base}${path}`, { method: 'POST', headers });
      assert.equal(res.status, 403, path);
      assert.equal((await res.json()).error.code, 'ADMIN_CANNOT_BUY', path);
    }
    assert.equal(writes.length, 0);
  });
});

test('payments - a normal user still passes the buyer check', async () => {
  await withUser({ suspended_at: null, role: 'user' }, async (base) => {
    const res = await fetch(`${base}/models/${MODEL_1}/checkout`, { method: 'POST', headers: { Authorization: `Bearer ${makeToken()}` } });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'MODEL_NOT_FOUND');
  });
});
