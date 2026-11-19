// Local disk cache housekeeping: LRU eviction by mtime under storage_data/ and stale tmp_uploads cleanup.
import fsp from 'fs/promises';
import path from 'path';

export interface PruneCacheResult {
  evictedFiles: number;
  evictedBytes: number;
  remainingBytes: number;
}

interface CachedFileEntry {
  filePath: string;
  size: number;
  mtimeMs: number;
}

const TEMP_WRITE_RE = /\.tmp\.\d+\.\d+$/;
const inFlightPrunes = new Map<string, Promise<PruneCacheResult>>();

/** Update atime/mtime on cache read so frequently streamed assets stay warm under LRU eviction. */
export function touchCacheFile(filePath: string): void {
  const now = new Date();
  void fsp.utimes(filePath, now, now).catch(() => undefined);
}

async function collectCacheEntries(
  dir: string,
  files: CachedFileEntry[],
  subDirs: string[],
  isRoot = true,
): Promise<void> {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectCacheEntries(fullPath, files, subDirs, false);
      subDirs.push(fullPath);
    } else if (entry.isFile()) {
      if (entry.name === '.gitkeep' || TEMP_WRITE_RE.test(entry.name)) {
        continue;
      }
      try {
        const stat = await fsp.stat(fullPath);
        files.push({
          filePath: fullPath,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      } catch {
        // Ignore files removed concurrently during scan.
      }
    }
  }

  if (!isRoot && entries.length === 0) {
    await fsp.rmdir(dir).catch(() => undefined);
  }
}

async function performPrune(
  resolvedCacheDir: string,
  maxBytes: number,
  resolvedProtectPaths: Set<string>,
): Promise<PruneCacheResult> {
  const files: CachedFileEntry[] = [];
  const subDirs: string[] = [];
  await collectCacheEntries(resolvedCacheDir, files, subDirs, true);

  let totalBytes = files.reduce((sum, item) => sum + item.size, 0);
  if (totalBytes <= maxBytes) {
    return { evictedFiles: 0, evictedBytes: 0, remainingBytes: totalBytes };
  }

  // Sort oldest-accessed first (LRU via mtime updated on cache reads).
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);

  let evictedFiles = 0;
  let evictedBytes = 0;

  for (const file of files) {
    if (totalBytes <= maxBytes) break;
    if (resolvedProtectPaths.has(path.resolve(file.filePath))) continue;

    try {
      await fsp.unlink(file.filePath);
      totalBytes -= file.size;
      evictedFiles += 1;
      evictedBytes += file.size;
    } catch {
      // Ignore files deleted concurrently.
    }
  }

  // Remove empty subdirectories left behind after eviction (collectCacheEntries appends children before parents).
  for (const dir of subDirs) {
    try {
      const remaining = await fsp.readdir(dir);
      if (remaining.length === 0) {
        await fsp.rmdir(dir);
      }
    } catch {
      // Ignore non-empty or already removed directories.
    }
  }

  return { evictedFiles, evictedBytes, remainingBytes: totalBytes };
}

/**
 * Evict oldest cached files under `cacheDir` until total cached bytes <= `maxBytes`.
 * Serialized per `cacheDir` so concurrent downloads/uploads never race.
 */
export async function pruneLocalCache(
  cacheDir: string,
  maxBytes: number,
  protectPaths?: Set<string>,
): Promise<PruneCacheResult> {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    return { evictedFiles: 0, evictedBytes: 0, remainingBytes: 0 };
  }

  const resolvedCacheDir = path.resolve(cacheDir);
  try {
    const stat = await fsp.stat(resolvedCacheDir);
    if (!stat.isDirectory()) {
      return { evictedFiles: 0, evictedBytes: 0, remainingBytes: 0 };
    }
  } catch {
    return { evictedFiles: 0, evictedBytes: 0, remainingBytes: 0 };
  }

  const resolvedProtect = new Set<string>();
  if (protectPaths) {
    for (const p of protectPaths) {
      resolvedProtect.add(path.resolve(p));
    }
  }

  const previous = inFlightPrunes.get(resolvedCacheDir) ?? Promise.resolve({
    evictedFiles: 0,
    evictedBytes: 0,
    remainingBytes: 0,
  });

  const next = previous
    .catch(() => undefined)
    .then(() => performPrune(resolvedCacheDir, maxBytes, resolvedProtect))
    .finally(() => {
      if (inFlightPrunes.get(resolvedCacheDir) === next) {
        inFlightPrunes.delete(resolvedCacheDir);
      }
    });

  inFlightPrunes.set(resolvedCacheDir, next);
  return next;
}

/**
 * Remove orphaned files in `tmpDir` older than `maxAgeMs` (e.g., left behind if the container crashed mid-upload).
 */
export async function cleanupStaleTmpUploads(
  tmpDir: string,
  maxAgeMs: number,
): Promise<{ removedFiles: number }> {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    return { removedFiles: 0 };
  }

  const resolvedTmpDir = path.resolve(tmpDir);
  let entries;
  try {
    entries = await fsp.readdir(resolvedTmpDir, { withFileTypes: true });
  } catch {
    return { removedFiles: 0 };
  }

  const cutoffMs = Date.now() - maxAgeMs;
  let removedFiles = 0;

  for (const entry of entries) {
    if (entry.name === '.gitkeep' || !entry.isFile()) continue;
    const fullPath = path.join(resolvedTmpDir, entry.name);
    try {
      const stat = await fsp.stat(fullPath);
      if (stat.mtimeMs <= cutoffMs) {
        await fsp.unlink(fullPath);
        removedFiles += 1;
      }
    } catch {
      // Ignore files deleted concurrently.
    }
  }

  return { removedFiles };
}
