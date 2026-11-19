import { TEST_STORAGE_DIR } from '../modules/cdn/cdn.test-env';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import type { AddressInfo } from 'net';
import { allowedOrigins } from './cors';
import { app } from '../app';

const server = app.listen(0);
const baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;

after(() => {
  server.close();
  fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
});

test('allowedOrigins includes loopback twin outside production and restricts to configured origins in production', () => {
  const dev = allowedOrigins('http://localhost:3000', 'development');
  assert.deepEqual(dev, ['http://localhost:3000', 'http://127.0.0.1:3000']);

  const multi = allowedOrigins('http://127.0.0.1:3000, https://app.lixyte.com', 'development');
  assert.ok(multi.includes('http://127.0.0.1:3000'));
  assert.ok(multi.includes('http://localhost:3000'));
  assert.ok(multi.includes('https://app.lixyte.com'));

  const prod = allowedOrigins('https://app.lixyte.com', 'production');
  assert.deepEqual(prod, ['https://app.lixyte.com']);
});

test('CDN routes allow wildcard CORS while /api and /verify-watermark restrict CORS to allowed frontend origins', async () => {
  // Public embed stream (/cdn/*) permits third-party websites
  const cdnPreflight = await fetch(`${baseUrl}/cdn/models/00000000-0000-0000-0000-000000000000/preview.glb`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://third-party.example',
      'Access-Control-Request-Method': 'GET',
    },
  });
  assert.equal(cdnPreflight.headers.get('access-control-allow-origin'), '*');
  await cdnPreflight.arrayBuffer();

  // Mutating/internal endpoints allow configured frontend origin
  const apiAllowed = await fetch(`${baseUrl}/api/models`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
    },
  });
  assert.equal(apiAllowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(apiAllowed.headers.get('access-control-allow-credentials'), 'true');
  await apiAllowed.arrayBuffer();

  // Unknown external origins do not receive CORS allowance headers on /api/* or /verify-watermark
  const apiEvil = await fetch(`${baseUrl}/api/models`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST',
    },
  });
  assert.equal(apiEvil.headers.get('access-control-allow-origin'), null);
  await apiEvil.arrayBuffer();

  const verifyEvil = await fetch(`${baseUrl}/verify-watermark`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST',
    },
  });
  assert.equal(verifyEvil.headers.get('access-control-allow-origin'), null);
  await verifyEvil.arrayBuffer();
});
