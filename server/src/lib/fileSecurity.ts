import fs from 'node:fs';
import type { Request, RequestHandler } from 'express';
import { badRequest } from './errors.js';

export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageInspectionResult {
  valid: boolean;
  detectedMime: AllowedImageMime | null;
  sanitizedBuffer: Buffer;
  reason?: string;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const POLYGLOT_SIGNATURES = ['<script', '<?php', '<!doctype html'];
const POLYGLOT_SCAN_WINDOW = 8192;

function detectMagicBytes(buf: Buffer): AllowedImageMime | null {
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return 'image/png';
  }

  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

function containsPolyglotSignature(buf: Buffer): string | null {
  const checkSlice = (slice: Buffer): string | null => {
    const lower = slice.toString('latin1').toLowerCase();
    for (const sig of POLYGLOT_SIGNATURES) {
      if (lower.includes(sig)) {
        return sig;
      }
    }
    return null;
  };

  if (buf.length <= POLYGLOT_SCAN_WINDOW * 2) {
    return checkSlice(buf);
  }

  const headHit = checkSlice(buf.subarray(0, POLYGLOT_SCAN_WINDOW));
  if (headHit) return headHit;

  const tailHit = checkSlice(buf.subarray(buf.length - POLYGLOT_SCAN_WINDOW));
  if (tailHit) return tailHit;

  return null;
}

function containsRawMetadataMarker(buf: Buffer, startOffset: number): boolean {
  for (let i = startOffset; i + 1 < buf.length; i += 1) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xe1 || buf[i + 1] === 0xfe)) {
      return true;
    }
  }
  return false;
}

/**
 * Parses JPEG marker segments before Start-of-Scan (0xFFDA) and strips
 * APP1 (0xFFE1: EXIF / GPS / XMP) and COM (0xFFFE: Comments) segments.
 * Returns null if a metadata segment is truncated/malformed (anti-smuggling).
 */
function stripJpegExifAndComments(buf: Buffer): Buffer | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return null;
  }

  const chunks: Buffer[] = [buf.subarray(0, 2)];
  let pos = 2;
  let strippedAny = false;

  while (pos < buf.length) {
    const markerStart = pos;

    if (buf[pos] !== 0xff) {
      // Non-standard stream before SOS: reject if metadata markers lurk ahead, else preserve stub.
      if (containsRawMetadataMarker(buf, pos)) {
        return null;
      }
      chunks.push(buf.subarray(markerStart));
      break;
    }

    // Advance past one or more 0xFF fill bytes
    while (pos < buf.length && buf[pos] === 0xff) {
      pos += 1;
    }

    if (pos >= buf.length) {
      chunks.push(buf.subarray(markerStart));
      break;
    }

    const marker = buf[pos]!;
    pos += 1;

    // EOI (0xD9) or SOS (0xDA): copy from markerStart through end of image stream
    if (marker === 0xd9 || marker === 0xda) {
      chunks.push(buf.subarray(markerStart));
      break;
    }

    // Standalone markers without a 2-byte length payload (TEM 0x01, RST0..RST7 0xD0..0xD7, SOI 0xD8, stuffed 0x00)
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      chunks.push(buf.subarray(markerStart, pos));
      continue;
    }

    // Variable-length segment: 2-byte big-endian length includes the 2 length bytes themselves
    if (pos + 2 > buf.length) {
      if (marker === 0xe1 || marker === 0xfe) {
        return null;
      }
      chunks.push(buf.subarray(markerStart));
      break;
    }

    const segLength = (buf[pos]! << 8) | buf[pos + 1]!;
    const segEnd = pos + segLength;

    if (segLength < 2 || segEnd > buf.length) {
      if (marker === 0xe1 || marker === 0xfe || containsRawMetadataMarker(buf, pos)) {
        return null;
      }
      chunks.push(buf.subarray(markerStart));
      break;
    }

    // Strip APP1 (0xFFE1: EXIF/GPS/XMP) and COM (0xFFFE: Comment)
    if (marker === 0xe1 || marker === 0xfe) {
      strippedAny = true;
      pos = segEnd;
      continue;
    }

    chunks.push(buf.subarray(markerStart, segEnd));
    pos = segEnd;
  }

  if (!strippedAny) {
    return buf;
  }

  return Buffer.concat(chunks);
}

/**
 * Verifies true binary magic bytes (JPEG, PNG, WebP), blocks HTML/PHP/JS polyglot
 * payloads, and strips EXIF/GPS/XMP (0xFFE1) & COM (0xFFFE) metadata from JPEGs.
 */
export function inspectAndSanitizeImageBuffer(buf: Buffer): ImageInspectionResult {
  if (!Buffer.isBuffer(buf) || buf.length < 4) {
    return {
      valid: false,
      detectedMime: null,
      sanitizedBuffer: Buffer.alloc(0),
      reason: 'Buffer is empty or too short to be a valid image',
    };
  }

  const detectedMime = detectMagicBytes(buf);
  if (!detectedMime) {
    return {
      valid: false,
      detectedMime: null,
      sanitizedBuffer: Buffer.alloc(0),
      reason: 'Binary signature does not match JPEG, PNG, or WebP magic bytes',
    };
  }

  const rawPolyglot = containsPolyglotSignature(buf);
  if (rawPolyglot) {
    return {
      valid: false,
      detectedMime: null,
      sanitizedBuffer: Buffer.alloc(0),
      reason: `Rejected polyglot payload containing forbidden signature (${rawPolyglot})`,
    };
  }

  if (detectedMime === 'image/jpeg') {
    const stripped = stripJpegExifAndComments(buf);
    if (!stripped) {
      return {
        valid: false,
        detectedMime: null,
        sanitizedBuffer: Buffer.alloc(0),
        reason: 'Malformed JPEG metadata segment detected',
      };
    }

    const postStripPolyglot = containsPolyglotSignature(stripped);
    if (postStripPolyglot) {
      return {
        valid: false,
        detectedMime: null,
        sanitizedBuffer: Buffer.alloc(0),
        reason: `Rejected polyglot payload after metadata strip (${postStripPolyglot})`,
      };
    }

    return {
      valid: true,
      detectedMime,
      sanitizedBuffer: stripped,
    };
  }

  return {
    valid: true,
    detectedMime,
    sanitizedBuffer: buf,
  };
}

function collectUploadedFiles(req: Request): Express.Multer.File[] {
  const files: Express.Multer.File[] = [];

  if (req.file) {
    files.push(req.file);
  }

  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    for (const fieldFiles of Object.values(req.files)) {
      if (Array.isArray(fieldFiles)) {
        files.push(...fieldFiles);
      }
    }
  }

  return files;
}

function unlinkQuietly(filePath: string | undefined): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup race if already removed
  }
}

export const INVALID_IMAGE_UPLOAD_MESSAGE =
  'Tệp tải lên không phải ảnh hợp lệ hoặc chứa mã độc giả mạo.';

export function validateUploadedRequestFiles(req: Request): void {
  const files = collectUploadedFiles(req);
  if (files.length === 0) return;

  for (const file of files) {
    const rawBuffer = file.path ? fs.readFileSync(file.path) : file.buffer;
    if (!rawBuffer) {
      for (const f of files) unlinkQuietly(f.path);
      throw badRequest(INVALID_IMAGE_UPLOAD_MESSAGE);
    }

    const inspection = inspectAndSanitizeImageBuffer(rawBuffer);
    if (!inspection.valid || !inspection.detectedMime) {
      for (const f of files) unlinkQuietly(f.path);
      throw badRequest(INVALID_IMAGE_UPLOAD_MESSAGE);
    }

    file.mimetype = inspection.detectedMime;

    if (file.path && inspection.detectedMime === 'image/jpeg') {
      if (!inspection.sanitizedBuffer.equals(rawBuffer)) {
        fs.writeFileSync(file.path, inspection.sanitizedBuffer);
        file.size = inspection.sanitizedBuffer.length;
      }
    } else if (file.buffer && inspection.detectedMime === 'image/jpeg') {
      file.buffer = inspection.sanitizedBuffer;
      file.size = inspection.sanitizedBuffer.length;
    }
  }
}

/**
 * Express middleware enforcing real binary magic-byte inspection, polyglot blocking,
 * and automatic JPEG EXIF/GPS stripping on disk-stored or memory-stored Multer uploads.
 */
export const enforceUploadedFilesMagicBytes: RequestHandler = (req, _res, next) => {
  try {
    validateUploadedRequestFiles(req);
    next();
  } catch (err) {
    next(err);
  }
};
