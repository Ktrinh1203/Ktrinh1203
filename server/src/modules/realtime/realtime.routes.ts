import { Router } from 'express';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { realtimeBus } from './realtime.bus.js';

export const realtimeRouter = Router();

realtimeRouter.get('/stream', requireAuth, (req, res) => {
  const auth = getAuth(req);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const initialPayload = {
    userId: auth.userId,
    connectedAt: new Date().toISOString(),
  };
  res.write(`event: connected\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  const unsubscribe = realtimeBus.subscribe(auth.userId, res);

  req.on('close', () => {
    unsubscribe();
  });
  res.on('close', () => {
    unsubscribe();
  });
});

realtimeRouter.get('/security-status', requireAuth, (_req, res) => {
  res.json({
    status: 'hardened',
    protections: {
      ledgerHashChain: 'HMAC-SHA256',
      rowLevelLocking: 'POSTGRES_FOR_UPDATE',
      uploadInspection: 'MAGIC_BYTES_AND_EXIF_STRIP',
      sessionSecurity: 'SHA256_HTTPONLY_CSRF',
      realtimeTransport: 'SSE_PUSH',
      qeegIsolation: 'SEMAPHORE_CONCURRENCY_GUARD',
    },
    realtime: realtimeBus.getStats(),
  });
});
