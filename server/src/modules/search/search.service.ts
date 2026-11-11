import { prisma } from '../../lib/prisma.js';
import { userSummarySelect } from '../users/users.select.js';
import { formatPost } from '../posts/posts.service.js';

export interface SearchFilter {
  q?: string;
  type?: 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER';
  specialty?: string;
  category?: 'all' | 'users' | 'professionals' | 'posts';
  limit?: number;
}

export async function search(filter: SearchFilter, viewerId?: string) {
  const query = filter.q?.trim() || '';
  const limit = Math.min(filter.limit || 20, 50);
  const category = filter.category || 'all';

  const results: {
    users: any[];
    professionals: any[];
    posts: any[];
  } = {
    users: [],
    professionals: [],
    posts: [],
  };

  if (!query && !filter.type && !filter.specialty && category !== 'professionals') {
    return results;
  }

  // 1. Search Users
  if (category === 'all' || category === 'users') {
    results.users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { displayName: { contains: query, mode: 'insensitive' } },
          { username: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: userSummarySelect,
    });
  }

  // 2. Search Professionals (Doctors & Researchers)
  if (category === 'all' || category === 'professionals') {
    const profWhere: any = {
      user: { status: 'ACTIVE' },
    };

    if (filter.type) {
      profWhere.type = filter.type;
    }

    if (filter.specialty) {
      profWhere.specialty = { contains: filter.specialty, mode: 'insensitive' };
    }

    if (query) {
      profWhere.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { specialty: { contains: query, mode: 'insensitive' } },
        { institution: { contains: query, mode: 'insensitive' } },
        { researchInterests: { has: query } },
        { user: { displayName: { contains: query, mode: 'insensitive' } } },
        { user: { username: { contains: query, mode: 'insensitive' } } },
      ];
    }

    const profs = await prisma.professionalProfile.findMany({
      where: profWhere,
      take: limit,
      orderBy: [{ verificationStatus: 'asc' }, { updatedAt: 'desc' }],
      include: {
        user: { select: userSummarySelect },
      },
    });

    results.professionals = profs;
  }

  // 3. Search Posts
  if (category === 'all' || category === 'posts') {
    if (query) {
      const posts = await prisma.post.findMany({
        where: {
          status: 'PUBLISHED',
          content: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: userSummarySelect },
          media: {
            select: { id: true, url: true, mimeType: true, position: true },
            orderBy: { position: 'asc' },
          },
          _count: {
            select: {
              likes: true,
              comments: { where: { status: 'PUBLISHED' } },
            },
          },
          likes: viewerId
            ? {
                where: { userId: viewerId },
                select: { userId: true },
              }
            : false,
        },
      });

      results.posts = posts.map((p) => formatPost(p, viewerId));
    }
  }

  return results;
}
