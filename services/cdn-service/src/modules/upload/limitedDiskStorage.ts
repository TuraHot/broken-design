// A multer storage engine that writes uploads to disk like `multer.diskStorage`, but enforces a size limit
// PER FIELD while the file is still arriving. multer's own `limits.fileSize` is one number for every field,
// so a 40 MB "preview" (limit 5 MB) would otherwise be written to disk in full before the route could refuse it.
import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import type { StorageEngine } from 'multer';
import { AppError } from '../../middlewares/error.middleware';

export interface FieldLimit {
  /** Largest allowed size in bytes. */
  bytes: number;
  /** Name used in the error message, e.g. "Preview file". */
  label: string;
}

export function limitedDiskStorage(dir: string, limits: Record<string, FieldLimit>, fallback: FieldLimit): StorageEngine {
  const destination = path.resolve(dir);

  return {
    _handleFile(_req, file, cb) {
      const limit = limits[file.fieldname] ?? fallback;
      // basename: the client controls the original name and must not be able to choose the folder.
      const filename = `${Date.now()}-${crypto.randomInt(1_000_000_000)}-${path.basename(file.originalname)}`;
      const target = path.join(destination, filename);
      const out = fs.createWriteStream(target);
      let size = 0;
      let settled = false;

      const settle = (err: Error | null, info?: Partial<Express.Multer.File>) => {
        if (settled) return;
        settled = true;
        cb(err, info);
      };
      // Remove the partly written file once the write stream has really closed (it may still be opening).
      const discard = () => {
        out.once('close', () => void fsp.unlink(target).catch(() => undefined));
        out.destroy();
      };

      file.stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit.bytes && !settled) {
          file.stream.unpipe(out);
          discard();
          file.stream.resume(); // let multer drain the rest of this file
          settle(new AppError(413, 'FILE_TOO_LARGE', `${limit.label} exceeds limit of ${limit.bytes} bytes`));
        }
      });
      file.stream.on('error', (err) => {
        discard();
        settle(err);
      });
      out.on('error', (err) => settle(err));
      out.on('finish', () => settle(null, { destination, filename, path: target, size: out.bytesWritten }));

      file.stream.pipe(out);
    },

    _removeFile(_req, file, cb) {
      fsp.unlink(file.path).then(
        () => cb(null),
        (err: NodeJS.ErrnoException) => cb(err.code === 'ENOENT' ? null : err),
      );
    },
  };
}
