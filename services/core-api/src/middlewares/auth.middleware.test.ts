import test from 'node:test';
import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../config/db';
import { isSuspended, requireBuyer, requireNotSuspended } from './auth.middleware';

const HOUR = 3_600_000;

test('isSuspended - not suspended, indefinite, still running and already ended', () => {
  assert.equal(isSuspended({ suspended_at: null }), false);
  assert.equal(isSuspended({}), false);
  assert.equal(isSuspended({ suspended_at: new Date(), suspended_until: null }), true);
  assert.equal(isSuspended({ suspended_at: new Date(), suspended_until: new Date(Date.now() + HOUR) }), true);
  assert.equal(isSuspended({ suspended_at: new Date(), suspended_until: new Date(Date.now() - HOUR).toISOString() }), false);
});

async function run(middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>, row: object) {
  const originalQuery = db.query.bind(db);
  (db as any).query = async () => ({ rowCount: 1, rows: [row] });
  let passed = false;
  let error: any;
  try {
    await middleware({ user: { id: 'u-1' } } as Request, {} as Response, () => {
      passed = true;
    });
  } catch (err) {
    error = err;
  } finally {
    db.query = originalQuery;
  }
  return { passed, code: error?.code as string | undefined };
}

test('requireNotSuspended and requireBuyer - a timed suspension that has ended no longer blocks a valid token', async () => {
  const ended = { role: 'user', suspended_at: new Date(Date.now() - 2 * HOUR), suspended_until: new Date(Date.now() - HOUR) };
  assert.deepEqual(await run(requireNotSuspended, ended), { passed: true, code: undefined });
  assert.deepEqual(await run(requireBuyer, ended), { passed: true, code: undefined });
});

test('requireNotSuspended and requireBuyer - a running or open-ended suspension still blocks', async () => {
  const running = { role: 'user', suspended_at: new Date(), suspended_until: new Date(Date.now() + HOUR) };
  const open = { role: 'user', suspended_at: new Date(), suspended_until: null };
  for (const row of [running, open]) {
    assert.deepEqual(await run(requireNotSuspended, row), { passed: false, code: 'ACCOUNT_SUSPENDED' });
    assert.deepEqual(await run(requireBuyer, row), { passed: false, code: 'ACCOUNT_SUSPENDED' });
  }
});
