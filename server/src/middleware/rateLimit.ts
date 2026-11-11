import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env.js';

const json429: Options['handler'] = (_req, res, _next, options) => {
  res.status(options.statusCode).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  });
};

/** Factory so tests can build limiters with small windows. */
export function createLimiter(limit: number, windowMs: number, skipInTest = true) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: json429,
    skip: () => skipInTest && env.NODE_ENV === 'test',
  });
}

/** Login / register: 20 attempts per 15 minutes per IP. */
export const authLimiter = createLimiter(20, 15 * 60 * 1000);

/** Generic write limiter for content creation (posts, comments, messages). */
export const writeLimiter = createLimiter(60, 60 * 1000);

/** Global safety net. */
export const globalLimiter = createLimiter(600, 60 * 1000);
