import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { env } from './config/env.js';
import { loadSession } from './middleware/auth.js';
import { csrfProtection, CSRF_HEADER } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { postsRouter } from './modules/posts/posts.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { adminRouter, reportsRouter } from './modules/moderation/moderation.routes.js';
import { conversationsRouter } from './modules/messages/messages.routes.js';
import {
  adminVerificationRouter,
  verificationRouter,
} from './modules/verification/verification.routes.js';
import { contributionsRouter } from './modules/contributions/contributions.routes.js';
import { rewardsRouter } from './modules/rewards/rewards.routes.js';
import { adminRewardsRouter } from './modules/rewards/admin-rewards.routes.js';
import { eegDatasetsRouter } from './modules/eeg/eeg-access.routes.js';
import { communitiesRouter } from './modules/communities/communities.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind a reverse proxy in production, req.ip must come from X-Forwarded-For.
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

  if (env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`[http] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${ms}ms)`);
      });
      next();
    });
  }

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients (no Origin) are allowed; browsers must be whitelisted.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', CSRF_HEADER],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Static uploads directory
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

  app.use(globalLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api', loadSession, csrfProtection);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/conversations', conversationsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/verifications', verificationRouter);
  app.use('/api/admin/verifications', adminVerificationRouter);
  app.use('/api/contributions', contributionsRouter);
  app.use('/api/rewards', rewardsRouter);
  app.use('/api/admin/rewards', adminRewardsRouter);
  app.use('/api/eeg-datasets', eegDatasetsRouter);
  app.use('/api/communities', communitiesRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
