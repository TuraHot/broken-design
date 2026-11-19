import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app';
import { allowedOrigins } from './cors';

test('allowedOrigins - dev allows the localhost / 127.0.0.1 twin', () => {
  assert.deepEqual(allowedOrigins('http://localhost:3000', 'development'), ['http://localhost:3000', 'http://127.0.0.1:3000']);
  assert.deepEqual(allowedOrigins('http://127.0.0.1:3000', undefined), ['http://127.0.0.1:3000', 'http://localhost:3000']);
});

test('allowedOrigins - production allows only FRONTEND_URL', () => {
  assert.deepEqual(allowedOrigins('http://localhost:3000', 'production'), ['http://localhost:3000']);
});

test('allowedOrigins - a real domain gets no twin; bad URL is kept as is', () => {
  assert.deepEqual(allowedOrigins('https://lixyte.example', 'development'), ['https://lixyte.example']);
  assert.deepEqual(allowedOrigins('not a url', 'development'), ['not a url']);
});

test('CORS - 127.0.0.1 origin is accepted, a foreign origin is not', async () => {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const ok = await fetch(`http://localhost:${port}/health`, { headers: { Origin: 'http://127.0.0.1:3000' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://127.0.0.1:3000');

    const bad = await fetch(`http://localhost:${port}/health`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  } finally {
    server.close();
  }
});
