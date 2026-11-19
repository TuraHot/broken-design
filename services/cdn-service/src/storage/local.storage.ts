import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { StorageAdapter, ByteRange } from './storage.interface';
import { assertSafeKey } from './keys';
import { env } from '../config/env';
import { supabase } from '../config/supabase';
import { uploadBufferToSupabaseBucket } from './supabase.storage';

export class LocalDiskStorage implements StorageAdapter {
  private baseDir = path.resolve(env.storageDir);

  private resolveSafePath(hashKey: string): string {
    const cleanKey = assertSafeKey(hashKey);
    const resolved = path.resolve(this.baseDir, ...cleanKey.split('/'));
    if (!resolved.startsWith(this.baseDir + path.sep)) {
      throw new Error('Resolved storage path escapes baseDir');
    }
    return resolved;
  }

  async put(hashKey: string, tempFilePath: string): Promise<void> {
    const cleanKey = assertSafeKey(hashKey);
    const targetPath = this.resolveSafePath(cleanKey);
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    try {
      await fsp.rename(tempFilePath, targetPath);
    } catch (err: any) {
      if (err?.code === 'EXDEV') {
        await fsp.copyFile(tempFilePath, targetPath);
        await fsp.unlink(tempFilePath).catch(() => undefined);
      } else {
        throw err;
      }
    }

    // Sync uploaded asset to Supabase Storage bucket ('models') when Supabase is configured
    if (supabase && process.env.NODE_ENV !== 'test') {
      const fileBuffer = await fsp.readFile(targetPath);
      await uploadBufferToSupabaseBucket(env.supabaseStorageBucket || 'models', cleanKey, fileBuffer);
    }
  }

  async getStream(hashKey: string, range?: ByteRange) {
    const targetPath = this.resolveSafePath(hashKey);
    const stat = await fsp.stat(targetPath);
    const stream = fs.createReadStream(targetPath, range ? { start: range.start, end: range.end } : undefined);
    return { stream, size: stat.size };
  }

  async delete(hashKey: string): Promise<void> {
    const cleanKey = assertSafeKey(hashKey);
    const targetPath = this.resolveSafePath(cleanKey);
    await fsp.unlink(targetPath).catch(() => undefined);
    if (supabase && process.env.NODE_ENV !== 'test') {
      await supabase.storage.from(env.supabaseStorageBucket || 'models').remove([cleanKey]).catch(() => undefined);
    }
  }
}
