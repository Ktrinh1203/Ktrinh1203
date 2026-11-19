import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { assertVerifiedProfessional } from '../contributions/contributions.service.js';
import { realtimeBus } from '../realtime/realtime.bus.js';
import {
  appendChainedLedgerEntry,
  computeInternalSpendDeduction,
  formatFullWalletDto,
  lockWalletForUpdate,
  verifyWalletIntegrity,
  type CreditBucket,
} from './ledger.crypto.js';
import type {
  AdjustWalletInput,
  CreateRewardCatalogInput,
  RedeemRewardInput,
  ReviewRedemptionInput,
  UpdateRewardCatalogInput,
} from './rewards.schemas.js';

const ONBOARDING_GRANT_AMOUNT = 250;

export { verifyWalletIntegrity };

export async function getOrCreateUserWallet(userId: string) {
  return prisma.$transaction((tx) => lockWalletForUpdate(tx, userId));
}

export async function getUserWalletWithHistory(userId: string) {
  const wallet = await getOrCreateUserWallet(userId);

  const transactions = await prisma.creditTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });

  return {
    wallet: formatFullWalletDto(wallet),
    transactions,
  };
}

export async function claimOnboardingGrant(userId: string) {
  const idempotencyKey = `starter-grant:${userId}`;

  try {
    return await prisma.$transaction(async (tx) => {
      const wallet = await lockWalletForUpdate(tx, userId);

      const existingTx = await tx.creditTransaction.findUnique({
        where: { idempotencyKey },
      });

      if (existingTx) {
        return {
          granted: false,
          amount: 0,
          wallet: formatFullWalletDto(wallet),
        };
      }

      const nextBalance = wallet.balance + ONBOARDING_GRANT_AMOUNT;
      const updated = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: {
          balance: nextBalance,
          promoCredits: wallet.promoCredits + ONBOARDING_GRANT_AMOUNT,
          totalEarned: wallet.totalEarned + ONBOARDING_GRANT_AMOUNT,
        },
      });

      const { wallet: sealedWallet } = await appendChainedLedgerEntry(tx, {
        wallet: updated,
        amount: ONBOARDING_GRANT_AMOUNT,
        balanceAfter: nextBalance,
        bucket: 'PROMO',
        type: 'STARTER_GRANT',
        referenceId: userId,
        idempotencyKey,
        description: `Cấp Credit khởi đầu hệ sinh thái NeuroLink (+${ONBOARDING_GRANT_AMOUNT} Credit)`,
        actorId: userId,
      });

      return {
        granted: true,
        amount: ONBOARDING_GRANT_AMOUNT,
        wallet: formatFullWalletDto(sealedWallet),
      };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const wallet = await getOrCreateUserWallet(userId);
      return {
        granted: false,
        amount: 0,
        wallet: formatFullWalletDto(wallet),
      };
    }
    throw err;
  }
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
  const reward = await prisma.rewardCatalog.findUnique({
    where: { id: input.rewardId },
  });

  if (!reward || !reward.isActive) {
    throw badRequest('Phần thưởng này hiện không khả dụng hoặc đã ngừng cung cấp.');
  }

  // Only require verified professional credential for accredited CME courses & clinical conferences
  if (reward.category === 'CONFERENCE_ACCESS' || reward.category === 'PROFESSIONAL_COURSE') {
    await assertVerifiedProfessional(userId);
  }

  // Strict Monetary Protection Guard
  if (reward.isMonetary && !reward.payoutEnabled) {
    throw new AppError(
      400,
      'MONETARY_PAYOUT_DISABLED',
      'Đổi thưởng tiền mặt trực tiếp qua danh mục hiện chưa được kích hoạt. Bác sĩ & tác giả vui lòng sử dụng tính năng Rút về ngân hàng cho Credit thu nhập.',
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const freshReward = await tx.rewardCatalog.findUnique({
      where: { id: reward.id },
    });
    if (!freshReward || !freshReward.isActive) {
      throw badRequest('Phần thưởng này hiện không khả dụng.');
    }
    if (freshReward.stockQuantity !== null && freshReward.redeemedCount >= freshReward.stockQuantity) {
      throw new AppError(
        400,
        'OUT_OF_STOCK',
        'Phần thưởng này đã hết số lượng đăng ký cho đợt hiện tại.',
      );
    }

    // Lock wallet record FOR UPDATE (prevent race conditions / double-spending)
    const wallet = await lockWalletForUpdate(tx, userId);
    const deduction = computeInternalSpendDeduction(wallet, freshReward.creditCost);

    // 1. Debit wallet buckets atomically
    const updatedWallet = await tx.creditWallet.update({
      where: { id: wallet.id },
      data: {
        balance: deduction.nextBalance,
        promoCredits: deduction.nextPromo,
        purchasedCredits: deduction.nextPurchased,
        earnedCredits: deduction.nextEarned,
        totalSpent: { increment: freshReward.creditCost },
      },
    });

    // 2. Create Redemption Request
    const redemption = await tx.rewardRedemption.create({
      data: {
        rewardId: freshReward.id,
        userId,
        creditCost: freshReward.creditCost,
        status: 'REQUESTED',
        userNote: input.userNote || null,
      },
    });

    // 3. Record Chained Immutable Ledger Transaction
    await appendChainedLedgerEntry(tx, {
      wallet: updatedWallet,
      amount: -freshReward.creditCost,
      balanceAfter: deduction.nextBalance,
      bucket: deduction.bucket,
      type: 'REWARD_REDEMPTION',
      referenceId: redemption.id,
      idempotencyKey: `redemption:${redemption.id}`,
      description: `Đổi ưu đãi: ${freshReward.name} (-${freshReward.creditCost} Credit)`,
      actorId: userId,
      redemptionId: redemption.id,
    });

    // 4. Increment redeemed count on catalog
    await tx.rewardCatalog.update({
      where: { id: freshReward.id },
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
      remainingBalance: deduction.nextBalance,
    };
  });

  realtimeBus.emitToUser(userId, 'wallet:updated', { balance: result.remainingBalance });
  return result;
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
      payoutEnabled: false,
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
      payoutEnabled: false,
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

  const updated = await prisma.$transaction(async (tx) => {
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

    if (nextStatus === 'REJECTED' || nextStatus === 'CANCELLED') {
      const refundIdempotencyKey = `refund-redemption:${redemptionId}`;

      const existingRefund = await tx.creditTransaction.findUnique({
        where: { idempotencyKey: refundIdempotencyKey },
      });

      if (!existingRefund) {
        const locked = await lockWalletForUpdate(tx, redemption.userId);
        const nextBalance = locked.balance + redemption.creditCost;

        const refundedWallet = await tx.creditWallet.update({
          where: { id: locked.id },
          data: {
            balance: nextBalance,
            promoCredits: locked.promoCredits + redemption.creditCost,
            totalSpent: Math.max(0, locked.totalSpent - redemption.creditCost),
          },
        });

        await appendChainedLedgerEntry(tx, {
          wallet: refundedWallet,
          amount: redemption.creditCost,
          balanceAfter: nextBalance,
          bucket: 'PROMO',
          type: 'REFUND',
          referenceId: redemptionId,
          idempotencyKey: refundIdempotencyKey,
          description: `Hoàn trả Credit đổi ưu đãi không thành công: ${redemption.reward.name} (+${redemption.creditCost} Credit). Lý do: ${input.adminNote || 'Yêu cầu bị từ chối'}`,
          actorId: adminId,
          redemptionId,
        });

        if (redemption.reward.redeemedCount > 0) {
          await tx.rewardCatalog.update({
            where: { id: redemption.rewardId },
            data: { redeemedCount: { decrement: 1 } },
          });
        }
      }
    }

    const updatedRecord = await tx.rewardRedemption.update({
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

    await tx.notification.create({
      data: {
        recipientId: redemption.userId,
        actorId: adminId,
        type: 'REWARD_UPDATE',
        dedupeKey: `redemption:${redemptionId}:${nextStatus}:${Date.now()}`,
      },
    });

    return updatedRecord;
  });

  realtimeBus.emitToUser(redemption.userId, 'wallet:updated', { redemptionId });
  return updated;
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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      },
    },
  });
}

export async function adminAdjustWallet(adminId: string, walletId: string, input: AdjustWalletInput) {
  const existing = await prisma.creditWallet.findUnique({
    where: { id: walletId },
  });

  if (!existing) throw notFound('Ví Credit không tồn tại');

  const result = await prisma.$transaction(async (tx) => {
    const locked = await lockWalletForUpdate(tx, existing.userId);

    if (locked.balance + input.amount < 0) {
      throw new AppError(
        400,
        'NEGATIVE_BALANCE_NOT_ALLOWED',
        `Không thể điều chỉnh số dư âm. Số dư hiện tại là ${locked.balance}, điều chỉnh ${input.amount} sẽ dẫn đến số dư âm.`,
      );
    }

    let nextBalance = locked.balance + input.amount;
    let nextPromo = locked.promoCredits;
    let nextPurchased = locked.purchasedCredits;
    let nextEarned = locked.earnedCredits;
    let bucket: CreditBucket = 'PROMO';

    if (input.amount > 0) {
      nextPromo += input.amount;
    } else {
      const deduction = computeInternalSpendDeduction(locked, Math.abs(input.amount));
      nextBalance = deduction.nextBalance;
      nextPromo = deduction.nextPromo;
      nextPurchased = deduction.nextPurchased;
      nextEarned = deduction.nextEarned;
      bucket = deduction.bucket;
    }

    const updated = await tx.creditWallet.update({
      where: { id: locked.id },
      data: {
        balance: nextBalance,
        promoCredits: nextPromo,
        purchasedCredits: nextPurchased,
        earnedCredits: nextEarned,
        totalEarned: input.amount > 0 ? { increment: input.amount } : undefined,
        totalSpent: input.amount < 0 ? { increment: Math.abs(input.amount) } : undefined,
      },
    });

    const { transaction: txRecord, wallet: sealedWallet } = await appendChainedLedgerEntry(tx, {
      wallet: updated,
      amount: input.amount,
      balanceAfter: nextBalance,
      bucket,
      type: 'ADMIN_ADJUSTMENT',
      description: `Quản trị viên điều chỉnh số dư ví: ${input.amount > 0 ? '+' : ''}${input.amount} Credit. Lý do: ${input.reason}`,
      actorId: adminId,
    });

    return { wallet: sealedWallet, transaction: txRecord };
  });

  realtimeBus.emitToUser(existing.userId, 'wallet:updated', { balance: result.wallet.balance });
  return result;
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
