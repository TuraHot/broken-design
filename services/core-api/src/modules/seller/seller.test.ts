// [ภีม] Test suite สำหรับ Seller module (แดชบอร์ดคนขาย, ยอดขาย, กระเป๋าเงิน, สมัครเป็นครีเอเตอร์)
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { calculateWithdrawalBreakdown } from './seller.routes';

const JWT_SECRET = env.jwtSecret;

function makeToken(user: { id?: string; email?: string; role?: 'user' | 'creator' | 'admin' } = {}) {
  const payload = {
    id: user.id || 'seller-1',
    email: user.email || 'seller@example.com',
    role: user.role || 'user',
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

test('POST /api/seller/enable - blocks direct activation for non-sellers (requires /creator application)', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller, role, suspended_at')) {
      return { rowCount: 1, rows: [{ is_seller: false, role: 'user', suspended_at: null }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/enable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken({ id: 'u-user', email: 'u@example.com', role: 'user' })}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error?.code, 'CREATOR_APPLICATION_REQUIRED');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/seller/enable - returns 200 idempotently when already an approved seller', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller, role, suspended_at')) {
      return { rowCount: 1, rows: [{ is_seller: true, role: 'creator', suspended_at: null }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/enable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken({ id: 'u-creator', role: 'creator' })}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.message, 'Seller mode is already enabled');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/seller/enable - refuses admin accounts (role read from the database)', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller, role, suspended_at')) {
      return { rowCount: 1, rows: [{ is_seller: false, role: 'admin', suspended_at: null }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/enable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken({ id: 'u-admin', role: 'user' })}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error?.code, 'ADMIN_CANNOT_SELL');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/seller/enable - refuses suspended accounts', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller, role, suspended_at')) {
      return { rowCount: 1, rows: [{ is_seller: false, role: 'user', suspended_at: new Date() }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/enable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error?.code, 'ACCOUNT_SUSPENDED');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('GET /api/seller/status - checks seller status', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ is_seller: true }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/status`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.isSeller, true);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('GET /api/seller/models - blocks non-seller, suspended, and admin users with 403', async () => {
  const originalQuery = db.query.bind(db);
  let dbUser = { is_seller: false, role: 'user', suspended_at: null as Date | null };
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller, role, suspended_at, suspended_until FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [dbUser] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const nonSellerRes = await fetch(`http://localhost:${port}/api/seller/models`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(nonSellerRes.status, 403);
    assert.equal((await nonSellerRes.json()).error?.code, 'NOT_SELLER');

    dbUser = { is_seller: true, role: 'creator', suspended_at: new Date() };
    const suspendedRes = await fetch(`http://localhost:${port}/api/seller/models`, {
      headers: { Authorization: `Bearer ${makeToken({ role: 'creator' })}` },
    });
    assert.equal(suspendedRes.status, 403);
    assert.equal((await suspendedRes.json()).error?.code, 'ACCOUNT_SUSPENDED');

    dbUser = { is_seller: true, role: 'admin', suspended_at: null };
    const adminRes = await fetch(`http://localhost:${port}/api/seller/models`, {
      headers: { Authorization: `Bearer ${makeToken({ role: 'admin' })}` },
    });
    assert.equal(adminRes.status, 403);
    assert.equal((await adminRes.json()).error?.code, 'ADMIN_CANNOT_SELL');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('GET /api/seller/models - returns creator models for active seller', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller, role, suspended_at, suspended_until FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ is_seller: true, role: 'creator', suspended_at: null }] };
    }
    if (sql.includes('FROM models') && sql.includes('WHERE owner_id = $1')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 'm-1',
            title: 'Model 1',
            price_cents: 1000,
            currency: 'USD',
            view_count: 50,
            download_count: 10,
            hidden_at: null,
            deleted_at: null,
            created_at: '2026-11-11T00:00:00.000Z',
          },
        ],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/models`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.models.length, 1);
    assert.equal(body.models[0].title, 'Model 1');
    assert.equal(body.models[0].priceCents, 1000);
    assert.equal(body.models[0].isHidden, false);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('GET /api/seller/sales - uses locked purchase amount_cents for revenue summary and sales list', async () => {
  const originalQuery = db.query.bind(db);
  let sawLockedSummarySql = false;
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller, role, suspended_at, suspended_until FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ is_seller: true, role: 'creator', suspended_at: null }] };
    }
    if (sql.includes('COALESCE(SUM(COALESCE(NULLIF(p.amount_cents, 0), m.price_cents)), 0) AS total_revenue')) {
      sawLockedSummarySql = true;
      return {
        rowCount: 1,
        rows: [{ total_revenue: 5800, total_sales: 2 }],
      };
    }
    if (sql.includes('FROM purchases p') && sql.includes('JOIN users u')) {
      return {
        rowCount: 2,
        rows: [
          {
            purchase_id: 'p-1',
            model_id: 'm-1',
            sold_at: '2026-11-11T00:00:00.000Z',
            title: 'Cool Robot',
            price_cents: 2900,
            currency: 'USD',
            buyer_name: 'Alice',
          },
          {
            purchase_id: 'p-2',
            model_id: 'm-1',
            sold_at: '2026-11-11T01:00:00.000Z',
            title: 'Cool Robot',
            price_cents: 2900,
            currency: 'USD',
            buyer_name: 'Bob',
          },
        ],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/sales`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    assert.equal(sawLockedSummarySql, true);
    const body = await res.json();
    assert.equal(body.totalRevenue, 5800);
    assert.equal(body.totalSales, 2);
    assert.equal(body.sales.length, 2);
    assert.equal(body.sales[0].buyerName, 'Alice');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('calculateWithdrawalBreakdown - deducts 7% platform fee correctly', () => {
  const res = calculateWithdrawalBreakdown(5000, 700);
  assert.equal(res.grossAmountCents, 5000);
  assert.equal(res.platformFeeCents, 350);
  assert.equal(res.netAmountCents, 4650);
  assert.equal(res.feeRatePercent, 7);
});

test('GET /api/seller/wallet - returns held balance and fee breakdown', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller, role, suspended_at, suspended_until FROM users')) {
      return { rowCount: 1, rows: [{ is_seller: true, role: 'creator', suspended_at: null }] };
    }
    if (sql.includes('AS gross_earned')) {
      return { rowCount: 1, rows: [{ gross_earned: 5000 }] };
    }
    if (sql.includes('AS gross_withdrawn')) {
      return { rowCount: 1, rows: [{ gross_withdrawn: 1000 }] };
    }
    if (sql.includes('FROM creator_withdrawals')) {
      return { rowCount: 0, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/wallet`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.wallet.grossEarnedCents, 5000);
    assert.equal(body.wallet.withdrawnGrossCents, 1000);
    assert.equal(body.wallet.availableGrossCents, 4000);
    assert.equal(body.wallet.estimatedFeeCents, 280);
    assert.equal(body.wallet.estimatedNetCents, 3720);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/seller/withdraw - locks user row in a transaction, deducts fee, and rolls back on overdraw', async () => {
  const originalQuery = db.query.bind(db);
  const originalConnect = db.connect.bind(db);
  const txLog: string[] = [];
  let released = 0;

  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller, role, suspended_at, suspended_until FROM users')) {
      return { rowCount: 1, rows: [{ is_seller: true, role: 'creator', suspended_at: null }] };
    }
    return { rowCount: 0, rows: [] };
  };

  (db as any).connect = async () => ({
    query: async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        txLog.push(sql);
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('FOR UPDATE')) {
        txLog.push('FOR UPDATE');
        return { rowCount: 1, rows: [{ is_seller: true, role: 'creator', suspended_at: null }] };
      }
      if (sql.includes('AS gross_earned')) {
        return { rowCount: 1, rows: [{ gross_earned: 2000 }] };
      }
      if (sql.includes('AS gross_withdrawn')) {
        return { rowCount: 1, rows: [{ gross_withdrawn: 0 }] };
      }
      if (sql.includes('INSERT INTO creator_withdrawals')) {
        txLog.push('INSERT');
        return {
          rowCount: 1,
          rows: [
            {
              id: 'wd-1',
              gross_amount_cents: 2000,
              platform_fee_cents: 140,
              net_amount_cents: 1860,
              fee_rate_bps: 700,
              currency: 'USD',
              payout_method: 'promptpay',
              payout_account: '0812345678',
              status: 'pending',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    },
    release: () => {
      released++;
    },
  });

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    // 1. Valid withdrawal commits cleanly inside BEGIN -> FOR UPDATE -> INSERT -> COMMIT
    const okRes = await fetch(`http://localhost:${port}/api/seller/withdraw`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${makeToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amountCents: 2000,
        payoutMethod: 'promptpay',
        payoutAccount: '0812345678',
      }),
    });
    assert.equal(okRes.status, 201);
    const body = await okRes.json();
    assert.equal(body.withdrawal.grossAmountCents, 2000);
    assert.equal(body.withdrawal.platformFeeCents, 140);
    assert.equal(body.withdrawal.netAmountCents, 1860);
    assert.deepEqual(txLog, ['BEGIN', 'FOR UPDATE', 'INSERT', 'COMMIT']);

    // 2. Overdraw attempt rolls back and never inserts
    txLog.length = 0;
    const overRes = await fetch(`http://localhost:${port}/api/seller/withdraw`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${makeToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amountCents: 5000,
        payoutMethod: 'promptpay',
        payoutAccount: '0812345678',
      }),
    });
    assert.equal(overRes.status, 400);
    assert.equal((await overRes.json()).error?.code, 'EXCEEDS_BALANCE');
    assert.deepEqual(txLog, ['BEGIN', 'FOR UPDATE', 'ROLLBACK']);
    assert.equal(released, 2);
  } finally {
    server.close();
    db.query = originalQuery;
    db.connect = originalConnect;
  }
});

test('POST /api/seller/apply - redeems invite code atomically via single CTE and rejects invalid codes', async () => {
  const originalQuery = db.query.bind(db);
  let sawAtomicCte = false;

  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('SELECT is_seller, role, suspended_at, suspended_until FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ is_seller: false, role: 'user', suspended_at: null }] };
    }
    if (sql.includes('WITH used_code AS')) {
      sawAtomicCte = true;
      if (params[0] === 'LIXYTE-VALID') {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'app-1',
              note: '',
              status: 'approved',
              admin_note: 'Approved via invite code: LIXYTE-VALID',
              created_at: new Date().toISOString(),
              reviewed_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const badRes = await fetch(`http://localhost:${port}/api/seller/apply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: 'LIXYTE-WRONG' }),
    });
    assert.equal(badRes.status, 400);
    assert.equal((await badRes.json()).error?.code, 'INVALID_INVITE_CODE');

    const okRes = await fetch(`http://localhost:${port}/api/seller/apply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${makeToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: 'lixyte-valid' }),
    });
    assert.equal(okRes.status, 201);
    const body = await okRes.json();
    assert.equal(body.approved, true);
    assert.equal(body.application.status, 'approved');
    assert.equal(sawAtomicCte, true);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});
