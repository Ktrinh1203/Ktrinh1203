import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { loadSession } from './middleware/auth.js';
import { csrfProtection, CSRF_HEADER, isAllowedOrigin } from './middleware/csrf.js';
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
import { qeegRouter } from './modules/qeeg/qeeg.routes.js';
import { neuralDbRouter } from './modules/neural-db/neural-db.routes.js';
import { consultationsRouter } from './modules/consultations/consultations.routes.js';
import { databankRouter } from './modules/databank/databank.routes.js';
import { selfServiceRouter } from './modules/self-service/self-service.routes.js';
import { communityInsightsRouter } from './modules/community-insights/community-insights.routes.js';
import { paymentsRouter, paymentsWebhookRouter } from './modules/payments/payments.routes.js';
import { realtimeRouter } from './modules/realtime/realtime.routes.js';
import { devicesIngestRouter, devicesRouter } from './modules/devices/devices.routes.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSTATION_HTML_PATH = path.resolve(MODULE_DIR, '../../qeeg_service/static/index.html');
const WORKSTATION_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com",
  "script-src-attr 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
  "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' http://127.0.0.1:* http://localhost:*",
].join('; ');

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
        if (!origin || isAllowedOrigin(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', CSRF_HEADER, 'X-Payment-Signature', 'X-NodeRed-Secret', 'X-Device-Key'],
    }),
  );
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    }),
  );
  app.use(cookieParser());

  // Static uploads directory
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

  app.get('/clinical-workstation', (_req, res) => {
    res.setHeader('Content-Security-Policy', WORKSTATION_CSP);
    if (!existsSync(WORKSTATION_HTML_PATH)) {
      res.status(404).send('<h1>Trạm Điện Não Định Lượng qEEG chưa sẵn sàng.</h1>');
      return;
    }
    res.sendFile(WORKSTATION_HTML_PATH);
  });

  // Hardware & Node-RED gateway ingestion mounted BEFORE globalLimiter, session & CSRF middleware
  app.use('/api/devices/ingest', devicesIngestRouter);

  app.use(globalLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Public HMAC-authenticated bank webhook mounted BEFORE session & CSRF middleware
  app.use('/api/payments/webhook', paymentsWebhookRouter);

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
  app.use('/api/payments', paymentsRouter);
  app.use('/api/realtime', realtimeRouter);
  app.use('/api/devices', devicesRouter);
  app.use('/api/eeg-datasets', eegDatasetsRouter);
  app.use('/api/communities', communitiesRouter);
  app.use('/api/qeeg', qeegRouter);
  app.use('/api/neural-db', neuralDbRouter);
  app.use('/api/consultations', consultationsRouter);
  app.use('/api/databank', databankRouter);
  app.use('/api/self-service', selfServiceRouter);
  app.use('/api/community-insights', communityInsightsRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
