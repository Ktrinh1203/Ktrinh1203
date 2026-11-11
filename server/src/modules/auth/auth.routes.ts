import { Router, type CookieOptions, type Request, type Response } from 'express';
import { env, isProduction } from '../../config/env.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { getAuth, requireAuth, SESSION_COOKIE } from '../../middleware/auth.js';
import { changePasswordSchema, loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
  maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
});

const sessionMeta = (req: Request) => ({ userAgent: req.get('user-agent'), ipAddress: req.ip });

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

authRouter.post('/register', authLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const { user, session } = await authService.register(input, sessionMeta(req));
  setSessionCookie(res, session.token);
  res.status(201).json({ user, csrfToken: session.csrfToken });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body);
  // Rotate: drop any session presented with this request before issuing a new one.
  if (req.auth) await authService.logout(req.auth.session.id);
  const { user, session } = await authService.login(input, sessionMeta(req));
  setSessionCookie(res, session.token);
  res.json({ user, csrfToken: session.csrfToken });
});

authRouter.post('/logout', async (req, res) => {
  if (req.auth) await authService.logout(req.auth.session.id);
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, clearOptions);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const user = await authService.getMe(auth.userId);
  res.json({ user, csrfToken: auth.session.csrfToken });
});

authRouter.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const auth = getAuth(req);
  const input = changePasswordSchema.parse(req.body);
  await authService.changePassword(auth.userId, auth.session.id, input);
  res.status(204).end();
});
