import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

if (existsSync('.env')) process.loadEnvFile('.env');

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error('TEST_DATABASE_URL must be set (see server/.env.example)');
}
if (testDbUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL: tests truncate all tables');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    // Tests share one database, so run files sequentially.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDbUrl,
      BCRYPT_ROUNDS: '4',
      CORS_ORIGINS: 'http://localhost:5173',
      UPLOAD_DIR: 'uploads-test',
    },
  },
});
