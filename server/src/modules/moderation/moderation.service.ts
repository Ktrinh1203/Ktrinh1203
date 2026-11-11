import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { userSummarySelect } from '../users/users.select.js';
import type { CreateReportInput, ResolveReportInput } from './moderation.schemas.js';

export async function createReport(reporterId: string, input: CreateReportInput) {
  let postId: string | undefined = undefined;
  let commentId: string | undefined = undefined;
  let targetUserId: string | undefined = undefined;

  if (input.targetType === 'POST') {
    const post = await prisma.post.findUnique({ where: { id: input.targetId } });
    if (!post) throw notFound('Reported post does not exist');
    postId = post.id;
    targetUserId = post.authorId;
  } else if (input.targetType === 'COMMENT') {
    const comment = await prisma.comment.findUnique({ where: { id: input.targetId } });
    if (!comment) throw notFound('Reported comment does not exist');
    commentId = comment.id;
    targetUserId = comment.authorId;
  } else if (input.targetType === 'USER') {
    const user = await prisma.user.findUnique({ where: { id: input.targetId } });
    if (!user) throw notFound('Reported user does not exist');
    targetUserId = user.id;
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      targetType: input.targetType,
      postId,
      commentId,
      targetUserId,
      reason: input.reason,
      details: input.details,
    },
  });

  return report;
}

export async function getReports(status?: 'OPEN' | 'RESOLVED' | 'DISMISSED') {
  return prisma.report.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      reporter: { select: userSummarySelect },
      targetUser: { select: userSummarySelect },
      post: {
        select: {
          id: true,
          content: true,
          status: true,
          author: { select: userSummarySelect },
        },
      },
      comment: {
        select: {
          id: true,
          content: true,
          status: true,
          author: { select: userSummarySelect },
        },
      },
    },
  });
}

export async function resolveReport(reportId: string, adminId: string, input: ResolveReportInput) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
  });
  if (!report) throw notFound('Report not found');

  // Perform moderation action if requested
  if (input.action === 'HIDE_CONTENT') {
    if (report.targetType === 'POST' && report.postId) {
      await prisma.post.update({
        where: { id: report.postId },
        data: { status: 'HIDDEN', hiddenReason: `Moderated via report ${reportId}` },
      });
    } else if (report.targetType === 'COMMENT' && report.commentId) {
      await prisma.comment.update({
        where: { id: report.commentId },
        data: { status: 'HIDDEN' },
      });
    }
  } else if (input.action === 'DELETE_CONTENT') {
    if (report.targetType === 'POST' && report.postId) {
      await prisma.post.delete({ where: { id: report.postId } }).catch(() => undefined);
    } else if (report.targetType === 'COMMENT' && report.commentId) {
      await prisma.comment.delete({ where: { id: report.commentId } }).catch(() => undefined);
    }
  }

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: input.status,
      resolutionNote: input.resolutionNote,
      resolvedById: adminId,
      resolvedAt: new Date(),
    },
  });

  return updated;
}
