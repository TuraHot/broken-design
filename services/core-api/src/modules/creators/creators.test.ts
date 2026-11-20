// Tests for GET /api/creators/:handle
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../app';
import { db } from '../../config/db';
import { toCreatorHandle } from './creators.routes';

test('toCreatorHandle normalizes accents, spaces, and punctuation', () => {
  assert.equal(toCreatorHandle('Tomás Vega'), 'tomas-vega');
  assert.equal(toCreatorHandle('Demo Creator'), 'demo-creator');
  assert.equal(toCreatorHandle('  Studio_3D!!  '), 'studio-3d');
});

test('GET /api/creators/:handle - returns profile for newly approved creator even with 0 models', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('FROM users u')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 'u-creator-1',
            display_name: 'Fresh Creator',
            email: 'fresh@example.com',
            avatar_hash: 'a'.repeat(64),
          },
        ],
      };
    }
    if (sql.includes('FROM models m')) {
      return { rowCount: 0, rows: [] };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/creators/fresh-creator`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.handle, 'fresh-creator');
    assert.equal(body.name, 'Fresh Creator');
    assert.deepEqual(body.models, []);
    assert.equal(body.totalDownloads, 0);
    assert.equal(body.totalLikes, 0);
    assert.ok(body.avatarUrl.includes('/cdn/users/u-creator-1/avatar.webp?v='));

    const missing = await fetch(`http://localhost:${port}/api/creators/nobody-here`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error?.code, 'CREATOR_NOT_FOUND');
  } finally {
    server.close();
    db.query = originalQuery;
  }
});

test('GET /api/creators/:handle - returns visible models with totals and omits fileUrl for paid models', async () => {
  const originalQuery = db.query.bind(db);
  (db as any).query = async (sql: string) => {
    if (sql.includes('FROM users u')) {
      return {
        rowCount: 1,
        rows: [
          {
            id: 'u-creator-2',
            display_name: 'Demo Creator',
            email: 'creator@example.com',
            avatar_hash: null,
          },
        ],
      };
    }
    if (sql.includes('FROM models m')) {
      return {
        rowCount: 2,
        rows: [
          {
            id: 'm-1',
            owner_id: 'u-creator-2',
            title: 'Paid Mech',
            description: 'Armored mech',
            tags: ['sci-fi'],
            license: 'COMMERCIAL',
            file_hash: 'f'.repeat(64),
            file_size: 2048,
            preview_hash: 'p'.repeat(64),
            poster_hash: 'b'.repeat(64),
            price_cents: 1900,
            currency: 'USD',
            view_count: 100,
            download_count: 15,
            like_count: 7,
            created_at: '2026-11-20T00:00:00.000Z',
          },
          {
            id: 'm-2',
            owner_id: 'u-creator-2',
            title: 'Free Tree',
            description: '',
            tags: ['nature'],
            license: 'CC0',
            file_hash: 'e'.repeat(64),
            file_size: 1024,
            preview_hash: null,
            poster_hash: null,
            price_cents: 0,
            currency: 'USD',
            view_count: 40,
            download_count: 25,
            like_count: 3,
            created_at: '2026-11-19T00:00:00.000Z',
          },
        ],
      };
    }
    return { rowCount: 0, rows: [] };
  };

  const server = app.listen(0);
  const port = (server.address() as any).port;
  try {
    const res = await fetch(`http://localhost:${port}/api/creators/demo-creator`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.models.length, 2);
    assert.equal(body.totalDownloads, 40);
    assert.equal(body.totalLikes, 10);
    assert.equal(body.models[0].fileUrl, undefined);
    assert.ok(body.models[1].fileUrl.includes('m-2'));
  } finally {
    server.close();
    db.query = originalQuery;
  }
});
