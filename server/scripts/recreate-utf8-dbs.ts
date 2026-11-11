import pg from 'pg';

const { Client } = pg;

async function recreateDatabasesWithUtf8() {
  const client = new Client({
    connectionString: 'postgresql://postgres:password@localhost:5432/postgres',
  });
  await client.connect();

  console.log('Connected to postgres maintenance database.');

  // Terminate connections to pbl4_web and pbl4_web_test
  await client.query(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
    WHERE datname IN ('pbl4_web', 'pbl4_web_test') AND pid <> pg_backend_pid();
  `);

  await client.query(`DROP DATABASE IF EXISTS pbl4_web;`);
  await client.query(`DROP DATABASE IF EXISTS pbl4_web_test;`);

  console.log('Dropped existing databases.');

  await client.query(`CREATE DATABASE pbl4_web WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;`);
  console.log('Created pbl4_web with UTF-8 encoding.');

  await client.query(`CREATE DATABASE pbl4_web_test WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;`);
  console.log('Created pbl4_web_test with UTF-8 encoding.');

  await client.end();
}

recreateDatabasesWithUtf8().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
