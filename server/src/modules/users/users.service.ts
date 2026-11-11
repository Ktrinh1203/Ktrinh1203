import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { publicUserSelect, selfUserSelect, withExperienceResolution } from './users.select.js';
import type { UpdateMeInput } from './users.schemas.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Look up a user profile by id (UUID) or username. Suspended users are hidden. */
export async function getProfile(idOrUsername: string, viewerId?: string) {
  const where = UUID_RE.test(idOrUsername)
    ? { id: idOrUsername }
    : { username: idOrUsername.toLowerCase() };

  const user = await prisma.user.findFirst({
    where: { ...where, status: 'ACTIVE' },
    select: {
      ...publicUserSelect,
      _count: {
        select: {
          posts: { where: { status: 'PUBLISHED' } },
          followers: true,
          following: true,
        },
      },
    },
  });
  if (!user) throw notFound('User not found');

  let isFollowing = false;
  if (viewerId && viewerId !== user.id) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
      select: { followerId: true },
    });
    isFollowing = Boolean(follow);
  }

  const { _count, ...rest } = user;
  return {
    ...rest,
    stats: { posts: _count.posts, followers: _count.followers, following: _count.following },
    isFollowing,
    isSelf: viewerId === user.id,
  };
}

export async function updateMe(userId: string, input: UpdateMeInput) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: selfUserSelect,
  });
  return withExperienceResolution(updated);
}
