import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load server/.env (Node >= 20.12 built-in). Variables already present in
// process.env (e.g. set by the test runner or the host) take precedence.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGINS: z
    .string()
    .default(
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173',
    )
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
  QEEG_SERVICE_URL: z.string().default('http://127.0.0.1:8001'),
  NODERED_URL: z.string().default('http://127.0.0.1:1880'),
  NODERED_INGEST_SECRET: z.string().min(8).default('neurolink-nodered-dev-secret'),
  LEDGER_HMAC_SECRET: z
    .string()
    .min(16)
    .default('neurolink-dev-ledger-hmac-secret-change-in-prod-32b'),
  PAYMENT_WEBHOOK_SECRET: z
    .string()
    .min(16)
    .default('neurolink-dev-webhook-hmac-secret-change-in-prod'),
  VIETQR_BANK_BIN: z.string().default('970422'),
  VIETQR_BANK_NAME: z.string().default('MB Bank'),
  VIETQR_ACCOUNT_NO: z.string().default('0888999777'),
  VIETQR_ACCOUNT_NAME: z.string().default('CONG TY NEUROLINK VIET NAM'),
  VND_PER_CREDIT: z.coerce.number().int().positive().default(1000),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
