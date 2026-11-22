import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AppError, errorHandler, isDbBusyError } from './error.middleware';

test('isDbBusyError detects pool exhaustion and connection timeouts', () => {
  assert.equal(
    isDbBusyError(new Error('(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15')),
    true,
  );
  assert.equal(isDbBusyError(new Error('timeout exceeded when trying to connect')), true);
  assert.equal(isDbBusyError(new Error('sorry, too many clients already')), true);
  assert.equal(isDbBusyError(new Error('boom')), false);
  assert.equal(isDbBusyError(null), false);
  assert.equal(isDbBusyError('max clients reached'), false);
});

test('errorHandler returns 503 DATABASE_BUSY, 500 INTERNAL_ERROR, and AppError status as expected', async () => {
  const miniApp = express();
  miniApp.get('/db-busy', () => {
    throw new Error('(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15');
  });
  miniApp.get('/boom', () => {
    throw new Error('boom');
  });
  miniApp.get('/not-found', () => {
    throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
  });
  miniApp.use(errorHandler);

  const server = miniApp.listen(0);
  const port = (server.address() as any).port;

  try {
    const busyRes = await fetch(`http://localhost:${port}/db-busy?secret=ignore`);
    assert.equal(busyRes.status, 503);
    assert.equal(busyRes.headers.get('retry-after'), '5');
    const busyBody = await busyRes.json();
    assert.equal(busyBody.error?.code, 'DATABASE_BUSY');

    const boomRes = await fetch(`http://localhost:${port}/boom`);
    assert.equal(boomRes.status, 500);
    const boomBody = await boomRes.json();
    assert.equal(boomBody.error?.code, 'INTERNAL_ERROR');

    const nfRes = await fetch(`http://localhost:${port}/not-found`);
    assert.equal(nfRes.status, 404);
    const nfBody = await nfRes.json();
    assert.equal(nfBody.error?.code, 'MODEL_NOT_FOUND');
    assert.equal(nfBody.error?.message, 'Model not found');
  } finally {
    server.close();
  }
});
