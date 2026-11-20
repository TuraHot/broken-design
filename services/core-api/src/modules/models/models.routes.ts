import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../config/db';
import { requireAuth, isSuspended } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { formatModelResponse, type ModelPresenterRow } from './model.presenter';

export const modelsRouter = Router();

const VALID_LICENSES = new Set(['CC0', 'CC-BY', 'CC-BY-NC', 'COMMERCIAL']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 48;
const MAX_PAGE_SIZE = 100;

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// [Member 4] GET /api/models?q=&tag=&license=&price=free|paid&page=
modelsRouter.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().toLowerCase() : '';
    const license = typeof req.query.license === 'string' ? req.query.license.trim().toUpperCase() : '';
    const price = typeof req.query.price === 'string' ? req.query.price.trim().toLowerCase() : '';
    const ownerId = typeof req.query.ownerId === 'string' ? req.query.ownerId.trim() : '';

    const rawPage = Number.parseInt(String(req.query.page ?? '1'), 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

    const rawPageSize = Number.parseInt(String(req.query.pageSize ?? req.query.limit ?? DEFAULT_PAGE_SIZE), 10);
    const pageSize =
      Number.isFinite(rawPageSize) && rawPageSize > 0
        ? Math.min(rawPageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;

    // เฉพาะโมเดลที่ไม่ถูกซ่อน ไม่ถูกลบ และเจ้าของไม่ถูกระงับหรือลบบัญชี
    // (a deleted owner's models leave the gallery; buyers keep using what they bought through the CDN)
    const conditions: string[] = [
      'm.hidden_at IS NULL',
      'm.deleted_at IS NULL',
      'u.suspended_at IS NULL',
      'u.deleted_at IS NULL',
    ];
    const params: unknown[] = [];

    if (ownerId) {
      if (!UUID_RE.test(ownerId)) {
        res.json({ items: [], page, pageSize, total: 0 });
        return;
      }
      params.push(ownerId);
      conditions.push(`m.owner_id = $${params.length}`);
    }

    if (q) {
      params.push(likePattern(q));
      conditions.push(`(m.title ILIKE $${params.length} ESCAPE '\\' OR m.description ILIKE $${params.length} ESCAPE '\\')`);
    }

    if (tag) {
      params.push(tag);
      conditions.push(`$${params.length} = ANY(m.tags)`);
    }

    if (license && VALID_LICENSES.has(license)) {
      params.push(license);
      conditions.push(`m.license = $${params.length}::license_type`);
    }

    if (price === 'free') {
      conditions.push('m.price_cents = 0');
    } else if (price === 'paid') {
      conditions.push('m.price_cents > 0');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const offset = (page - 1) * pageSize;
    const listParams = [...params, pageSize, offset];

    const [countResult, listResult] = await Promise.all([
      db.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total
         FROM models m
         JOIN users u ON u.id = m.owner_id
         ${whereClause}`,
        params,
      ),
      db.query<ModelPresenterRow>(
        `SELECT
           m.id,
           m.owner_id,
           u.display_name AS creator,
           u.avatar_hash AS creator_avatar_hash,
           m.title,
           m.description,
           m.tags,
           m.license,
           m.file_hash,
           m.file_size,
           m.preview_hash,
           m.poster_hash,
           m.price_cents,
           m.currency,
           m.view_count,
           m.download_count,
           (SELECT COUNT(*) FROM likes l WHERE l.model_id = m.id) AS like_count,
           m.created_at
         FROM models m
         JOIN users u ON u.id = m.owner_id
         ${whereClause}
         ORDER BY m.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      ),
    ]);
    const total = Number.parseInt(countResult.rows[0]?.total ?? '0', 10);

    res.json({
      items: listResult.rows.map((row) => formatModelResponse(row)),
      page,
      pageSize,
      total,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/models/tags - Returns all distinct tags across visible models
modelsRouter.get('/tags', async (_req, res, next) => {
  try {
    const result = await db.query<{ tag: string }>(
      `SELECT DISTINCT LOWER(UNNEST(m.tags)) AS tag
       FROM models m
       JOIN users u ON u.id = m.owner_id
       WHERE m.hidden_at IS NULL
         AND m.deleted_at IS NULL
         AND u.suspended_at IS NULL
         AND u.deleted_at IS NULL
       ORDER BY tag ASC`
    );
    const tags = result.rows.map((r) => r.tag).filter(Boolean);
    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

// [Member 3 & 5] GET /api/models/:id
modelsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
    }

    const result = await db.query<ModelPresenterRow>(
      `SELECT
         m.id,
         m.owner_id,
         u.display_name AS creator,
         u.avatar_hash AS creator_avatar_hash,
         m.title,
         m.description,
         m.tags,
         m.license,
         m.file_hash,
         m.file_size,
         m.preview_hash,
         m.poster_hash,
         m.price_cents,
         m.currency,
         m.view_count,
         m.download_count,
         (SELECT COUNT(*) FROM likes l WHERE l.model_id = m.id) AS like_count,
         m.created_at
       FROM models m
       JOIN users u ON u.id = m.owner_id
       WHERE m.id = $1
         AND m.hidden_at IS NULL
         AND m.deleted_at IS NULL
         AND u.suspended_at IS NULL
         AND u.deleted_at IS NULL`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
    }

    if (req.query.trackView === '1') {
      void db.query(`UPDATE models SET view_count = view_count + 1 WHERE id = $1`, [id]).catch(() => undefined);
    }

    res.json(formatModelResponse(row));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/models/:id (Update metadata: title, description, tags?, priceCents, license)
modelsRouter.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) {
      throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
    }

    const userId = req.user!.id;

    // Verify caller role & suspension status from DB (never trust JWT role claims alone)
    const userCheck = await db.query<{ role: string; suspended_at: Date | string | null; suspended_until: Date | string | null }>(
      `SELECT role, suspended_at, suspended_until FROM users WHERE id = $1`,
      [userId],
    );
    const dbUser = userCheck.rows[0];
    if (!dbUser) {
      throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
    }
    if (isSuspended(dbUser)) {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
    }

    const existing = await db.query(
      `SELECT id, owner_id, title, description, tags, price_cents, license, preview_hash, deleted_at
       FROM models WHERE id = $1`,
      [id],
    );
    if (existing.rowCount === 0 || existing.rows[0].deleted_at !== null) {
      throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
    }

    const model = existing.rows[0];
    if (model.owner_id !== userId && dbUser.role !== 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to edit this model');
    }

    const nextTitle =
      typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : model.title;
    if (nextTitle.length > 255) {
      throw new AppError(400, 'BAD_REQUEST', 'Model title must not exceed 255 characters');
    }

    const nextDescription =
      typeof req.body?.description === 'string' ? req.body.description.trim() : (model.description ?? '');
    if (nextDescription.length > 5000) {
      throw new AppError(400, 'BAD_REQUEST', 'Description must not exceed 5000 characters');
    }

    const nextPriceCents =
      req.body?.priceCents !== undefined && req.body?.priceCents !== null
        ? Math.round(Number(req.body.priceCents))
        : Number(model.price_cents);

    if (!Number.isFinite(nextPriceCents) || nextPriceCents < 0 || nextPriceCents > 100_000_000) {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid priceCents');
    }

    // Core Invariant (AGENT.md §3.2): paid models MUST have a preview GLB so the full file is never leaked publicly
    if (nextPriceCents > 0 && !model.preview_hash?.trim()) {
      throw new AppError(
        400,
        'PREVIEW_REQUIRED',
        'Paid models require a preview GLB file before setting a price',
      );
    }

    const rawLicense =
      typeof req.body?.license === 'string' ? req.body.license.trim().toUpperCase() : model.license;
    if (!VALID_LICENSES.has(rawLicense)) {
      throw new AppError(
        400,
        'INVALID_LICENSE',
        `Invalid license. Allowed: ${Array.from(VALID_LICENSES).join(', ')}`,
      );
    }

    let nextTags: string[] = Array.isArray(model.tags) ? model.tags : [];
    if (Array.isArray(req.body?.tags)) {
      nextTags = Array.from(
        new Set(
          req.body.tags
            .map((t: unknown) => String(t).trim().toLowerCase())
            .filter((t: string) => t.length > 0 && t.length <= 50),
        ),
      ).slice(0, 20) as string[];
    }

    const updated = await db.query(
      `UPDATE models
       SET title = $1, description = $2, tags = $3, price_cents = $4, license = $5
       WHERE id = $6
       RETURNING id, title, description, tags, price_cents, license`,
      [nextTitle, nextDescription, nextTags, nextPriceCents, rawLicense, id],
    );

    const r = updated.rows[0];
    res.json({
      model: {
        id: r.id,
        title: r.title,
        description: r.description,
        tags: r.tags ?? [],
        priceCents: r.price_cents,
        license: r.license,
      },
    });
  } catch (err) {
    next(err);
  }
});

// [Ham] DELETE /api/models/:id (Soft delete: only owner or admin can delete)
modelsRouter.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (!UUID_RE.test(id)) {
      throw new AppError(404, 'NOT_FOUND', 'Model not found or already deleted');
    }

    const userId = req.user!.id;

    // 0. Verify caller role & suspension status from DB
    const userCheck = await db.query<{ role: string; suspended_at: Date | string | null; suspended_until: Date | string | null }>(
      `SELECT role, suspended_at, suspended_until FROM users WHERE id = $1`,
      [userId],
    );
    const dbUser = userCheck.rows[0];
    if (!dbUser) {
      throw new AppError(401, 'UNAUTHORIZED', 'Account not found');
    }
    if (isSuspended(dbUser)) {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended by an administrator');
    }

    // 1. Find model and verify existence
    const findResult = await db.query(
      `SELECT id, owner_id, deleted_at FROM models WHERE id = $1`,
      [id],
    );

    if (findResult.rows.length === 0 || findResult.rows[0].deleted_at !== null) {
      throw new AppError(404, 'NOT_FOUND', 'Model not found or already deleted');
    }

    const model = findResult.rows[0];

    // 2. Only owner or active DB-verified admin can delete
    if (model.owner_id !== userId && dbUser.role !== 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'You can only delete your own models');
    }

    // 3. Perform Soft Delete (set deleted_at without removing file from storage)
    const updateResult = await db.query(
      `UPDATE models SET deleted_at = NOW() WHERE id = $1 RETURNING id, owner_id, title, deleted_at`,
      [id],
    );

    res.json({
      message: 'Model soft deleted successfully',
      model: updateResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
});
