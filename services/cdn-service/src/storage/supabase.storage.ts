import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { StorageAdapter, ByteRange } from './storage.interface';
import { assertSafeKey } from './keys';
import { supabase } from '../config/supabase';
import { db } from '../config/db';
import { env } from '../config/env';
import { pruneLocalCache, touchCacheFile } from './cacheManager';

export type SupabaseClientLike = NonNullable<typeof supabase>;

export interface SupabaseStorageOptions {
  client?: SupabaseClientLike | null;
  cacheDir?: string;
  maxCacheBytes?: number;
}

const BUCKET_RE = /^[a-z0-9_-]{1,63}$/i;
const initializedBuckets = new Set<string>();
const warnedPublishableBuckets = new Set<string>();
const inFlightDownloads = new Map<string, Promise<Buffer | null>>();

/** Return true only for privileged server keys (`sb_secret_...` or `service_role` JWT). */
export function isServiceRoleKey(key: string): boolean {
  const trimmed = String(key || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('sb_secret_')) return true;

  const parts = trimmed.split('.');
  if (parts.length !== 3) return false;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { role?: unknown } | null;
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

/** Avatars (`profile_logo`) stay publicly readable; model assets (`models`) are always private. */
export function isPublicBucket(bucketName: string): boolean {
  return bucketName === (env.supabaseAvatarBucket || 'profile_logo');
}

export async function ensureSupabaseModelsBucket(
  bucketName: string,
  client: SupabaseClientLike | null = supabase,
): Promise<void> {
  if (!BUCKET_RE.test(bucketName)) {
    throw new Error('Invalid storage bucket name');
  }
  if (!client) return;
  if (client === supabase && initializedBuckets.has(bucketName)) return;
  if (client === supabase) {
    initializedBuckets.add(bucketName);
  }

  const shouldBePublic = isPublicBucket(bucketName);
  const hasServiceRole = isServiceRoleKey(env.supabaseKey);

  if (!shouldBePublic && !hasServiceRole && !warnedPublishableBuckets.has(bucketName)) {
    warnedPublishableBuckets.add(bucketName);
    console.warn(
      `[SupabaseStorage] Bucket "${bucketName}" is set to private (public = false), ` +
        `but SUPABASE_KEY is not a service_role / sb_secret_ key — temporary anon RLS policies are retained for dev. ` +
        `Switch SUPABASE_KEY to sb_secret_... (service_role) to drop permissive RLS policies automatically.`,
    );
  }

  // 1. Try configuring bucket privacy + RLS policies via PostgreSQL Pool if connected
  if (client === supabase && env.databaseUrl) {
    try {
      await db.query(
        `INSERT INTO storage.buckets (id, name, public)
         VALUES ($1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET public = $2`,
        [bucketName, shouldBePublic],
      );

      if (!shouldBePublic) {
        if (hasServiceRole) {
          await db.query(`
            DROP POLICY IF EXISTS "Public Read Access for ${bucketName} bucket" ON storage.objects;
            DROP POLICY IF EXISTS "Allow Uploads to ${bucketName} bucket" ON storage.objects;
            DROP POLICY IF EXISTS "Allow Updates on ${bucketName} bucket" ON storage.objects;
            DROP POLICY IF EXISTS "Allow Deletes from ${bucketName} bucket" ON storage.objects;
          `);
        } else {
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
        }
      } else {
        await db.query(`
          DO $$ BEGIN
            CREATE POLICY "Public Read Access for ${bucketName} bucket" ON storage.objects FOR SELECT USING (bucket_id = '${bucketName}');
          EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);
        if (hasServiceRole) {
          await db.query(`
            DROP POLICY IF EXISTS "Allow Uploads to ${bucketName} bucket" ON storage.objects;
            DROP POLICY IF EXISTS "Allow Updates on ${bucketName} bucket" ON storage.objects;
            DROP POLICY IF EXISTS "Allow Deletes from ${bucketName} bucket" ON storage.objects;
          `);
        } else {
          await db.query(`
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
        }
      }
      return;
    } catch {
      // Ignore if DATABASE_URL pool is not connected as superuser; fall through to storage API
    }
  }

  // 2. Fall back to Supabase Storage API (succeeds when using service_role key)
  try {
    await client.storage.createBucket(bucketName, { public: shouldBePublic });
  } catch {
    // Ignore if bucket already exists or anon key is used
  }
  try {
    await (client.storage as any).updateBucket?.(bucketName, { public: shouldBePublic });
  } catch {
    // Ignore if anon key cannot alter existing bucket
  }
}

export async function uploadBufferToSupabaseBucket(
  bucketName: string,
  hashKey: string,
  fileBuffer: Buffer,
  client: SupabaseClientLike | null = supabase,
): Promise<boolean> {
  if (!client) return false;
  await ensureSupabaseModelsBucket(bucketName, client);

  const cleanKey = assertSafeKey(hashKey);
  const contentType = cleanKey.endsWith('.glb')
    ? 'model/gltf-binary'
    : cleanKey.endsWith('.webp')
      ? 'image/webp'
      : 'application/octet-stream';

  const { error } = await client.storage.from(bucketName).upload(cleanKey, fileBuffer, {
    upsert: true,
    contentType,
  });

  if (error) {
    console.warn(
      `[SupabaseStorage] Could not upload "${cleanKey}" to bucket "${bucketName}": ${error.message}. ` +
        `Check Supabase Storage RLS policies or set SUPABASE_KEY to sb_secret_... (service_role).`,
    );
    return false;
  }

  console.log(`[SupabaseStorage] Stored "${cleanKey}" in Supabase bucket "${bucketName}"`);
  return true;
}

export class SupabaseStorage implements StorageAdapter {
  private bucket: string;
  private localCacheDir: string;
  private maxCacheBytes: number;
  private client: SupabaseClientLike | null;

  constructor(bucketName?: string, opts?: SupabaseStorageOptions) {
    this.bucket = bucketName || env.supabaseStorageBucket || 'models';
    this.localCacheDir = path.resolve(opts?.cacheDir ?? env.storageDir);
    this.maxCacheBytes = opts?.maxCacheBytes ?? env.maxCacheBytes;
    this.client = opts && 'client' in opts ? (opts.client ?? null) : supabase;
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
    if (!this.client) {
      throw new Error('Supabase client is not configured');
    }

    const cleanKey = assertSafeKey(hashKey);
    const fileBuffer = await fsp.readFile(tempFilePath);

    // 1. Upload to Supabase Storage bucket first; fail loudly instead of masking cloud write failures with local cache.
    const uploaded = await uploadBufferToSupabaseBucket(this.bucket, cleanKey, fileBuffer, this.client);
    if (!uploaded) {
      throw new Error(`Failed to upload "${cleanKey}" to Supabase bucket "${this.bucket}"`);
    }

    // 2. Write atomic local cache copy in storage_data/ for fast streaming & enforce cache cap.
    const localPath = this.resolveLocalCachePath(cleanKey);
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    const tmpCachePath = `${localPath}.tmp.${process.pid}.${Date.now()}`;
    await fsp.writeFile(tmpCachePath, fileBuffer);
    await fsp.rename(tmpCachePath, localPath);
    await fsp.unlink(tempFilePath).catch(() => undefined);
    await pruneLocalCache(this.localCacheDir, this.maxCacheBytes, new Set([localPath])).catch(() => undefined);
  }

  async getStream(hashKey: string, range?: ByteRange): Promise<{ stream: Readable; size: number }> {
    const cleanKey = assertSafeKey(hashKey);
    const localPath = this.resolveLocalCachePath(cleanKey);

    // Check local disk cache first so warm assets and Range requests avoid re-downloading from Supabase Cloud.
    try {
      const stat = await fsp.stat(localPath);
      touchCacheFile(localPath);
      const stream = fs.createReadStream(localPath, range ? { start: range.start, end: range.end } : undefined);
      return { stream, size: stat.size };
    } catch {
      // Cache miss — download from Supabase Storage and populate local cache.
    }

    const client = this.client;
    if (client) {
      const flightKey = `${this.localCacheDir}::${this.bucket}::${cleanKey}`;
      let downloadPromise = inFlightDownloads.get(flightKey);
      if (!downloadPromise) {
        downloadPromise = (async (): Promise<Buffer | null> => {
          const { data, error } = await client.storage.from(this.bucket).download(cleanKey);
          if (error || !data) {
            return null;
          }
          const arrayBuffer = await data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          try {
            await fsp.mkdir(path.dirname(localPath), { recursive: true });
            const tmpPath = `${localPath}.tmp.${process.pid}.${Date.now()}`;
            await fsp.writeFile(tmpPath, buffer);
            await fsp.rename(tmpPath, localPath);
            await pruneLocalCache(this.localCacheDir, this.maxCacheBytes, new Set([localPath])).catch(() => undefined);
          } catch {
            // Ignore cache write errors and stream from memory.
          }

          return buffer;
        })().finally(() => {
          if (inFlightDownloads.get(flightKey) === downloadPromise) {
            inFlightDownloads.delete(flightKey);
          }
        });
        inFlightDownloads.set(flightKey, downloadPromise);
      }

      const buffer = await downloadPromise;
      if (buffer) {
        const totalSize = buffer.length;
        let targetBuffer = buffer;
        if (range) {
          const start = Math.max(0, range.start);
          const end = Math.min(totalSize - 1, range.end);
          targetBuffer = start <= end ? buffer.subarray(start, end + 1) : Buffer.alloc(0);
        }

        return { stream: Readable.from(targetBuffer), size: totalSize };
      }
    }

    throw Object.assign(new Error(`ENOENT: object not found in storage: ${cleanKey}`), {
      code: 'ENOENT',
    });
  }

  async delete(hashKey: string): Promise<void> {
    const cleanKey = assertSafeKey(hashKey);
    if (this.client) {
      await this.client.storage.from(this.bucket).remove([cleanKey]).catch(() => undefined);
    }
    await fsp.unlink(this.resolveLocalCachePath(cleanKey)).catch(() => undefined);
  }
}
