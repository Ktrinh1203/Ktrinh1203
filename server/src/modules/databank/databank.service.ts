import type { ClinicalCategory, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError, badRequest, conflict, notFound } from '../../lib/errors.js';
import { assertVerifiedProfessional } from '../contributions/contributions.service.js';
import { userSummarySelect } from '../users/users.select.js';
import type { CreateDataBankListingInput } from './databank.schemas.js';

const listingInclude = {
  author: { select: userSummarySelect },
} satisfies Prisma.DataBankListingInclude;

type ListingRow = Prisma.DataBankListingGetPayload<{ include: typeof listingInclude }>;

interface PreviewMetrics {
  meanDar: number;
  meanBsi: number;
  meanTar: number;
  meanWpli: number;
  dominantBand: string;
}

function parsePreviewMetrics(raw: string): PreviewMetrics {
  try {
    return JSON.parse(raw) as PreviewMetrics;
  } catch {
    return { meanDar: 0, meanBsi: 0, meanTar: 0, meanWpli: 0, dominantBand: 'Alpha' };
  }
}

function formatListing(row: ListingRow, viewerId: string, purchased: boolean) {
  const isAuthor = row.authorId === viewerId;
  const hasAccess = row.priceCredits === 0 || isAuthor || purchased;
  return {
    id: row.id,
    authorId: row.authorId,
    datasetId: row.datasetId,
    title: row.title,
    summary: row.summary,
    clinicalCategory: row.clinicalCategory,
    methodologyNote: row.methodologyNote,
    sampleCount: row.sampleCount,
    channelsSpec: row.channelsSpec,
    samplingRateHz: row.samplingRateHz,
    priceCredits: row.priceCredits,
    downloadsCount: row.downloadsCount,
    previewMetrics: parsePreviewMetrics(row.previewMetricsJson),
    hasAccess,
    isAuthor,
    payloadCsv: hasAccess ? row.payloadCsvJson : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: row.author,
  };
}

export async function listDataBankListings(
  viewerId: string,
  filters: { clinicalCategory?: ClinicalCategory; q?: string },
) {
  const q = filters.q?.trim();
  const [rows, purchases] = await Promise.all([
    prisma.dataBankListing.findMany({
      where: {
        status: 'PUBLISHED',
        ...(filters.clinicalCategory ? { clinicalCategory: filters.clinicalCategory } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { summary: { contains: q, mode: 'insensitive' } },
                { methodologyNote: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ downloadsCount: 'desc' }, { createdAt: 'desc' }],
      take: 60,
      include: listingInclude,
    }),
    prisma.dataBankPurchase.findMany({
      where: { buyerId: viewerId },
      select: { listingId: true },
    }),
  ]);

  const purchasedIds = new Set(purchases.map((p) => p.listingId));
  return rows.map((row) => formatListing(row, viewerId, purchasedIds.has(row.id)));
}

export async function getDataBankListingById(listingId: string, viewerId: string) {
  const [row, purchase] = await Promise.all([
    prisma.dataBankListing.findUnique({
      where: { id: listingId },
      include: listingInclude,
    }),
    prisma.dataBankPurchase.findUnique({
      where: { listingId_buyerId: { listingId, buyerId: viewerId } },
      select: { id: true },
    }),
  ]);

  if (!row || (row.status !== 'PUBLISHED' && row.authorId !== viewerId)) {
    throw notFound('Gói dữ liệu Data Bank không tồn tại.');
  }

  return formatListing(row, viewerId, Boolean(purchase));
}

export async function createDataBankListing(authorId: string, input: CreateDataBankListingInput) {
  await assertVerifiedProfessional(authorId);

  const row = await prisma.dataBankListing.create({
    data: {
      authorId,
      datasetId: input.datasetId ?? null,
      title: input.title,
      summary: input.summary,
      clinicalCategory: input.clinicalCategory,
      methodologyNote: input.methodologyNote,
      sampleCount: input.sampleCount,
      channelsSpec: input.channelsSpec,
      samplingRateHz: input.samplingRateHz,
      priceCredits: input.priceCredits,
      previewMetricsJson: JSON.stringify(input.previewMetrics),
      payloadCsvJson: input.payloadCsv,
      status: 'PUBLISHED',
    },
    include: listingInclude,
  });

  return formatListing(row, authorId, true);
}

export async function purchaseDataBankListing(buyerId: string, listingId: string) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.dataBankListing.findUnique({
      where: { id: listingId },
      include: listingInclude,
    });

    if (!listing || listing.status !== 'PUBLISHED') {
      throw notFound('Gói dữ liệu Data Bank không tồn tại hoặc đã ngừng phát hành.');
    }

    if (listing.authorId === buyerId) {
      throw badRequest('Bạn là tác giả của gói dữ liệu này và đã có toàn quyền truy cập.');
    }

    const existingPurchase = await tx.dataBankPurchase.findUnique({
      where: { listingId_buyerId: { listingId, buyerId } },
    });
    if (existingPurchase) {
      throw conflict('Bạn đã mở khóa gói dữ liệu này trước đó.', 'ALREADY_PURCHASED');
    }

    let buyerWallet = await tx.creditWallet.findUnique({ where: { userId: buyerId } });

    if (listing.priceCredits > 0) {
      if (!buyerWallet) {
        throw new AppError(
          400,
          'INSUFFICIENT_CREDITS',
          `Số dư tín chỉ không đủ. Gói dữ liệu yêu cầu ${listing.priceCredits} tín chỉ nhưng bạn hiện có 0 tín chỉ.`,
        );
      }

      const debit = await tx.creditWallet.updateMany({
        where: { userId: buyerId, balance: { gte: listing.priceCredits } },
        data: {
          balance: { decrement: listing.priceCredits },
          totalSpent: { increment: listing.priceCredits },
        },
      });

      if (debit.count === 0) {
        throw new AppError(
          400,
          'INSUFFICIENT_CREDITS',
          `Số dư tín chỉ không đủ. Cần ${listing.priceCredits} tín chỉ nhưng số dư hiện tại chỉ có ${buyerWallet.balance} tín chỉ.`,
        );
      }

      buyerWallet = await tx.creditWallet.findUniqueOrThrow({ where: { userId: buyerId } });

      await tx.creditTransaction.create({
        data: {
          walletId: buyerWallet.id,
          amount: -listing.priceCredits,
          type: 'DATABANK_PURCHASE',
          referenceId: listing.id,
          idempotencyKey: `databank-purchase:${listing.id}:${buyerId}`,
          description: `Mở khóa gói dữ liệu "${listing.title}" (-${listing.priceCredits} tín chỉ)`,
          actorId: buyerId,
        },
      });

      const authorWallet = await tx.creditWallet.upsert({
        where: { userId: listing.authorId },
        create: {
          userId: listing.authorId,
          balance: listing.priceCredits,
          totalEarned: listing.priceCredits,
          totalSpent: 0,
        },
        update: {
          balance: { increment: listing.priceCredits },
          totalEarned: { increment: listing.priceCredits },
        },
      });

      await tx.creditTransaction.create({
        data: {
          walletId: authorWallet.id,
          amount: listing.priceCredits,
          type: 'DATABANK_ROYALTY',
          referenceId: listing.id,
          idempotencyKey: `databank-royalty:${listing.id}:${buyerId}`,
          description: `Tác quyền Data Bank cho gói "${listing.title}" (+${listing.priceCredits} tín chỉ)`,
          actorId: buyerId,
        },
      });

      await tx.notification.upsert({
        where: { dedupeKey: `databank-sale:${listing.id}:${buyerId}` },
        create: {
          recipientId: listing.authorId,
          actorId: buyerId,
          type: 'DATABANK_UPDATE',
          dedupeKey: `databank-sale:${listing.id}:${buyerId}`,
        },
        update: {
          readAt: null,
        },
      });
    }

    await tx.dataBankPurchase.create({
      data: {
        listingId: listing.id,
        buyerId,
        creditsPaid: listing.priceCredits,
      },
    });

    const updatedListing = await tx.dataBankListing.update({
      where: { id: listing.id },
      data: { downloadsCount: { increment: 1 } },
      include: listingInclude,
    });

    return {
      listing: formatListing(updatedListing, buyerId, true),
      remainingBalance: buyerWallet?.balance ?? 0,
    };
  });
}
