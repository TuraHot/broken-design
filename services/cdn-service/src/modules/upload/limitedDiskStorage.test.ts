import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import multer from 'multer';
import { errorHandler } from '../../middlewares/error.middleware';
import { limitedDiskStorage } from './limitedDiskStorage';

describe('limitedDiskStorage', () => {
  let dir: string;
  let server: import('node:http').Server;
  let base: string;

  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lixyte-upload-test-'));
    const upload = multer({
      storage: limitedDiskStorage(
        dir,
        { file: { bytes: 100, label: 'Model file' }, preview: { bytes: 10, label: 'Preview file' } },
        { bytes: 100, label: 'File' },
      ),
    });
    const app = express();
    app.post('/up', upload.fields([{ name: 'file' }, { name: 'preview' }]), (req, res) => {
      const files = req.files as Record<string, Express.Multer.File[]>;
      res.json({ files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, { size: v[0].size, path: v[0].path }])) });
    });
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Temp files are removed right after the response, so wait (briefly) for the folder to reach the expected size.
  const waitForCount = async (expected: number) => {
    for (let i = 0; i < 40 && fs.readdirSync(dir).length !== expected; i++) await new Promise((r) => setTimeout(r, 25));
    return fs.readdirSync(dir).length;
  };

  const send = (fields: Record<string, Blob>, name = 'a.glb') => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v, name);
    return fetch(`${base}/up`, { method: 'POST', body: form });
  };

  it('saves a file inside its own limit', async () => {
    const res = await send({ file: new Blob([Buffer.alloc(50, 1)]) });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { files: { file: { size: number; path: string } } };
    assert.equal(body.files.file.size, 50);
    assert.equal(fs.statSync(body.files.file.path).size, 50);
  });

  it('applies the limit of each field: 50 bytes is fine for "file" but too big for "preview"', async () => {
    const before = fs.readdirSync(dir).length;
    const res = await send({ preview: new Blob([Buffer.alloc(50, 1)]) });
    assert.equal(res.status, 413);
    const body = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'FILE_TOO_LARGE');
    assert.match(body.error.message, /Preview file exceeds limit of 10 bytes/);
    assert.equal(await waitForCount(before), before, 'no half-written file is left in the temp folder');
  });

  it('removes the files of the other fields when one field is refused', async () => {
    const before = fs.readdirSync(dir).length;
    const res = await send({ file: new Blob([Buffer.alloc(20, 1)]), preview: new Blob([Buffer.alloc(50, 1)]) });
    assert.equal(res.status, 413);
    assert.equal(await waitForCount(before), before);
  });

  it('refuses a file above the overall limit with a 413, not a 500', async () => {
    const res = await send({ file: new Blob([Buffer.alloc(500, 1)]) });
    assert.equal(res.status, 413);
  });

  it('keeps a client-chosen file name inside the upload folder', async () => {
    const res = await send({ file: new Blob([Buffer.alloc(5, 1)]) }, '../../evil.glb');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { files: { file: { path: string } } };
    assert.equal(path.dirname(body.files.file.path), path.resolve(dir));
  });
});
