// [ภีม] Test suite สำหรับ Seller module (แดชบอร์ดคนขาย, ยอดขาย, เปิดโหมดคนขาย)
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { calculateWithdrawalBreakdown } from './seller.routes';

const JWT_SECRET = env.jwtSecret;

function makeToken(user: { id?: string; email?: string; role?: 'user' | 'creator' } = {}) {
  const payload = {
    id: user.id || 'seller-1',
    email: user.email || 'seller@example.com',
    role: user.role || 'user',
  };
  return jwt.sign(payload, JWT_SECRET);
}

test('POST /api/seller/enable - enables seller mode for user', async () => {
  const originalQuery = db.query.bind(db);
  let updated = false;

  (db as any).query = async (sql: string, params: any[]) => {
    if (sql.includes('UPDATE users SET is_seller = TRUE')) {
      updated = true;
      return { rowCount: 1, rows: [{ id: params[0] }] };
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
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.message, 'Seller mode enabled successfully');
    assert.equal(updated, true);
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('POST /api/seller/enable - refuses admin accounts (role read from the database)', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('UPDATE users SET is_seller = TRUE')) return { rowCount: 0, rows: [] };
    if (sql.includes('SELECT is_seller, role, suspended_at')) {
      return { rowCount: 1, rows: [{ is_seller: false, role: 'admin', suspended_at: null }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    // The token claims a normal user; the database says admin, and the database wins.
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
    if (sql.includes('UPDATE users SET is_seller = TRUE')) return { rowCount: 0, rows: [] };
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

test('GET /api/seller/models - blocks non-seller users with 403', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ is_seller: false }] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/models`, {
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error?.code, 'NOT_SELLER');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('GET /api/seller/models - returns creator models for seller', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ is_seller: true }] };
    }
    if (sql.includes('FROM models') && sql.includes('WHERE owner_id = $1')) {
      return {
        rowCount: 2,
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

test('GET /api/seller/sales - returns revenue summary and sales list', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller FROM users WHERE id = $1')) {
      return { rowCount: 1, rows: [{ is_seller: true }] };
    }
    if (sql.includes('COALESCE(SUM(m.price_cents), 0) AS total_revenue')) {
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
    if (sql.includes('SELECT is_seller FROM users')) {
      return { rowCount: 1, rows: [{ is_seller: true }] };
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

test('POST /api/seller/withdraw - records withdrawal with fee deduction', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('SELECT is_seller FROM users')) {
      return { rowCount: 1, rows: [{ is_seller: true }] };
    }
    if (sql.includes('AS gross_earned')) {
      return { rowCount: 1, rows: [{ gross_earned: 2000 }] };
    }
    if (sql.includes('AS gross_withdrawn')) {
      return { rowCount: 1, rows: [{ gross_withdrawn: 0 }] };
    }
    if (sql.includes('INSERT INTO creator_withdrawals')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 'wd-1',
            gross_amount_cents: 2000,
            platform_fee_cents: 200,
            net_amount_cents: 1800,
            fee_rate_bps: 1000,
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
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/seller/withdraw`, {
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
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.withdrawal.grossAmountCents, 2000);
    assert.equal(body.withdrawal.platformFeeCents, 200);
    assert.equal(body.withdrawal.netAmountCents, 1800);
    assert.equal(body.withdrawal.status, 'pending');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

