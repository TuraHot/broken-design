import { TEST_STORAGE_DIR } from '../modules/cdn/cdn.test-env';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import {
  cleanupStaleTmpUploads,
  isPublicBucket,
  isServiceRoleKey,
  pruneLocalCache,
  SupabaseStorage,
  type SupabaseClientLike,
} from './index';

after(() => {
  fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
});

function makeFakeJwt(role: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ role, iss: 'supabase' })).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

function createMockSupabase(opts: {
  uploadError?: { message: string } | null;
  downloadPayload?: Buffer | null;
  downloadDelayMs?: number;
}) {
  let uploadCalls = 0;
  let downloadCalls = 0;

  const client = {
    storage: {
      createBucket: async () => ({ data: null, error: null }),
      updateBucket: async () => ({ data: null, error: null }),
      from: (_bucket: string) => ({
        upload: async () => {
          uploadCalls += 1;
          return { data: null, error: opts.uploadError ?? null };
        },
        download: async () => {
          downloadCalls += 1;
          if (opts.downloadDelayMs) {
            await new Promise((r) => setTimeout(r, opts.downloadDelayMs));
          }
          if (!opts.downloadPayload) {
            return { data: null, error: { message: 'Object not found' } };
          }
          const bytes = new Uint8Array(opts.downloadPayload);
          return {
            data: new Blob([bytes]),
            error: null,
          };
        },
        remove: async () => ({ data: null, error: null }),
      }),
    },
  } as unknown as SupabaseClientLike;

  return {
    client,
    getUploadCalls: () => uploadCalls,
    getDownloadCalls: () => downloadCalls,
  };
}

test('isServiceRoleKey and isPublicBucket classify keys and buckets safely', () => {
  assert.equal(isServiceRoleKey('sb_secret_abc123'), true);
  assert.equal(isServiceRoleKey(makeFakeJwt('service_role')), true);
  assert.equal(isServiceRoleKey('sb_publishable_abc123'), false);
  assert.equal(isServiceRoleKey(makeFakeJwt('anon')), false);
  assert.equal(isServiceRoleKey(''), false);
  assert.equal(isServiceRoleKey('not-a-jwt'), false);

  assert.equal(isPublicBucket('models'), false);
  assert.equal(isPublicBucket('profile_logo'), true);
});

test('SupabaseStorage.put throws on Supabase upload error and does not write local cache', async () => {
  const cacheDir = fs.mkdtempSync(path.join(TEST_STORAGE_DIR, 'supa-fail-'));
  const tmpFile = path.join(TEST_STORAGE_DIR, 'upload-fail.glb');
  fs.writeFileSync(tmpFile, Buffer.from('glTF-fail-test'));

  const hash = crypto.createHash('sha256').update('fail').digest('hex');
  const key = `11111111-1111-4111-8111-111111111111/model.${hash}.glb`;
  const mock = createMockSupabase({ uploadError: { message: 'quota exceeded' } });
  const storage = new SupabaseStorage('models', { client: mock.client, cacheDir });

  await assert.rejects(() => storage.put(key, tmpFile), /Failed to upload/);
  assert.equal(mock.getUploadCalls(), 1);
  assert.equal(fs.existsSync(path.join(cacheDir, '11111111-1111-4111-8111-111111111111', `model.${hash}.glb`)), false);
});

test('SupabaseStorage.getStream deduplicates concurrent cache misses and serves warm cache on retry', async () => {
  const cacheDir = fs.mkdtempSync(path.join(TEST_STORAGE_DIR, 'supa-dedup-'));
  const payload = Buffer.from('glTF-0123456789-concurrent-stream-payload');
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  const key = `22222222-2222-4222-8222-222222222222/model.${hash}.glb`;

  const mock = createMockSupabase({ downloadPayload: payload, downloadDelayMs: 40 });
  const storage = new SupabaseStorage('models', { client: mock.client, cacheDir });

  const readAll = async (r?: { start: number; end: number }) => {
    const { stream, size } = await storage.getStream(key, r);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return { buf: Buffer.concat(chunks), size };
  };

  // 5 concurrent reads (mix of full + ranged) must trigger only 1 cloud download
  const results = await Promise.all([
    readAll(),
    readAll({ start: 0, end: 3 }),
    readAll({ start: 5, end: 14 }),
    readAll(),
    readAll({ start: 10, end: 19 }),
  ]);

  assert.equal(mock.getDownloadCalls(), 1);
  assert.deepEqual(results[0].buf, payload);
  assert.equal(results[0].size, payload.length);
  assert.deepEqual(results[1].buf, payload.subarray(0, 4));
  assert.deepEqual(results[2].buf, payload.subarray(5, 15));
  assert.deepEqual(results[3].buf, payload);
  assert.deepEqual(results[4].buf, payload.subarray(10, 20));

  // Subsequent read hits local cache with 0 extra cloud calls
  const warm = await readAll({ start: 4, end: 9 });
  assert.equal(mock.getDownloadCalls(), 1);
  assert.deepEqual(warm.buf, payload.subarray(4, 10));
});

test('pruneLocalCache evicts oldest files to cap, protects .gitkeep/temp/protected paths, removes empty dirs', async () => {
  const cacheDir = fs.mkdtempSync(path.join(TEST_STORAGE_DIR, 'prune-'));
  const subOld = path.join(cacheDir, 'old-model');
  const subNew = path.join(cacheDir, 'new-model');
  fs.mkdirSync(subOld, { recursive: true });
  fs.mkdirSync(subNew, { recursive: true });

  const gitkeep = path.join(cacheDir, '.gitkeep');
  const tempFile = path.join(subOld, 'model.abc.glb.tmp.123.456');
  const oldFile = path.join(subOld, 'old.glb');
  const protectedFile = path.join(subOld, 'protected.glb');
  const newFile = path.join(subNew, 'new.glb');

  fs.writeFileSync(gitkeep, '\n');
  fs.writeFileSync(tempFile, Buffer.alloc(60, 1));
  fs.writeFileSync(oldFile, Buffer.alloc(100, 2));
  fs.writeFileSync(protectedFile, Buffer.alloc(60, 3));
  fs.writeFileSync(newFile, Buffer.alloc(80, 4));

  const t1 = new Date(Date.now() - 60_000);
  const t2 = new Date(Date.now() - 30_000);
  const t3 = new Date();
  await fsp.utimes(oldFile, t1, t1);
  await fsp.utimes(protectedFile, t2, t2);
  await fsp.utimes(newFile, t3, t3);

  // Total counted = 100 + 60 + 80 = 240; cap = 150 -> oldFile (100B) evicted, remaining = 140B
  const res = await pruneLocalCache(cacheDir, 150, new Set([protectedFile]));
  assert.equal(res.evictedFiles, 1);
  assert.equal(res.evictedBytes, 100);
  assert.equal(res.remainingBytes, 140);
  assert.equal(fs.existsSync(oldFile), false);
  assert.equal(fs.existsSync(protectedFile), true);
  assert.equal(fs.existsSync(newFile), true);
  assert.equal(fs.existsSync(gitkeep), true);
  assert.equal(fs.existsSync(tempFile), true);

  // Second empty directory removal check without protected file
  const subEmpty = path.join(cacheDir, 'empty-soon');
  fs.mkdirSync(subEmpty, { recursive: true });
  const evictable = path.join(subEmpty, 'evict.glb');
  fs.writeFileSync(evictable, Buffer.alloc(100, 5));
  await fsp.utimes(evictable, t1, t1);

  const res2 = await pruneLocalCache(cacheDir, 150, new Set([protectedFile]));
  assert.equal(res2.evictedFiles, 1);
  assert.equal(fs.existsSync(evictable), false);
  assert.equal(fs.existsSync(subEmpty), false);
});

test('cleanupStaleTmpUploads removes expired files while keeping fresh files and .gitkeep', async () => {
  const tmpDir = fs.mkdtempSync(path.join(TEST_STORAGE_DIR, 'tmp-clean-'));
  const gitkeep = path.join(tmpDir, '.gitkeep');
  const staleFile = path.join(tmpDir, 'stale-upload.glb');
  const freshFile = path.join(tmpDir, 'fresh-upload.glb');

  fs.writeFileSync(gitkeep, '\n');
  fs.writeFileSync(staleFile, Buffer.from('stale'));
  fs.writeFileSync(freshFile, Buffer.from('fresh'));

  const past = new Date(Date.now() - 10_000);
  await fsp.utimes(staleFile, past, past);

  const result = await cleanupStaleTmpUploads(tmpDir, 2_000);
  assert.equal(result.removedFiles, 1);
  assert.equal(fs.existsSync(staleFile), false);
  assert.equal(fs.existsSync(freshFile), true);
  assert.equal(fs.existsSync(gitkeep), true);
});
