import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { getApp, ORIGIN, registerUser, resetDatabase, toClient } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('auth: register', () => {
  it('creates an account, sets an HttpOnly session cookie and never returns the password hash', async () => {
    const res = await request(getApp())
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send({ email: 'Alice@Example.test', username: 'Alice_1', displayName: 'Alice', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'alice@example.test', username: 'alice_1', role: 'USER' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(typeof res.body.csrfToken).toBe('string');

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('pbl4_sid=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const stored = await prisma.user.findUniqueOrThrow({ where: { username: 'alice_1' } });
    expect(stored.passwordHash).not.toBe('Password123');
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
  });

  it('rejects duplicate e-mail and username with 409', async () => {
    const body = { email: 'bob@example.test', username: 'bob', displayName: 'Bob', password: 'Password123' };
    await request(getApp()).post('/api/auth/register').send(body).expect(201);

    const dupEmail = await request(getApp())
      .post('/api/auth/register')
      .send({ ...body, username: 'bob2', email: 'BOB@example.test' });
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.error.code).toBe('EMAIL_TAKEN');

    const dupUser = await request(getApp())
      .post('/api/auth/register')
      .send({ ...body, email: 'bob2@example.test', username: 'BOB' });
    expect(dupUser.status).toBe(409);
    expect(dupUser.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('validates input', async () => {
    const res = await request(getApp())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', username: 'a!', displayName: '', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'username', 'displayName', 'password']));
  });

  it('ignores attempts to self-assign the admin role', async () => {
    const res = await request(getApp())
      .post('/api/auth/register')
      .send({ email: 'eve@example.test', username: 'eve', displayName: 'Eve', password: 'Password123', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('USER');
  });
});

describe('auth: login / me / logout', () => {
  it('logs in with e-mail or username, then logs out and revokes the session', async () => {
    await registerUser({ username: 'carol' });

    const bad = await request(getApp())
      .post('/api/auth/login')
      .send({ identifier: 'carol', password: 'WrongPass1' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('UNAUTHENTICATED');

    const unknown = await request(getApp())
      .post('/api/auth/login')
      .send({ identifier: 'nobody', password: 'Password123' });
    expect(unknown.status).toBe(401);

    const agent = request.agent(getApp());
    const byEmail = await agent
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ identifier: 'CAROL@example.test', password: 'Password123' });
    expect(byEmail.status).toBe(200);
    const client = toClient(agent, byEmail.body.csrfToken, byEmail.body.user);

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe('carol');
    expect(me.body.csrfToken).toBe(byEmail.body.csrfToken);

    const byUsername = await request(getApp())
      .post('/api/auth/login')
      .send({ identifier: 'carol', password: 'Password123' });
    expect(byUsername.status).toBe(200);

    await client.post('/api/auth/logout').expect(204);
    await client.get('/api/auth/me').expect(401);
  });

  it('returns 401 for protected routes without a session', async () => {
    const res = await request(getApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    await request(getApp()).patch('/api/users/me').send({ bio: 'x' }).expect(401);
  });

  it('rejects a forged session cookie', async () => {
    const res = await request(getApp()).get('/api/auth/me').set('Cookie', 'pbl4_sid=forged-token-value-1234567890');
    expect(res.status).toBe(401);
  });

  it('rejects login for suspended accounts and revokes their existing sessions', async () => {
    const client = await registerUser({ username: 'dave' });
    await prisma.user.update({ where: { id: client.user.id }, data: { status: 'SUSPENDED' } });

    await client.get('/api/auth/me').expect(401);
    const res = await request(getApp()).post('/api/auth/login').send({ identifier: 'dave', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('CSRF protection', () => {
  it('requires the CSRF token for authenticated state-changing requests', async () => {
    const client = await registerUser();

    const noToken = await client.agent.patch('/api/users/me').set('Origin', ORIGIN).send({ bio: 'hi' });
    expect(noToken.status).toBe(403);
    expect(noToken.body.error.code).toBe('CSRF_TOKEN_INVALID');

    const wrongToken = await client.agent
      .patch('/api/users/me')
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', 'wrong')
      .send({ bio: 'hi' });
    expect(wrongToken.status).toBe(403);

    await client.patch('/api/users/me', { bio: 'hi' }).expect(200);
  });

  it('rejects requests from non-whitelisted origins', async () => {
    const client = await registerUser();
    const res = await client.agent
      .patch('/api/users/me')
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', client.csrfToken)
      .send({ bio: 'pwned' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ORIGIN_REJECTED');
  });
});

describe('profile management', () => {
  it('updates own display name and bio; rejects privileged fields', async () => {
    const client = await registerUser();

    const ok = await client.patch('/api/users/me', { displayName: 'Dr. Test', bio: 'Neuroscience enthusiast' });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ displayName: 'Dr. Test', bio: 'Neuroscience enthusiast' });

    const privileged = await client.patch('/api/users/me', { role: 'ADMIN' });
    expect(privileged.status).toBe(400);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: client.user.id } });
    expect(stored.role).toBe('USER');
  });

  it('shows a public profile without private fields', async () => {
    const alice = await registerUser({ username: 'alice' });
    const bob = await registerUser({ username: 'bob' });

    const res = await bob.get('/api/users/alice');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: alice.user.id, username: 'alice', isSelf: false });
    expect(res.body.user.email).toBeUndefined();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.stats).toEqual({ posts: 0, followers: 0, following: 0 });

    const byId = await bob.get(`/api/users/${alice.user.id}`);
    expect(byId.body.user.username).toBe('alice');

    await bob.get('/api/users/does_not_exist').expect(404);
  });

  it('changes the password, requiring the current one, and revokes other sessions', async () => {
    const client = await registerUser({ username: 'frank' });
    const other = request.agent(getApp());
    await other.post('/api/auth/login').send({ identifier: 'frank', password: 'Password123' }).expect(200);

    const wrong = await client.post('/api/auth/change-password', {
      currentPassword: 'nope',
      newPassword: 'NewPassword456',
    });
    expect(wrong.status).toBe(400);

    await client
      .post('/api/auth/change-password', { currentPassword: 'Password123', newPassword: 'NewPassword456' })
      .expect(204);

    await client.get('/api/auth/me').expect(200);
    await other.get('/api/auth/me').expect(401);
    await request(getApp())
      .post('/api/auth/login')
      .send({ identifier: 'frank', password: 'NewPassword456' })
      .expect(200);
  });
});

describe('error format', () => {
  it('returns JSON 404 for unknown API routes and 400 for malformed JSON', async () => {
    const notFound = await request(getApp()).get('/api/nope');
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe('NOT_FOUND');

    const malformed = await request(getApp())
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"identifier":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('BAD_REQUEST');
  });
});
