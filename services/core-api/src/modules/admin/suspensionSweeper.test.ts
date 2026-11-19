// A suspension with an end time is lifted by a sweeper, so every existing suspended_at check keeps working.
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../config/db';
import { liftExpiredSuspensions, startSuspensionSweeper } from './suspensionSweeper';

async function withQuery(handler: (sql: string, params: any[]) => any, run: () => Promise<void>) {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string, params: any[]) => handler(sql, params);
  try {
    await run();
  } finally {
    db.query = originalQuery;
  }
}

test('liftExpiredSuspensions - lifts, records and notifies in ONE statement, and returns how many', async () => {
  const statements: string[] = [];
  await withQuery(
    (sql) => {
      statements.push(sql);
      return { rowCount: 1, rows: [{ lifted: 3 }] };
    },
    async () => {
      assert.equal(await liftExpiredSuspensions(), 3);
    },
  );
  assert.equal(statements.length, 1);
  const sql = statements[0];
  assert.match(sql, /UPDATE users/);
  assert.match(sql, /suspended_until <= NOW\(\)/);
  assert.match(sql, /suspended_until IS NOT NULL/); // a suspension without an end is never lifted
  assert.match(sql, /INSERT INTO user_suspensions/);
  assert.match(sql, /'expire'/);
  assert.match(sql, /INSERT INTO notifications/);
  assert.match(sql, /account_restored/);
});

test('startSuspensionSweeper - runs at once and then on the interval, survives an error, and can be stopped', async () => {
  let calls = 0;
  await withQuery(
    () => {
      calls++;
      if (calls === 2) throw new Error('database is down');
      return { rowCount: 1, rows: [{ lifted: 0 }] };
    },
    async () => {
      const originalError = console.error;
      console.error = () => undefined; // the failure is logged on purpose
      const stop = startSuspensionSweeper(20);
      try {
        await new Promise((r) => setTimeout(r, 120));
        assert.ok(calls >= 3, `expected 3+ runs, got ${calls}`); // run 2 failed, run 3 still happened
      } finally {
        stop();
        console.error = originalError;
      }
      const after = calls;
      await new Promise((r) => setTimeout(r, 60));
      assert.equal(calls, after, 'no more runs after stop()');
    },
  );
});
