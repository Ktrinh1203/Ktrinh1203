import type { ClinicalCategory, ConsultationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError, badRequest, forbidden, notFound } from '../../lib/errors.js';
import { assertVerifiedProfessional } from '../contributions/contributions.service.js';
import { formatNeuralSample, neuralSampleInclude } from '../neural-db/neural-db.service.js';
import { userSummarySelect } from '../users/users.select.js';
import type {
  CreateConsultationInput,
  CreateConsultationReplyInput,
} from './consultations.schemas.js';

const ticketInclude = {
  requester: { select: userSummarySelect },
  claimedBy: { select: userSummarySelect },
  neuralSample: { include: neuralSampleInclude },
  replies: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      responder: { select: userSummarySelect },
    },
  },
} satisfies Prisma.ConsultationTicketInclude;

type TicketRow = Prisma.ConsultationTicketGetPayload<{ include: typeof ticketInclude }>;

function formatTicket(ticket: TicketRow) {
  return {
    id: ticket.id,
    requesterId: ticket.requesterId,
    claimedById: ticket.claimedById,
    datasetId: ticket.datasetId,
    neuralSampleId: ticket.neuralSampleId,
    title: ticket.title,
    symptomSummary: ticket.symptomSummary,
    clinicalCategory: ticket.clinicalCategory,
    bountyCredits: ticket.bountyCredits,
    urgentRedFlag: ticket.urgentRedFlag,
    status: ticket.status,
    acceptedReplyId: ticket.acceptedReplyId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    requester: ticket.requester,
    claimedBy: ticket.claimedBy,
    neuralSample: ticket.neuralSample ? formatNeuralSample(ticket.neuralSample) : null,
    replies: ticket.replies.map((r) => ({
      id: r.id,
      ticketId: r.ticketId,
      responderId: r.responderId,
      responderTier: r.responderTier,
      waveAnalysisText: r.waveAnalysisText,
      clinicalGuidanceText: r.clinicalGuidanceText,
      recommendedFollowUp: r.recommendedFollowUp,
      rating: r.rating,
      isAccepted: r.isAccepted,
      createdAt: r.createdAt,
      responder: r.responder,
    })),
  };
}

const ACUTE_RED_FLAG_KEYWORDS = [
  'dot quy',
  'stroke',
  'xuat huyet nao',
  'thieu mau nao',
  'liet nua nguoi',
  'that ngon',
  'meo mieng',
  'hon me',
  'cap cuu',
  'tpa',
  'lvo',
  'ich',
  'co giat lien tuc',
  'dong kinh lien tuc',
];

function normalizeForKeywordMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function hasAcuteStrokeKeywords(title: string, summary: string): boolean {
  const combined = normalizeForKeywordMatch(`${title} ${summary}`);
  return ACUTE_RED_FLAG_KEYWORDS.some((kw) => {
    const regex = new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`, 'i');
    return regex.test(combined);
  });
}

export async function listConsultations(
  userId: string,
  filters: {
    scope: 'all' | 'mine' | 'queue';
    clinicalCategory?: ClinicalCategory;
    status?: ConsultationStatus;
  },
) {
  const where: Prisma.ConsultationTicketWhereInput = {
    ...(filters.clinicalCategory ? { clinicalCategory: filters.clinicalCategory } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  if (filters.scope === 'mine') {
    where.OR = [
      { requesterId: userId },
      { claimedById: userId },
      { replies: { some: { responderId: userId } } },
    ];
  } else if (filters.scope === 'queue' && !filters.status) {
    where.status = { in: ['OPEN', 'CLAIMED'] };
  }

  const rows = await prisma.consultationTicket.findMany({
    where,
    orderBy: [{ urgentRedFlag: 'desc' }, { createdAt: 'desc' }],
    take: 80,
    include: ticketInclude,
  });

  return rows.map(formatTicket);
}

export async function createConsultation(userId: string, input: CreateConsultationInput) {
  return prisma.$transaction(async (tx) => {
    let attachedSample: { bsi: number; dar: number; tpaLockoutTriggered: boolean } | null = null;
    if (input.neuralSampleId) {
      attachedSample = await tx.neuralTrainingSample.findUnique({
        where: { id: input.neuralSampleId },
        select: { bsi: true, dar: true, tpaLockoutTriggered: true },
      });
      if (!attachedSample) {
        throw notFound('Mẫu điện não Neural DB đính kèm không tồn tại.');
      }
    }

    const urgentRedFlag =
      Boolean(
        attachedSample &&
          (attachedSample.bsi >= 0.22 ||
            attachedSample.dar >= 3.2 ||
            attachedSample.tpaLockoutTriggered),
      ) || hasAcuteStrokeKeywords(input.title, input.symptomSummary);

    let wallet = await tx.creditWallet.findUnique({ where: { userId } });

    if (input.bountyCredits > 0) {
      if (!wallet) {
        throw new AppError(
          400,
          'INSUFFICIENT_CREDITS',
          `Số dư tín chỉ không đủ. Cần ${input.bountyCredits} tín chỉ ký quỹ nhưng hiện có 0 tín chỉ.`,
        );
      }

      const debit = await tx.creditWallet.updateMany({
        where: { userId, balance: { gte: input.bountyCredits } },
        data: {
          balance: { decrement: input.bountyCredits },
          totalSpent: { increment: input.bountyCredits },
        },
      });

      if (debit.count === 0) {
        throw new AppError(
          400,
          'INSUFFICIENT_CREDITS',
          `Số dư tín chỉ không đủ. Cần ${input.bountyCredits} tín chỉ ký quỹ nhưng số dư hiện tại chỉ có ${wallet.balance} tín chỉ.`,
        );
      }

      wallet = await tx.creditWallet.findUniqueOrThrow({ where: { userId } });
    }

    const ticket = await tx.consultationTicket.create({
      data: {
        requesterId: userId,
        datasetId: input.datasetId ?? null,
        neuralSampleId: input.neuralSampleId ?? null,
        title: input.title,
        symptomSummary: input.symptomSummary,
        clinicalCategory: input.clinicalCategory,
        bountyCredits: input.bountyCredits,
        urgentRedFlag,
        status: 'OPEN',
      },
    });

    if (input.bountyCredits > 0 && wallet) {
      await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          amount: -input.bountyCredits,
          type: 'CONSULTATION_ESCROW',
          referenceId: ticket.id,
          idempotencyKey: `consultation-escrow:${ticket.id}`,
          description: `Ký quỹ tín chỉ tư vấn ca "${input.title}" (-${input.bountyCredits} tín chỉ)`,
          actorId: userId,
        },
      });
    }

    const fullTicket = await tx.consultationTicket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: ticketInclude,
    });

    return {
      ticket: formatTicket(fullTicket),
      remainingBalance: wallet?.balance ?? 0,
    };
  });
}

export async function claimConsultation(responderId: string, ticketId: string) {
  await assertVerifiedProfessional(responderId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.consultationTicket.findUnique({ where: { id: ticketId } });
    if (!existing) throw notFound('Phiếu tư vấn sóng não không tồn tại.');

    if (existing.requesterId === responderId) {
      throw new AppError(
        403,
        'SELF_CLAIM_PROHIBITED',
        'Không thể tự tiếp nhận ca tư vấn do chính bạn tạo.',
      );
    }

    if (existing.status !== 'OPEN') {
      throw badRequest('Ca tư vấn này đã có chuyên gia tiếp nhận hoặc đã hoàn tất.');
    }

    const updated = await tx.consultationTicket.updateMany({
      where: { id: ticketId, status: 'OPEN' },
      data: {
        status: 'CLAIMED',
        claimedById: responderId,
      },
    });
    if (updated.count === 0) {
      throw badRequest('Ca tư vấn này vừa được chuyên gia khác tiếp nhận.');
    }

    await tx.notification.upsert({
      where: { dedupeKey: `consultation:${ticketId}:CLAIMED:${responderId}` },
      create: {
        recipientId: existing.requesterId,
        actorId: responderId,
        type: 'CONSULTATION_UPDATE',
        dedupeKey: `consultation:${ticketId}:CLAIMED:${responderId}`,
      },
      update: {
        readAt: null,
      },
    });

    const fullTicket = await tx.consultationTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: ticketInclude,
    });
    return formatTicket(fullTicket);
  });
}

export async function replyToConsultation(
  responderId: string,
  ticketId: string,
  input: CreateConsultationReplyInput,
) {
  const profile = await assertVerifiedProfessional(responderId);

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.consultationTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw notFound('Phiếu tư vấn sóng não không tồn tại.');

    if (ticket.requesterId === responderId) {
      throw new AppError(
        403,
        'SELF_REPLY_PROHIBITED',
        'Người gửi yêu cầu không thể tự phản hồi ca tư vấn của chính mình.',
      );
    }

    if (ticket.status === 'ACCEPTED' || ticket.status === 'CANCELLED') {
      throw badRequest('Ca tư vấn này đã đóng hoặc đã nghiệm thu kết quả.');
    }

    const responderTier = (profile.title || 'Chuyên gia Đã xác minh').slice(0, 60);

    const reply = await tx.consultationReply.create({
      data: {
        ticketId,
        responderId,
        responderTier,
        waveAnalysisText: input.waveAnalysisText,
        clinicalGuidanceText: input.clinicalGuidanceText,
        recommendedFollowUp: input.recommendedFollowUp,
      },
      include: {
        responder: { select: userSummarySelect },
      },
    });

    await tx.consultationTicket.update({
      where: { id: ticketId },
      data: {
        status: 'ANSWERED',
        claimedById: ticket.claimedById ?? responderId,
      },
    });

    await tx.notification.create({
      data: {
        recipientId: ticket.requesterId,
        actorId: responderId,
        type: 'CONSULTATION_UPDATE',
        dedupeKey: `consultation:${ticketId}:REPLY:${reply.id}`,
      },
    });

    const fullTicket = await tx.consultationTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: ticketInclude,
    });

    return {
      reply: {
        id: reply.id,
        ticketId: reply.ticketId,
        responderId: reply.responderId,
        responderTier: reply.responderTier,
        waveAnalysisText: reply.waveAnalysisText,
        clinicalGuidanceText: reply.clinicalGuidanceText,
        recommendedFollowUp: reply.recommendedFollowUp,
        rating: reply.rating,
        isAccepted: reply.isAccepted,
        createdAt: reply.createdAt,
        responder: reply.responder,
      },
      ticket: formatTicket(fullTicket),
    };
  });
}

export async function acceptConsultationReply(
  requesterId: string,
  ticketId: string,
  replyId: string,
  rating?: number,
) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.consultationTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw notFound('Phiếu tư vấn sóng não không tồn tại.');

    if (ticket.requesterId !== requesterId) {
      throw forbidden('Chỉ người gửi yêu cầu tư vấn mới có quyền nghiệm thu câu trả lời.');
    }

    if (ticket.status === 'ACCEPTED' || ticket.status === 'CANCELLED') {
      throw badRequest('Ca tư vấn này đã được nghiệm thu hoặc đã hủy trước đó.');
    }

    const reply = await tx.consultationReply.findFirst({
      where: { id: replyId, ticketId },
    });
    if (!reply) throw notFound('Phản hồi tư vấn không tồn tại trong phiếu này.');

    await tx.consultationReply.update({
      where: { id: replyId },
      data: {
        isAccepted: true,
        rating: rating ?? 5,
      },
    });

    await tx.consultationTicket.update({
      where: { id: ticketId },
      data: {
        status: 'ACCEPTED',
        acceptedReplyId: replyId,
      },
    });

    if (ticket.bountyCredits > 0) {
      const idempotencyKey = `consultation-earning:${ticketId}`;
      const existingEarning = await tx.creditTransaction.findUnique({
        where: { idempotencyKey },
      });

      if (!existingEarning) {
        const responderWallet = await tx.creditWallet.upsert({
          where: { userId: reply.responderId },
          create: {
            userId: reply.responderId,
            balance: ticket.bountyCredits,
            totalEarned: ticket.bountyCredits,
            totalSpent: 0,
          },
          update: {
            balance: { increment: ticket.bountyCredits },
            totalEarned: { increment: ticket.bountyCredits },
          },
        });

        await tx.creditTransaction.create({
          data: {
            walletId: responderWallet.id,
            amount: ticket.bountyCredits,
            type: 'CONSULTATION_EARNING',
            referenceId: ticketId,
            idempotencyKey,
            description: `Thù lao đọc sóng não & tư vấn từ xa ca "${ticket.title}" (+${ticket.bountyCredits} tín chỉ)`,
            actorId: requesterId,
          },
        });
      }
    }

    await tx.notification.upsert({
      where: { dedupeKey: `consultation:${ticketId}:ACCEPTED:${replyId}` },
      create: {
        recipientId: reply.responderId,
        actorId: requesterId,
        type: 'CONSULTATION_UPDATE',
        dedupeKey: `consultation:${ticketId}:ACCEPTED:${replyId}`,
      },
      update: {
        readAt: null,
      },
    });

    const fullTicket = await tx.consultationTicket.findUniqueOrThrow({
      where: { id: ticketId },
      include: ticketInclude,
    });
    return formatTicket(fullTicket);
  });
}
