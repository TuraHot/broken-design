import { StorageAdapter } from './storage.interface';
import { LocalDiskStorage } from './local.storage';
import { SupabaseStorage } from './supabase.storage';
import { env } from '../config/env';
import { supabase } from '../config/supabase';

const storageInstances = new Map<string, StorageAdapter>();

export function getStorage(bucketName?: string): StorageAdapter {
  const bucket = bucketName || env.supabaseStorageBucket || 'models';
  let instance = storageInstances.get(bucket);
  if (!instance) {
    if (env.storageProvider === 'supabase' && supabase) {
      instance = new SupabaseStorage(bucket);
    } else {
      instance = new LocalDiskStorage(bucket);
    }
    storageInstances.set(bucket, instance);
  }
  return instance;
}

export function getAvatarStorage(): StorageAdapter {
  return getStorage(env.supabaseAvatarBucket);
}

export * from './storage.interface';
export * from './local.storage';
export * from './supabase.storage';
export * from './cacheManager';

