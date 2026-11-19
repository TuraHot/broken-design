export type AssetKind = 'model' | 'preview' | 'poster';

const SCOPED_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(model\.[0-9a-f]{64}\.glb|preview\.[0-9a-f]{64}\.glb|poster\.[0-9a-f]{64}\.webp)$/;

const AVATAR_KEY_RE =
  /^(?:avatars\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/avatar\.[0-9a-f]{64}\.webp$/;

const LEGACY_KEY_RE = /^[0-9a-f]{64}\.(glb|webp)$/;

/**
 * Validate a storage object key against strict scoped (`<model_id>/{model,preview,poster}.<sha256>.<ext>`),
 * avatar (`<user_id>/avatar.<sha256>.webp`), and legacy (`<sha256>.<ext>`) patterns so arbitrary or
 * traversal paths can never reach storage.
 */
export function assertSafeKey(rawKey: string): string {
  const normalized = String(rawKey).trim().replace(/^\/+/, '').toLowerCase();
  if (!SCOPED_KEY_RE.test(normalized) && !AVATAR_KEY_RE.test(normalized) && !LEGACY_KEY_RE.test(normalized)) {
    throw new Error('Invalid or unsafe storage key');
  }
  return normalized;
}

/** Build the scoped avatar key inside the `profile_logo` bucket (`<user_id>/avatar.<sha256>.webp`). */
export function avatarKey(userId: string, hash: string): string {
  return assertSafeKey(`${userId}/avatar.${hash}.webp`);
}

/** Build the scoped storage key inside the `models` bucket (`<model_id>/{model,preview,poster}.<sha256>.<ext>`). */
export function assetKey(modelId: string, kind: AssetKind, hash: string): string {
  const ext = kind === 'poster' ? 'webp' : 'glb';
  return assertSafeKey(`${modelId}/${kind}.${hash}.${ext}`);
}

/** Build the legacy flat storage key (`<sha256>.<ext>`) used for read fallback and migration. */
export function legacyKey(kind: AssetKind, hash: string): string {
  const ext = kind === 'poster' ? 'webp' : 'glb';
  return assertSafeKey(`${hash}.${ext}`);
}

/** Preferred scoped key followed by legacy flat fallback key. */
export function candidateKeys(modelId: string, kind: AssetKind, hash: string): [string, string] {
  return [assetKey(modelId, kind, hash), legacyKey(kind, hash)];
}
