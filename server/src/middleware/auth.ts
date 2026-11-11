import type { NextFunction, Request, Response } from 'express';
import type { Role, Session } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sha256 } from '../lib/crypto.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export const SESSION_COOKIE = 'pbl4_sid';

export interface AuthContext {
  userId: string;
  role: Role;
  session: Pick<Session, 'id' | 'csrfToken' | 'expiresAt'>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Resolves the session cookie (if any) into req.auth. Never throws for a
 * missing/invalid session: protected routes use requireAuth for that.
 */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) {
    return next();
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, role: true, status: true } } },
  });

  if (!session) return next();

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.user.status !== 'ACTIVE') {
    // Expired session or suspended account: revoke it.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return next();
  }

  if (now - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => undefined);
  }

  req.auth = {
    userId: session.user.id,
    role: session.user.role,
    session: { id: session.id, csrfToken: session.csrfToken, expiresAt: session.expiresAt },
  };
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  if (req.auth.role !== 'ADMIN') return next(forbidden('Administrator privileges required'));
  next();
}

/** Returns the authenticated context or throws 401 (for use inside handlers). */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
