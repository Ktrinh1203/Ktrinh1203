import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { AppError, badRequest } from '../lib/errors.js';

export const PRIVATE_VERIFICATION_DIR = path.resolve('storage/verification_docs');
if (!fs.existsSync(PRIVATE_VERIFICATION_DIR)) {
  fs.mkdirSync(PRIVATE_VERIFICATION_DIR, { recursive: true });
}

const ALLOWED_VERIFICATION_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/**
 * Validates that the leading magic bytes of a file buffer match its declared MIME type.
 * Prevents disguised executables, SVG scripts, HTML polyglots, or corrupted files.
 */
export function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 4).toString('ascii') === '%PDF';
  }
  return false;
}

export interface SavedVerificationFile {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  buffer: Buffer;
}

/**
 * Validates and persists an uploaded memory-buffered file into private verification storage.
 */
export function validateAndSaveVerificationFile(file: Express.Multer.File): SavedVerificationFile {
  if (!file || !file.buffer || file.size === 0) {
    throw new AppError(400, 'EMPTY_DOCUMENT_FILE', 'Uploaded credential document cannot be empty');
  }

  if (!ALLOWED_VERIFICATION_MIMES.has(file.mimetype)) {
    throw new AppError(
      400,
      'UNSUPPORTED_DOCUMENT_TYPE',
      'Only JPEG, PNG, WebP, and PDF credential documents are allowed',
    );
  }

  if (!verifyMagicBytes(file.buffer, file.mimetype)) {
    throw new AppError(
      400,
      'INVALID_FILE_SIGNATURE',
      'File signature (magic bytes) does not match the declared document format',
    );
  }

  const sha256Hash = createHash('sha256').update(file.buffer).digest('hex');
  const ext = EXT_MAP[file.mimetype] || '.bin';
  const storedFileName = `${randomUUID()}${ext}`;
  const fullPath = path.join(PRIVATE_VERIFICATION_DIR, storedFileName);

  fs.writeFileSync(fullPath, file.buffer);

  // Sanitize original filename for display only
  const safeOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._\-\u00C0-\u024F\u1EA0-\u1EF9 ]/g, '_');

  return {
    storagePath: storedFileName,
    fileName: safeOriginalName || storedFileName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256Hash,
    buffer: file.buffer,
  };
}

export const uploadVerificationDocs = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max per credential document
    files: 3, // Max 3 documents per submission
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_VERIFICATION_MIMES.has(file.mimetype)) {
      return cb(
        badRequest('Only JPEG, PNG, WebP, and PDF credential documents are allowed'),
      );
    }
    cb(null, true);
  },
});
