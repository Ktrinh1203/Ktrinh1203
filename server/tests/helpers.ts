import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetEegDatasetStore } from '../src/modules/eeg/eeg-access.service.js';
import { resetCommunityStore } from '../src/modules/communities/communities.service.js';

export const ORIGIN = 'http://localhost:5173';

let appInstance: Express | null = null;
export function getApp(): Express {
  appInstance ??= createApp();
  return appInstance;
}

/** Removes all rows from every application table (test database only). */
export async function resetDatabase() {
  if (!process.env.DATABASE_URL?.includes('test')) {
    throw new Error('Refusing to reset a database whose URL does not contain "test"');
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
  resetEegDatasetStore();
  resetCommunityStore();
}

let counter = 0;

export interface TestClient {
  agent: ReturnType<typeof request.agent>;
  csrfToken: string;
  user: { id: string; username: string; email: string; displayName: string };
  /** Helpers that automatically attach Origin + CSRF headers. */
  get: (url: string) => request.Test;
  post: (url: string, body?: object) => request.Test;
  patch: (url: string, body?: object) => request.Test;
  del: (url: string) => request.Test;
}

/** Registers a fresh user and returns an authenticated cookie agent. */
export async function registerUser(overrides: Partial<{ username: string; displayName: string }> = {}) {
  counter += 1;
  const suffix = `${Date.now().toString(36)}${counter}`;
  const username = overrides.username ?? `user_${suffix}`;
  const agent = request.agent(getApp());
  const res = await agent
    .post('/api/auth/register')
    .set('Origin', ORIGIN)
    .send({
      email: `${username}@example.test`,
      username,
      displayName: overrides.displayName ?? `User ${suffix}`,
      password: 'Password123',
    });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return toClient(agent, res.body.csrfToken, res.body.user);
}

export function toClient(
  agent: ReturnType<typeof request.agent>,
  csrfToken: string,
  user: TestClient['user'],
): TestClient {
  const withHeaders = (t: request.Test) => t.set('Origin', ORIGIN).set('X-CSRF-Token', csrfToken);
  return {
    agent,
    csrfToken,
    user,
    get: (url) => agent.get(url),
    post: (url, body) => withHeaders(agent.post(url)).send(body ?? {}),
    patch: (url, body) => withHeaders(agent.patch(url)).send(body ?? {}),
    del: (url) => withHeaders(agent.delete(url)),
  };
}

/** Promotes a user to administrator directly in the database (tests only). */
export async function makeAdmin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
}
