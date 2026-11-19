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
 * Validates request Origin against whitelist, same-origin Host / X-Forwarded-Host,
 * and standard public tunnel domains (Cloudflare, localtunnel, ngrok, pinggy).
 */
export function isAllowedOrigin(origin: string, req?: Request): boolean {
  if (env.CORS_ORIGINS.includes(origin)) return true;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host.toLowerCase();

    // Check same-origin against Host or X-Forwarded-Host
    if (req) {
      const forwardedHost = req.get('x-forwarded-host');
      const host = req.get('host');
      const candidateHost = (forwardedHost || host || '').trim().toLowerCase();
      if (
        candidateHost &&
        (originHost === candidateHost || originHost === candidateHost.split(':')[0])
      ) {
        return true;
      }
    }

    // Allow known tunnels, local loopbacks, and dev LAN hostnames
    const hostname = originUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.trycloudflare.com') ||
      hostname.endsWith('.loca.lt') ||
      hostname.endsWith('.ngrok-free.app') ||
      hostname.endsWith('.ngrok.app') ||
      hostname.endsWith('.ngrok.io') ||
      hostname.endsWith('.pinggy.io') ||
      hostname.endsWith('.pinggy.link')
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
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
  if (origin && !isAllowedOrigin(origin, req)) {
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
