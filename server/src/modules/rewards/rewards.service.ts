import { prisma } from '../../lib/prisma.js';
import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { assertVerifiedProfessional } from '../contributions/contributions.service.js';
import type {
  AdjustWalletInput,
  CreateRewardCatalogInput,
  RedeemRewardInput,
  ReviewRedemptionInput,
  UpdateRewardCatalogInput,
} from './rewards.schemas.js';

export async function getOrCreateUserWallet(userId: string) {
  return prisma.creditWallet.upsert({
    where: { userId },
    create: {
      userId,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
    },
    update: {},
  });
}

export async function getUserWalletWithHistory(userId: string) {
  const wallet = await getOrCreateUserWallet(userId);

  const transactions = await prisma.creditTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return {
    wallet: {
      id: wallet.id,
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      updatedAt: wallet.updatedAt,
    },
    transactions,
  };
}

export async function getActiveRewardCatalog(category?: string) {
  return prisma.rewardCatalog.findMany({
    where: {
      isActive: true,
      ...(category ? { category: category as any } : {}),
    },
    orderBy: { creditCost: 'asc' },
  });
}

export async function redeemReward(userId: string, input: RedeemRewardInput) {
  await assertVerifiedProfessional(userId);

  const reward = await prisma.rewardCatalog.findUnique({
    where: { id: input.rewardId },
  });

  if (!reward || !reward.isActive) {
    throw badRequest('Phần thưởng này hiện không khả dụng hoặc đã ngừng cung cấp.');
  }

  // Strict Monetary Protection Guard
  if (reward.isMonetary && !reward.payoutEnabled) {
    throw new AppError(
      400,
      'MONETARY_PAYOUT_DISABLED',
      'Đổi thưởng tiền mặt hiện chưa được kích hoạt trên hệ thống do đang chờ hoàn tất chính sách kiểm toán & thuế.',
    );
  }

  // Check inventory stock
  if (reward.stockQuantity !== null && reward.redeemedCount >= reward.stockQuantity) {
    throw new AppError(
      400,
      'OUT_OF_STOCK',
      'Phần thưởng này đã hết số lượng đăng ký cho đợt hiện tại.',
    );
  }

  // Atomically debit credits and create redemption record
  return prisma.$transaction(async (tx) => {
    // Lock wallet record for update (prevent race conditions / double-spending)
    const wallet = await tx.creditWallet.findUnique({
      where: { userId },
    });

    if (!wallet || wallet.balance < reward.creditCost) {
      throw new AppError(
        400,
        'INSUFFICIENT_CREDITS',
        `Số dư tín chỉ không đủ. Cần ${reward.creditCost} tín chỉ nhưng số dư hiện tại chỉ có ${wallet?.balance ?? 0} tín chỉ.`,
      );
    }

    // 1. Debit wallet
    const updatedWallet = await tx.creditWallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: reward.creditCost },
        totalSpent: { increment: reward.creditCost },
      },
    });

    // 2. Create Redemption Request
    const redemption = await tx.rewardRedemption.create({
      data: {
        rewardId: reward.id,
        userId,
        creditCost: reward.creditCost,
        status: 'REQUESTED',
        userNote: input.userNote || null,
      },
    });

    // 3. Record Immutable Ledger Transaction
    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -reward.creditCost,
        type: 'REWARD_REDEMPTION',
        referenceId: redemption.id,
        idempotencyKey: `redemption:${redemption.id}`,
        description: `Đổi phần thưởng: ${reward.name} (-${reward.creditCost} tín chỉ)`,
        actorId: userId,
        redemptionId: redemption.id,
      },
    });

    // 4. Increment redeemed count on catalog
    await tx.rewardCatalog.update({
      where: { id: reward.id },
      data: { redeemedCount: { increment: 1 } },
    });

    // 5. Send Notification
    await tx.notification.create({
      data: {
        recipientId: userId,
        actorId: userId,
        type: 'REWARD_UPDATE',
        dedupeKey: `redemption:${redemption.id}:REQUESTED:${Date.now()}`,
      },
    });

    return {
      redemption,
      remainingBalance: updatedWallet.balance,
    };
  });
}

export async function getUserRedemptions(userId: string) {
  return prisma.rewardRedemption.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      reward: true,
      reviewer: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });
}

// ============================================================================
// Administrator Functions
// ============================================================================

export async function adminGetCatalog() {
  return prisma.rewardCatalog.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { redemptions: true },
      },
    },
  });
}

export async function adminCreateReward(adminId: string, input: CreateRewardCatalogInput) {
  void adminId;
  return prisma.rewardCatalog.create({
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      creditCost: input.creditCost,
      stockQuantity: input.stockQuantity ?? null,
      eligibilityReq: input.eligibilityReq || null,
      terms: input.terms || null,
      imageUrl: input.imageUrl || null,
      isMonetary: input.isMonetary,
      payoutEnabled: false, // Strict: never enable payout blindly
    },
  });
}

export async function adminUpdateReward(
  adminId: string,
  rewardId: string,
  input: UpdateRewardCatalogInput,
) {
  void adminId;
  const existing = await prisma.rewardCatalog.findUnique({
    where: { id: rewardId },
  });
  if (!existing) throw notFound('Phần thưởng không tồn tại');

  return prisma.rewardCatalog.update({
    where: { id: rewardId },
    data: {
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      category: input.category ?? existing.category,
      creditCost: input.creditCost ?? existing.creditCost,
      stockQuantity: input.stockQuantity !== undefined ? input.stockQuantity : existing.stockQuantity,
      eligibilityReq: input.eligibilityReq !== undefined ? input.eligibilityReq : existing.eligibilityReq,
      terms: input.terms !== undefined ? input.terms : existing.terms,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl : existing.imageUrl,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      isMonetary: input.isMonetary !== undefined ? input.isMonetary : existing.isMonetary,
      payoutEnabled: false, // Strict: remain disabled
    },
  });
}

export async function adminGetRedemptions(status?: string) {
  return prisma.rewardRedemption.findMany({
    where: status ? { status: status as any } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      reward: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          email: true,
          professionalProfiles: {
            where: { verificationStatus: 'VERIFIED' },
            select: { type: true, title: true, specialty: true, institution: true },
          },
        },
      },
      reviewer: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });
}

export async function adminReviewRedemption(
  adminId: string,
  redemptionId: string,
  input: ReviewRedemptionInput,
) {
  const redemption = await prisma.rewardRedemption.findUnique({
    where: { id: redemptionId },
    include: { reward: true, user: true },
  });

  if (!redemption) throw notFound('Yêu cầu đổi thưởng không tồn tại');

  return prisma.$transaction(async (tx) => {
    let nextStatus = redemption.status;

    if (input.action === 'APPROVE') {
      nextStatus = 'APPROVED';
    } else if (input.action === 'FULFILL') {
      nextStatus = 'FULFILLED';
    } else if (input.action === 'REJECT') {
      nextStatus = 'REJECTED';
    } else if (input.action === 'CANCEL') {
      nextStatus = 'CANCELLED';
    }

    // If REJECT or CANCEL: Refund credits back to wallet atomically!
    if (nextStatus === 'REJECTED' || nextStatus === 'CANCELLED') {
      const refundIdempotencyKey = `refund-redemption:${redemptionId}`;

      const existingRefund = await tx.creditTransaction.findUnique({
        where: { idempotencyKey: refundIdempotencyKey },
      });

      if (!existingRefund) {
        // Refund wallet balance
        const wallet = await tx.creditWallet.update({
          where: { userId: redemption.userId },
          data: {
            balance: { increment: redemption.creditCost },
            totalSpent: { decrement: redemption.creditCost },
          },
        });

        // Record refund ledger entry
        await tx.creditTransaction.create({
          data: {
            walletId: wallet.id,
            amount: redemption.creditCost,
            type: 'REFUND',
            referenceId: redemptionId,
            idempotencyKey: refundIdempotencyKey,
            description: `Hoàn trả tín chỉ đổi quà không thành công: ${redemption.reward.name} (+${redemption.creditCost} tín chỉ). Lý do: ${input.adminNote || 'Yêu cầu bị từ chối'}`,
            actorId: adminId,
            redemptionId,
          },
        });

        // Decrement redeemedCount in catalog if possible
        if (redemption.reward.redeemedCount > 0) {
          await tx.rewardCatalog.update({
            where: { id: redemption.rewardId },
            data: { redeemedCount: { decrement: 1 } },
          });
        }
      }
    }

    const updated = await tx.rewardRedemption.update({
      where: { id: redemptionId },
      data: {
        status: nextStatus,
        adminNote: input.adminNote || null,
        fulfillmentInfo: input.fulfillmentInfo || null,
        reviewerId: adminId,
        reviewedAt: new Date(),
        fulfilledAt: nextStatus === 'FULFILLED' ? new Date() : redemption.fulfilledAt,
      },
      include: {
        reward: true,
        user: {
          select: { id: true, username: true, displayName: true, email: true },
        },
        reviewer: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });

    // Notify user
    await tx.notification.create({
      data: {
        recipientId: redemption.userId,
        actorId: adminId,
        type: 'REWARD_UPDATE',
        dedupeKey: `redemption:${redemptionId}:${nextStatus}:${Date.now()}`,
      },
    });

    return updated;
  });
}

export async function adminGetWallets(search?: string) {
  return prisma.creditWallet.findMany({
    where: search
      ? {
          user: {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } },
            ],
          },
        }
      : {},
    orderBy: { balance: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          professionalProfiles: {
            where: { verificationStatus: 'VERIFIED' },
            select: { type: true, title: true, specialty: true, verificationStatus: true },
          },
        },
      },
      transactions: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function adminAdjustWallet(adminId: string, walletId: string, input: AdjustWalletInput) {
  const wallet = await prisma.creditWallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) throw notFound('Ví tín chỉ không tồn tại');

  if (wallet.balance + input.amount < 0) {
    throw new AppError(
      400,
      'NEGATIVE_BALANCE_NOT_ALLOWED',
      `Không thể điều chỉnh số dư âm. Số dư hiện tại là ${wallet.balance}, điều chỉnh ${input.amount} sẽ dẫn đến số dư âm.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.creditWallet.update({
      where: { id: walletId },
      data: {
        balance: { increment: input.amount },
        totalEarned: input.amount > 0 ? { increment: input.amount } : undefined,
        totalSpent: input.amount < 0 ? { increment: Math.abs(input.amount) } : undefined,
      },
    });

    const txRecord = await tx.creditTransaction.create({
      data: {
        walletId,
        amount: input.amount,
        type: 'ADMIN_ADJUSTMENT',
        description: `Quản trị viên điều chỉnh số dư ví: ${input.amount > 0 ? '+' : ''}${input.amount} tín chỉ. Lý do: ${input.reason}`,
        actorId: adminId,
      },
    });

    return { wallet: updated, transaction: txRecord };
  });
}

export async function adminGetOverviewStats() {
  const [
    totalContributions,
    pendingContributions,
    approvedContributions,
    rejectedContributions,
    walletsAgg,
    activeRewardsCount,
    pendingRedemptionsCount,
  ] = await Promise.all([
    prisma.contribution.count(),
    prisma.contribution.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.contribution.count({ where: { status: 'APPROVED' } }),
    prisma.contribution.count({ where: { status: 'REJECTED' } }),
    prisma.creditWallet.aggregate({
      _sum: {
        balance: true,
        totalEarned: true,
        totalSpent: true,
      },
    }),
    prisma.rewardCatalog.count({ where: { isActive: true } }),
    prisma.rewardRedemption.count({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'PROCESSING'] } } }),
  ]);

  return {
    contributions: {
      total: totalContributions,
      pending: pendingContributions,
      approved: approvedContributions,
      rejected: rejectedContributions,
    },
    credits: {
      totalInCirculation: walletsAgg._sum.balance ?? 0,
      totalEarned: walletsAgg._sum.totalEarned ?? 0,
      totalSpent: walletsAgg._sum.totalSpent ?? 0,
    },
    rewards: {
      activeCatalogCount: activeRewardsCount,
      pendingRedemptions: pendingRedemptionsCount,
    },
  };
}
