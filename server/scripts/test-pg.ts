import EmbeddedPostgres from 'embedded-postgres';
import path from 'node:path';

async function testPg() {
  const dbDir = path.resolve('data/db');
  console.log('Initializing embedded postgres at', dbDir);
  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    user: 'postgres',
    password: 'password',
    port: 5432,
    persistent: true,
  });

  await pg.initialise();
  console.log('Initialized. Starting server...');
  await pg.start();
  console.log('Postgres started successfully on port 5432.');

  try {
    await pg.createDatabase('pbl4_web');
    console.log('Created database pbl4_web');
  } catch (err: any) {
    console.log('Database pbl4_web might already exist:', err.message);
  }

  try {
    await pg.createDatabase('pbl4_web_test');
    console.log('Created database pbl4_web_test');
  } catch (err: any) {
    console.log('Database pbl4_web_test might already exist:', err.message);
  }

  const client = pg.getPgClient();
  await client.connect();
  const res = await client.query('SELECT version();');
  console.log('Query result:', res.rows[0]);
  await client.end();
  await pg.stop();
  console.log('Stopped successfully.');
}

testPg().catch((err) => {
  console.error('Embedded Postgres failed:', err);
  process.exit(1);
});
