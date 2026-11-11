import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, randomToken, sha256, verifyPassword } from '../../lib/crypto.js';
import { AppError, conflict, unauthorized } from '../../lib/errors.js';
import { selfUserSelect, withExperienceResolution } from '../users/users.select.js';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.schemas.js';

interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

// Used to keep login timing similar whether or not the account exists.
let dummyHashPromise: Promise<string> | null = null;
const getDummyHash = () => (dummyHashPromise ??= hashPassword('dummy-password-for-timing-1'));

export async function createSession(userId: string, meta: SessionMeta) {
  const token = randomToken(32);
  const csrfToken = randomToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      csrfToken,
      userId,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300),
      ipAddress: meta.ipAddress?.slice(0, 64),
    },
  });
  return { token, csrfToken, expiresAt };
}

export async function register(input: RegisterInput, meta: SessionMeta) {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        displayName: input.displayName,
        passwordHash,
      },
      select: selfUserSelect,
    });
    const session = await createSession(user.id, meta);
    return { user: withExperienceResolution(user), session };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = String((err.meta?.target as string[] | string | undefined) ?? '');
      if (target.includes('email')) throw conflict('E-mail is already registered', 'EMAIL_TAKEN');
      if (target.includes('username')) throw conflict('Username is already taken', 'USERNAME_TAKEN');
      throw conflict('Account already exists');
    }
    throw err;
  }
}

export async function login(input: LoginInput, meta: SessionMeta) {
  const isEmail = input.identifier.includes('@');
  const user = await prisma.user.findUnique({
    where: isEmail ? { email: input.identifier } : { username: input.identifier },
    select: { id: true, passwordHash: true, status: true },
  });

  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) throw unauthorized('Invalid credentials');
  if (user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended');

  const session = await createSession(user.id, meta);
  const profile = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: selfUserSelect });
  return { user: withExperienceResolution(profile), session };
}

export async function logout(sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: selfUserSelect });
  return withExperienceResolution(user);
}

/** Changes the password and revokes every other session of the user. */
export async function changePassword(userId: string, currentSessionId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
  }
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId, id: { not: currentSessionId } } }),
  ]);
}
