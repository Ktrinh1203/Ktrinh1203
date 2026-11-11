import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-token';
const TOKEN_EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/api/auth/login',
  '/api/auth/register',
]);

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * CSRF protection for cookie-based sessions:
 * 1. For state-changing requests, a present Origin header must be whitelisted.
 * 2. Authenticated state-changing requests must carry the session-bound
 *    CSRF token in the X-CSRF-Token header (synchronizer token pattern).
 * Must run after loadSession.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && !env.CORS_ORIGINS.includes(origin)) {
    return next(new AppError(403, 'CSRF_ORIGIN_REJECTED', 'Request origin is not allowed'));
  }

  // Login/register replace any existing session, so a stale cookie without a
  // known CSRF token must not block them. The Origin check above still applies.
  const pathWithoutQuery = (req.originalUrl || '').split('?')[0] ?? '';
  const isExempt = TOKEN_EXEMPT_PATHS.has(req.path) || TOKEN_EXEMPT_PATHS.has(pathWithoutQuery);
  if (req.auth && !isExempt) {
    const header = req.get(CSRF_HEADER);
    if (!header || !safeEqual(header, req.auth.session.csrfToken)) {
      return next(new AppError(403, 'CSRF_TOKEN_INVALID', 'Missing or invalid CSRF token'));
    }
  }
  next();
}
