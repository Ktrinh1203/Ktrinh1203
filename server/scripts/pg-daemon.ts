import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';

const dbDir = path.resolve('data/db');
const pg = new EmbeddedPostgres({
  databaseDir: dbDir,
  user: 'postgres',
  password: 'password',
  port: 5432,
  persistent: true,
});

async function run() {
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

  const shutdown = async () => {
    console.log('[pg-daemon] Stopping PostgreSQL...');
    try {
      await pg.stop();
    } catch {}
    console.log('[pg-daemon] PostgreSQL stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep alive
  setInterval(() => {}, 60000);
}

run().catch((err) => {
  console.error('[pg-daemon] Failed to start:', err);
  process.exit(1);
});
