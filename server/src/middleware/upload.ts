import multer from 'multer';
import type { RequestHandler } from 'express';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { env } from '../config/env.js';
import { badRequest } from '../lib/errors.js';
import { enforceUploadedFilesMagicBytes } from '../lib/fileSecurity.js';

export { enforceUploadedFilesMagicBytes };

const uploadDir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = EXT_MAP[file.mimetype] || path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${randomBytes(16).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const rawUploadMedia = multer({
  storage,
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: 4, // Max 4 images per post
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(badRequest('Only JPEG, PNG and WebP images are supported'));
    }
    cb(null, true);
  },
});

function withMagicBytesGuard(multerHandler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    multerHandler(req, res, (err: unknown) => {
      if (err) {
        next(err);
        return;
      }
      enforceUploadedFilesMagicBytes(req, res, next);
    });
  };
}

export const uploadMedia: multer.Multer = {
  single: (fieldName: string) => withMagicBytesGuard(rawUploadMedia.single(fieldName)),
  array: (fieldName: string, maxCount?: number) =>
    withMagicBytesGuard(rawUploadMedia.array(fieldName, maxCount)),
  fields: (fields: readonly multer.Field[]) =>
    withMagicBytesGuard(rawUploadMedia.fields(fields)),
  any: () => withMagicBytesGuard(rawUploadMedia.any()),
  none: () => rawUploadMedia.none(),
};
