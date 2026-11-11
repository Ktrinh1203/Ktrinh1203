import { Prisma, type ContributionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError, badRequest, forbidden, notFound } from '../../lib/errors.js';
import type {
  CreateContributionInput,
  ResubmitContributionInput,
  ReviewContributionInput,
} from './contributions.schemas.js';

export const ALLOWED_CONTRIBUTION_TRANSITIONS: Record<
  string,
  ContributionStatus[]
> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW: ['NEEDS_REVISION', 'APPROVED', 'REJECTED'],
  NEEDS_REVISION: ['SUBMITTED', 'WITHDRAWN'],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function validateContributionTransition(
  current: ContributionStatus,
  next: ContributionStatus,
) {
  const allowed = ALLOWED_CONTRIBUTION_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new AppError(
      400,
      'INVALID_STATUS_TRANSITION',
      `Không thể chuyển trạng thái đóng góp từ ${current} sang ${next}`,
    );
  }
}

/**
 * Ensures user has at least one verified professional profile (doctor or researcher).
 */
export async function assertVerifiedProfessional(userId: string) {
  const verifiedProfile = await prisma.professionalProfile.findFirst({
    where: {
      userId,
      verificationStatus: 'VERIFIED',
    },
  });

  if (!verifiedProfile) {
    throw new AppError(
      403,
      'PROFESSIONAL_VERIFICATION_REQUIRED',
      'Chương trình Khen thưởng Đóng góp Chuyên môn chỉ dành cho Bác sĩ và Nhà nghiên cứu đã được xác minh tích xanh.',
    );
  }

  return verifiedProfile;
}

const contributionInclude = {
  post: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      media: {
        select: { id: true, url: true, mimeType: true },
      },
    },
  },
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      professionalProfiles: {
        where: { verificationStatus: 'VERIFIED' as const },
        select: { type: true, title: true, specialty: true, institution: true, verificationStatus: true },
      },
    },
  },
  reviews: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      reviewer: {
        select: { id: true, username: true, displayName: true },
      },
    },
  },
};

/**
 * Returns posts created by the user that have not yet been approved or are currently submitted.
 */
export async function getEligiblePostsForContribution(userId: string) {
  await assertVerifiedProfessional(userId);

  const posts = await prisma.post.findMany({
    where: {
      authorId: userId,
      status: 'PUBLISHED',
    },
    orderBy: { createdAt: 'desc' },
    include: {
      contributions: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, category: true, createdAt: true },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
  });

  return posts.map((post) => {
    const activeContribution = post.contributions.find((c) =>
      ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED'].includes(c.status),
    );
    return {
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      hasActiveContribution: Boolean(activeContribution),
      activeContribution: activeContribution ?? null,
    };
  });
}

/**
 * Submits an existing post as a professional knowledge contribution.
 */
export async function createContribution(userId: string, input: CreateContributionInput) {
  await assertVerifiedProfessional(userId);

  const post = await prisma.post.findUnique({
    where: { id: input.postId },
  });

  if (!post) throw notFound('Bài viết không tồn tại');
  if (post.authorId !== userId) {
    throw forbidden('Bạn chỉ có thể nộp các bài viết do chính mình sáng tác');
  }

  // Prevent duplicate active submission
  const existingActive = await prisma.contribution.findFirst({
    where: {
      postId: input.postId,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED'] },
    },
  });

  if (existingActive) {
    throw new AppError(
      400,
      'DUPLICATE_SUBMISSION',
      'Bài viết này đã được nộp hoặc đã được phê duyệt trong chương trình đóng góp.',
    );
  }

  const contribution = await prisma.contribution.create({
    data: {
      userId,
      postId: input.postId,
      category: input.category,
      summary: input.summary,
      status: 'SUBMITTED',
    },
    include: contributionInclude,
  });

  return contribution;
}

/**
 * Resubmits a contribution with updated information after reviewer requested revisions.
 */
export async function resubmitContribution(
  userId: string,
  contributionId: string,
  input: ResubmitContributionInput,
) {
  await assertVerifiedProfessional(userId);

  const existing = await prisma.contribution.findUnique({
    where: { id: contributionId },
  });

  if (!existing) throw notFound('Bài nộp đóng góp không tồn tại');
  if (existing.userId !== userId) throw forbidden('Bạn không có quyền sửa bài nộp này');

  validateContributionTransition(existing.status, 'SUBMITTED');

  const updated = await prisma.contribution.update({
    where: { id: contributionId },
    data: {
      status: 'SUBMITTED',
      summary: input.summary,
      category: input.category ?? existing.category,
    },
    include: contributionInclude,
  });

  return updated;
}

/**
 * Withdraws a contribution (cancels evaluation) before it is finalized.
 */
export async function withdrawContribution(userId: string, contributionId: string) {
  const existing = await prisma.contribution.findUnique({
    where: { id: contributionId },
  });

  if (!existing) throw notFound('Bài nộp đóng góp không tồn tại');
  if (existing.userId !== userId) throw forbidden('Bạn không có quyền rút bài nộp này');

  validateContributionTransition(existing.status, 'WITHDRAWN');

  const updated = await prisma.contribution.update({
    where: { id: contributionId },
    data: { status: 'WITHDRAWN' },
    include: contributionInclude,
  });

  return updated;
}

/**
 * Lists contributions submitted by the current user.
 */
export async function getMyContributions(userId: string) {
  return prisma.contribution.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: contributionInclude,
  });
}

/**
 * Lists published & peer-reviewed contributions across the platform for the Research Hub & Professional Dashboard.
 */
export async function listPublicContributions() {
  return prisma.contribution.findMany({
    where: {
      status: { in: ['APPROVED', 'UNDER_REVIEW', 'SUBMITTED'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: contributionInclude,
  });
}

/**
 * Gets details of a single contribution.
 */
export async function getContributionById(contributionId: string, viewerId: string, viewerRole: string) {
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: contributionInclude,
  });

  if (!contribution) throw notFound('Bài nộp đóng góp không tồn tại');

  if (viewerRole !== 'ADMIN' && contribution.userId !== viewerId) {
    throw forbidden('Bạn không có quyền xem chi tiết bài nộp này');
  }

  return contribution;
}

/**
 * Lists contributions for Admin review queue.
 */
export async function adminListContributions(query?: {
  status?: ContributionStatus;
  category?: string;
}) {
  return prisma.contribution.findMany({
    where: {
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.category ? { category: query.category as any } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: contributionInclude,
  });
}

/**
 * Claims a contribution for review.
 */
export async function adminClaimContribution(adminId: string, contributionId: string) {
  const existing = await prisma.contribution.findUnique({
    where: { id: contributionId },
  });

  if (!existing) throw notFound('Bài nộp đóng góp không tồn tại');

  // Anti-Self-Review: Reviewer cannot review own contribution
  if (existing.userId === adminId) {
    throw new AppError(
      403,
      'SELF_REVIEW_PROHIBITED',
      'Quản trị viên không được phép tự tiếp nhận hoặc đánh giá bài nộp của chính mình.',
    );
  }

  validateContributionTransition(existing.status, 'UNDER_REVIEW');

  return prisma.contribution.update({
    where: { id: contributionId },
    data: {
      status: 'UNDER_REVIEW',
      currentReviewerId: adminId,
    },
    include: contributionInclude,
  });
}

/**
 * Evaluates a contribution with 5 criteria scores (1-5), records review history,
 * and atomically updates wallet and issues credit transaction ledger if APPROVED.
 */
export async function adminReviewContribution(
  adminId: string,
  contributionId: string,
  input: ReviewContributionInput,
) {
  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: { user: true },
  });

  if (!contribution) throw notFound('Bài nộp đóng góp không tồn tại');

  // Anti-Self-Review
  if (contribution.userId === adminId) {
    throw new AppError(
      403,
      'SELF_REVIEW_PROHIBITED',
      'Quản trị viên không được phép tự đánh giá hoặc phê duyệt bài nộp của chính mình.',
    );
  }

  const nextStatus: ContributionStatus =
    input.decision === 'APPROVE'
      ? 'APPROVED'
      : input.decision === 'REQUEST_REVISION'
        ? 'NEEDS_REVISION'
        : 'REJECTED';

  validateContributionTransition(contribution.status, nextStatus);

  // Calculate 5 criteria overall score (Scale 1.00 - 5.00)
  const sumScores =
    input.scoreAccuracy +
    input.scoreRelevance +
    input.scoreUsefulness +
    input.scoreOriginality +
    input.scoreImpact;
  const overall = Number((sumScores / 5).toFixed(2));

  return prisma.$transaction(async (tx) => {
    // 1. Create Review History Record
    const review = await tx.contributionReview.create({
      data: {
        contributionId,
        reviewerId: adminId,
        scoreAccuracy: input.scoreAccuracy,
        scoreRelevance: input.scoreRelevance,
        scoreUsefulness: input.scoreUsefulness,
        scoreOriginality: input.scoreOriginality,
        scoreImpact: input.scoreImpact,
        scoreOverall: new Prisma.Decimal(overall),
        awardedCredits: input.decision === 'APPROVE' ? input.awardedCredits : 0,
        decision: nextStatus,
        feedback: input.feedback,
        supportingEvidence: input.supportingEvidence || null,
      },
    });

    // 2. Update Contribution Status
    const updatedContribution = await tx.contribution.update({
      where: { id: contributionId },
      data: {
        status: nextStatus,
        currentReviewerId: adminId,
        awardCredits: input.decision === 'APPROVE' ? input.awardedCredits : 0,
      },
    });

    // 3. If APPROVED: Atomically Issue Credits into Wallet Ledger
    if (nextStatus === 'APPROVED') {
      const idempotencyKey = `contribution-reward:${contributionId}`;

      // Check if reward was already issued (ledger idempotency)
      const existingTx = await tx.creditTransaction.findUnique({
        where: { idempotencyKey },
      });

      if (!existingTx) {
        // Upsert user's credit wallet
        const wallet = await tx.creditWallet.upsert({
          where: { userId: contribution.userId },
          create: {
            userId: contribution.userId,
            balance: input.awardedCredits,
            totalEarned: input.awardedCredits,
            totalSpent: 0,
          },
          update: {
            balance: { increment: input.awardedCredits },
            totalEarned: { increment: input.awardedCredits },
          },
        });

        // Record immutable ledger transaction
        await tx.creditTransaction.create({
          data: {
            walletId: wallet.id,
            amount: input.awardedCredits,
            type: 'CONTRIBUTION_REWARD',
            referenceId: contributionId,
            idempotencyKey,
            description: `Khen thưởng bài đóng góp học thuật/chuyên môn (${contribution.category}): +${input.awardedCredits} tín chỉ`,
            actorId: adminId,
            contributionId,
          },
        });
      }
    }

    // 4. Dispatch Notification
    const dedupeKey = `contribution:${contributionId}:${nextStatus}:${Date.now()}`;
    await tx.notification.create({
      data: {
        recipientId: contribution.userId,
        actorId: adminId,
        type: 'CONTRIBUTION_UPDATE',
        postId: contribution.postId,
        dedupeKey,
      },
    });

    void review;
    return tx.contribution.findUniqueOrThrow({
      where: { id: updatedContribution.id },
      include: contributionInclude,
    });
  });
}
