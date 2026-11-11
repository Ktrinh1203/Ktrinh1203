import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[server] PBL4_Web API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Periodically purge expired sessions.
const cleanup = setInterval(
  () => {
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch((err) => {
      console.error('[server] session cleanup failed', err);
    });
  },
  60 * 60 * 1000,
);
cleanup.unref();

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
