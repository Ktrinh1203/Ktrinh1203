import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const PG_PORT = 5432;
const dbDir = path.resolve('data/db');
const pg = new EmbeddedPostgres({
  databaseDir: dbDir,
  user: 'postgres',
  password: 'password',
  port: PG_PORT,
  persistent: true,
});

function isPortOpen(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function isPostgresRunning(): Promise<boolean> {
  if (await isPortOpen('127.0.0.1', PG_PORT)) return true;
  if (await isPortOpen('::1', PG_PORT)) return true;
  return false;
}

async function run() {
  if (await isPostgresRunning()) {
    console.log('[db] PostgreSQL already running on :5432 (reusing)');
    const keepAlive = setInterval(() => {}, 60000);
    const shutdownReuse = () => {
      clearInterval(keepAlive);
      process.exit(0);
    };
    process.on('SIGINT', shutdownReuse);
    process.on('SIGTERM', shutdownReuse);
    return;
  }

  const isInitialized = fs.existsSync(path.join(dbDir, 'PG_VERSION'));
  if (!isInitialized) {
    console.log('[pg-daemon] Initializing database cluster...');
    await pg.initialise();
  }
  console.log('[pg-daemon] Starting PostgreSQL...');
  await pg.start();
  console.log('[pg-daemon] PostgreSQL 16 ready on port 5432');

  // Ensure default databases exist
  try {
    await pg.createDatabase('pbl4_web');
  } catch {}
  try {
    await pg.createDatabase('pbl4_web_test');
  } catch {}

  let shuttingDown = false;
  const keepAlive = setInterval(() => {}, 60000);

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(keepAlive);
    console.log('[pg-daemon] Stopping PostgreSQL...');
    try {
      await pg.stop();
    } catch {}
    console.log('[pg-daemon] PostgreSQL stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

run().catch((err) => {
  console.error('[pg-daemon] Failed to start:', err);
  process.exit(1);
});
