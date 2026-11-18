import { prisma } from '../../lib/prisma.js';

export async function getCommunitySpotlight() {
  const verifiedUsers = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      professionalProfiles: {
        some: { verificationStatus: 'VERIFIED' },
      },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      professionalProfiles: {
        where: { verificationStatus: 'VERIFIED' },
        select: {
          type: true,
          verificationStatus: true,
          title: true,
          specialty: true,
          institution: true,
        },
        orderBy: { type: 'asc' },
      },
      posts: {
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          _count: { select: { likes: true } },
        },
      },
      dataBankListings: {
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          downloadsCount: true,
        },
      },
      _count: {
        select: {
          followers: true,
          consultationReplies: { where: { isAccepted: true } },
        },
      },
    },
  });

  const ranked = verifiedUsers.map((u) => {
    const primaryProfile = u.professionalProfiles[0];
    const publicPostsCount = u.posts.length;
    const totalLikesReceived = u.posts.reduce((sum, p) => sum + p._count.likes, 0);
    const followersCount = u._count.followers;
    const consultationsCompleted = u._count.consultationReplies;
    const dataBankListingsCount = u.dataBankListings.length;
    const dataBankDownloads = u.dataBankListings.reduce((sum, d) => sum + d.downloadsCount, 0);

    const impactScore =
      publicPostsCount * 15 +
      totalLikesReceived * 8 +
      followersCount * 12 +
      consultationsCompleted * 35 +
      dataBankListingsCount * 20 +
      dataBankDownloads * 10;

    return {
      user: {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        specialty: primaryProfile?.specialty ?? 'Khoa học thần kinh',
        institution: primaryProfile?.institution ?? null,
        professionalProfiles: u.professionalProfiles.map((p) => ({
          type: p.type,
          verificationStatus: p.verificationStatus,
          title: p.title,
        })),
      },
      metrics: {
        publicPostsCount,
        totalLikesReceived,
        followersCount,
        consultationsCompleted,
        dataBankListingsCount,
        dataBankDownloads,
        impactScore,
      },
    };
  });

  ranked.sort((a, b) => {
    if (b.metrics.impactScore !== a.metrics.impactScore) {
      return b.metrics.impactScore - a.metrics.impactScore;
    }
    if (b.metrics.consultationsCompleted !== a.metrics.consultationsCompleted) {
      return b.metrics.consultationsCompleted - a.metrics.consultationsCompleted;
    }
    return b.metrics.followersCount - a.metrics.followersCount;
  });

  return ranked.slice(0, 12);
}
