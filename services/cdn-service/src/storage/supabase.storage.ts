import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { StorageAdapter, ByteRange } from './storage.interface';
import { assertSafeKey } from './keys';
import { supabase } from '../config/supabase';
import { db } from '../config/db';
import { env } from '../config/env';

const BUCKET_RE = /^[a-z0-9_-]{1,63}$/i;
const initializedBuckets = new Set<string>();

export async function ensureSupabaseModelsBucket(bucketName: string): Promise<void> {
  if (!BUCKET_RE.test(bucketName)) {
    throw new Error('Invalid storage bucket name');
  }
  if (initializedBuckets.has(bucketName) || !supabase) return;
  initializedBuckets.add(bucketName);

  // 1. Try creating bucket + RLS policies via PostgreSQL Pool if connected
  if (env.databaseUrl) {
    try {
      await db.query(
        `INSERT INTO storage.buckets (id, name, public)
         VALUES ($1, $1, true)
         ON CONFLICT (id) DO UPDATE SET public = true`,
        [bucketName],
      );
      await db.query(`
        DO $$ BEGIN
          CREATE POLICY "Public Read Access for ${bucketName} bucket" ON storage.objects FOR SELECT USING (bucket_id = '${bucketName}');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN
          CREATE POLICY "Allow Uploads to ${bucketName} bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = '${bucketName}');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN
          CREATE POLICY "Allow Updates on ${bucketName} bucket" ON storage.objects FOR UPDATE USING (bucket_id = '${bucketName}') WITH CHECK (bucket_id = '${bucketName}');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
        DO $$ BEGIN
          CREATE POLICY "Allow Deletes from ${bucketName} bucket" ON storage.objects FOR DELETE USING (bucket_id = '${bucketName}');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      return;
    } catch {
      // Ignore if DATABASE_URL pool is not connected as superuser; fall through to storage API
    }
  }

  // 2. Try creating bucket via Supabase Storage API (succeeds when using service_role key)
  try {
    await supabase.storage.createBucket(bucketName, { public: true });
  } catch {
    // Ignore if bucket already exists or anon key is used
  }
}

export async function uploadBufferToSupabaseBucket(
  bucketName: string,
  hashKey: string,
  fileBuffer: Buffer,
): Promise<boolean> {
  if (!supabase) return false;
  await ensureSupabaseModelsBucket(bucketName);

  const cleanKey = assertSafeKey(hashKey);
  const contentType = cleanKey.endsWith('.glb')
    ? 'model/gltf-binary'
    : cleanKey.endsWith('.webp')
      ? 'image/webp'
      : 'application/octet-stream';

  const { error } = await supabase.storage.from(bucketName).upload(cleanKey, fileBuffer, {
    upsert: true,
    contentType,
  });

  if (error) {
    console.warn(
      `[SupabaseStorage] Could not upload "${cleanKey}" to bucket "${bucketName}": ${error.message}. ` +
        `Run Section 8 of supabase/schema.sql in Supabase SQL Editor (or set SUPABASE_KEY to service_role key) to enable bucket writes.`,
    );
    return false;
  }

  console.log(`[SupabaseStorage] Stored "${cleanKey}" in Supabase bucket "${bucketName}"`);
  return true;
}

export class SupabaseStorage implements StorageAdapter {
  private bucket: string;
  private localCacheDir = path.resolve(env.storageDir);

  constructor(bucketName?: string) {
    this.bucket = bucketName || env.supabaseStorageBucket || 'models';
  }

  private resolveLocalCachePath(hashKey: string): string {
    const cleanKey = assertSafeKey(hashKey);
    const defaultBucket = env.supabaseStorageBucket || 'models';
    const parts = this.bucket === defaultBucket ? cleanKey.split('/') : [this.bucket, ...cleanKey.split('/')];
    const resolved = path.resolve(this.localCacheDir, ...parts);
    if (!resolved.startsWith(this.localCacheDir + path.sep)) {
      throw new Error('Resolved cache path escapes localCacheDir');
    }
    return resolved;
  }

  async put(hashKey: string, tempFilePath: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    const cleanKey = assertSafeKey(hashKey);
    const fileBuffer = await fsp.readFile(tempFilePath);

    // 1. Upload to Supabase Storage bucket ('models')
    await uploadBufferToSupabaseBucket(this.bucket, cleanKey, fileBuffer);

    // 2. Also keep a copy in local storage_data/ for fast streaming & fallback
    const localPath = this.resolveLocalCachePath(cleanKey);
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    await fsp.writeFile(localPath, fileBuffer);
    await fsp.unlink(tempFilePath).catch(() => undefined);
  }

  async getStream(hashKey: string, range?: ByteRange): Promise<{ stream: Readable; size: number }> {
    const cleanKey = assertSafeKey(hashKey);
    const localPath = this.resolveLocalCachePath(cleanKey);

    // Check local disk cache first so warm assets and Range requests avoid re-downloading from Supabase Cloud.
    try {
      const stat = await fsp.stat(localPath);
      const stream = fs.createReadStream(localPath, range ? { start: range.start, end: range.end } : undefined);
      return { stream, size: stat.size };
    } catch {
      // Cache miss — download from Supabase Storage and populate local cache.
    }

    if (supabase) {
      const { data, error } = await supabase.storage.from(this.bucket).download(cleanKey);
      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const totalSize = buffer.length;

        try {
          await fsp.mkdir(path.dirname(localPath), { recursive: true });
          const tmpPath = `${localPath}.tmp.${process.pid}.${Date.now()}`;
          await fsp.writeFile(tmpPath, buffer);
          await fsp.rename(tmpPath, localPath);
        } catch {
          // Ignore cache write errors and stream from memory.
        }

        let targetBuffer = buffer;
        if (range) {
          const start = Math.max(0, range.start);
          const end = Math.min(totalSize - 1, range.end);
          targetBuffer = buffer.subarray(start, end + 1);
        }

        return { stream: Readable.from(targetBuffer), size: totalSize };
      }
    }

    // Fallback stat surfaces ENOENT when object does not exist in cloud or cache.
    const stat = await fsp.stat(localPath);
    const stream = fs.createReadStream(localPath, range ? { start: range.start, end: range.end } : undefined);
    return { stream, size: stat.size };
  }

  async delete(hashKey: string): Promise<void> {
    const cleanKey = assertSafeKey(hashKey);
    if (supabase) {
      await supabase.storage.from(this.bucket).remove([cleanKey]).catch(() => undefined);
    }
    await fsp.unlink(this.resolveLocalCachePath(cleanKey)).catch(() => undefined);
  }
}
