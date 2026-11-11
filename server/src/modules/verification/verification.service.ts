import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { VerificationRequestStatus, VerificationStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError, badRequest, forbidden, notFound } from '../../lib/errors.js';
import {
  PRIVATE_VERIFICATION_DIR,
  validateAndSaveVerificationFile,
} from '../../middleware/uploadVerification.js';
import { buildDocumentEvidenceDossier } from './ocr.service.js';
import type { ReviewDecisionInput, SubmitVerificationInput } from './verification.schemas.js';

export interface AuditMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Finite State Machine Transition Table for Reviewer Actions.
 */
const ALLOWED_REVIEW_TRANSITIONS: Record<
  ReviewDecisionInput['action'],
  { from: VerificationRequestStatus[]; to: VerificationRequestStatus; profileStatus: VerificationStatus }
> = {
  CLAIM: {
    from: ['PENDING_REVIEW'],
    to: 'IN_REVIEW',
    profileStatus: 'PENDING',
  },
  REQUEST_INFO: {
    from: ['PENDING_REVIEW', 'IN_REVIEW'],
    to: 'ADDITIONAL_INFO_REQUIRED',
    profileStatus: 'PENDING',
  },
  APPROVE: {
    from: ['PENDING_REVIEW', 'IN_REVIEW'],
    to: 'VERIFIED',
    profileStatus: 'VERIFIED',
  },
  REJECT: {
    from: ['PENDING_REVIEW', 'IN_REVIEW', 'ADDITIONAL_INFO_REQUIRED'],
    to: 'REJECTED',
    profileStatus: 'REJECTED',
  },
  REVOKE: {
    from: ['VERIFIED'],
    to: 'REVOKED',
    profileStatus: 'REJECTED',
  },
};

/**
 * Validates whether a state transition is legal according to the verification state machine.
 */
export function validateStateTransition(
  currentState: VerificationRequestStatus,
  action: ReviewDecisionInput['action'],
): { nextState: VerificationRequestStatus; profileStatus: VerificationStatus } {
  const rule = ALLOWED_REVIEW_TRANSITIONS[action];
  if (!rule || !rule.from.includes(currentState)) {
    throw new AppError(
      400,
      'INVALID_STATE_TRANSITION',
      `Illegal state transition: cannot perform ${action} when request is in ${currentState} state`,
    );
  }
  return { nextState: rule.to, profileStatus: rule.profileStatus };
}

const verificationRequestInclude = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
    },
  },
  profile: true,
  reviewer: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  documents: {
    orderBy: { uploadedAt: 'desc' as const },
  },
  auditLogs: {
    orderBy: { timestamp: 'desc' as const },
    include: {
      actor: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
        },
      },
    },
  },
};

/**
 * Submits or resubmits a professional verification request with credential evidence documents.
 */
export async function submitVerificationRequest(
  userId: string,
  input: SubmitVerificationInput,
  files: Express.Multer.File[],
  meta: AuditMeta,
  options?: { simulateOcrFailure?: boolean },
) {
  if (!files || files.length === 0) {
    throw badRequest('Vui lòng đính kèm ít nhất 1 tài liệu minh chứng (Chứng chỉ hành nghề, Bằng cấp, Thẻ công tác hoặc Hồ sơ ORCID)');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('User not found');

  // Validate and persist all uploaded files into private storage first
  const savedDocs = files.map((file) => {
    const saved = validateAndSaveVerificationFile(file);
    const ocrDossier = buildDocumentEvidenceDossier({
      buffer: saved.buffer,
      documentType: input.documentType,
      profileType: input.type,
      claimedName: user.displayName,
      claimedSpecialty: input.specialty,
      claimedInstitution: input.institution,
      claimedLicenseOrOrcid: input.licenseOrOrcidNumber,
      simulateFailure: options?.simulateOcrFailure,
    });
    return { saved, ocrDossier };
  });

  // Execute profile upsert, request creation/update, document attachment, and audit log atomically
  return prisma.$transaction(async (tx) => {
    const existingProfile = await tx.professionalProfile.findUnique({
      where: { userId_type: { userId, type: input.type } },
    });

    if (existingProfile?.verificationStatus === 'VERIFIED') {
      throw new AppError(
        400,
        'ALREADY_VERIFIED',
        'Hồ sơ chuyên môn này đã được xác minh tích xanh.',
      );
    }

    const profile = await tx.professionalProfile.upsert({
      where: { userId_type: { userId, type: input.type } },
      create: {
        userId,
        type: input.type,
        title: input.title,
        specialty: input.specialty,
        institution: input.institution,
        licenseOrOrcidNumber: input.licenseOrOrcidNumber,
        researchInterests: input.researchInterests ?? [],
        verificationStatus: 'PENDING',
      },
      update: {
        title: input.title,
        specialty: input.specialty,
        institution: input.institution,
        licenseOrOrcidNumber: input.licenseOrOrcidNumber,
        researchInterests: input.researchInterests ?? existingProfile?.researchInterests ?? [],
        verificationStatus: 'PENDING',
      },
    });

    // Check if there is an active non-terminal request for this profile to resubmit
    const existingReq = await tx.verificationRequest.findFirst({
      where: {
        profileId: profile.id,
        status: { in: ['PENDING_REVIEW', 'ADDITIONAL_INFO_REQUIRED', 'REJECTED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const previousState = existingReq?.status ?? null;

    let request;
    if (existingReq) {
      request = await tx.verificationRequest.update({
        where: { id: existingReq.id },
        data: {
          status: 'PENDING_REVIEW',
          claimedTitle: input.title,
          claimedSpecialty: input.specialty,
          claimedInstitution: input.institution,
          licenseOrOrcidNumber: input.licenseOrOrcidNumber,
          submissionNotes: input.submissionNotes || null,
        },
      });
    } else {
      request = await tx.verificationRequest.create({
        data: {
          profileId: profile.id,
          userId,
          status: 'PENDING_REVIEW',
          claimedTitle: input.title,
          claimedSpecialty: input.specialty,
          claimedInstitution: input.institution,
          licenseOrOrcidNumber: input.licenseOrOrcidNumber,
          submissionNotes: input.submissionNotes || null,
        },
      });
    }

    // Create document records
    for (const { saved, ocrDossier } of savedDocs) {
      await tx.verificationDocument.create({
        data: {
          requestId: request.id,
          documentType: input.documentType,
          storagePath: saved.storagePath,
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          sha256Hash: saved.sha256Hash,
          ocrData: ocrDossier as any,
        },
      });
    }

    // Write immutable audit log
    await tx.verificationAuditLog.create({
      data: {
        requestId: request.id,
        actorId: userId,
        action: existingReq ? 'RESUBMIT_EVIDENCE' : 'SUBMIT_REQUEST',
        previousState,
        newState: 'PENDING_REVIEW',
        reason: input.submissionNotes || 'Nộp hồ sơ và tài liệu minh chứng chuyên môn',
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });

    return tx.verificationRequest.findUniqueOrThrow({
      where: { id: request.id },
      include: verificationRequestInclude,
    });
  });
}

/**
 * Lists all verification requests belonging to the current user.
 */
export async function getUserVerificationRequests(userId: string) {
  return prisma.verificationRequest.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: verificationRequestInclude,
  });
}

/**
 * Lists verification requests for Admin Reviewer Dashboard.
 */
export async function adminListVerificationRequests(filters?: {
  status?: VerificationRequestStatus;
  type?: 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER';
}) {
  return prisma.verificationRequest.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.type ? { profile: { type: filters.type } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: verificationRequestInclude,
  });
}

/**
 * Gets a single verification request dossier for review.
 */
export async function adminGetVerificationDossier(requestId: string) {
  const req = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    include: verificationRequestInclude,
  });
  if (!req) throw notFound('Verification request not found');
  return req;
}

/**
 * Executes a reviewer state machine transition (CLAIM, APPROVE, REJECT, REQUEST_INFO, REVOKE).
 * Enforces Anti-Self-Approval and writes an atomic audit log + notification.
 */
export async function adminReviewVerificationRequest(
  requestId: string,
  adminId: string,
  input: ReviewDecisionInput,
  meta: AuditMeta,
) {
  const existing = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    include: { profile: true },
  });
  if (!existing) throw notFound('Verification request not found');

  // CRITICAL SECURITY INVARIANT: Anti-Self-Approval
  if (existing.userId === adminId) {
    throw new AppError(
      403,
      'SELF_VERIFICATION_PROHIBITED',
      'Quản trị viên không được phép tự tiếp nhận hoặc phê duyệt hồ sơ xác minh của chính mình',
    );
  }

  const { nextState, profileStatus } = validateStateTransition(existing.status, input.action);
  const rationale = input.reason || input.note || null;

  return prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.verificationRequest.update({
      where: { id: requestId },
      data: {
        status: nextState,
        reviewerId: adminId,
        reviewedAt: new Date(),
        reviewNotes: input.note || rationale,
        rejectionReason:
          input.action === 'REJECT' || input.action === 'REVOKE' ? rationale : existing.rejectionReason,
      },
    });

    // Synchronize public ProfessionalProfile status
    await tx.professionalProfile.update({
      where: { id: existing.profileId },
      data: {
        verificationStatus: profileStatus,
        verificationNote: rationale,
        verifiedById: nextState === 'VERIFIED' ? adminId : null,
        verifiedAt: nextState === 'VERIFIED' ? new Date() : null,
      },
    });

    // Write immutable audit record
    await tx.verificationAuditLog.create({
      data: {
        requestId,
        actorId: adminId,
        action: `ADMIN_${input.action}`,
        previousState: existing.status,
        newState: nextState,
        reason: rationale,
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });

    // Dispatch notification to applicant on decision
    if (input.action !== 'CLAIM') {
      const dedupeKey = `verification:${requestId}:${nextState}:${Date.now()}`;
      await tx.notification.create({
        data: {
          recipientId: existing.userId,
          actorId: adminId,
          type: 'VERIFICATION_UPDATE',
          dedupeKey,
        },
      });
    }

    return tx.verificationRequest.findUniqueOrThrow({
      where: { id: updatedRequest.id },
      include: verificationRequestInclude,
    });
  });
}

/**
 * Streams a protected verification document after verifying access permissions and SHA-256 integrity.
 */
export async function getProtectedVerificationDocument(
  requestId: string,
  documentId: string,
  actor: { userId: string; role: 'USER' | 'ADMIN' },
  meta: AuditMeta,
) {
  const doc = await prisma.verificationDocument.findUnique({
    where: { id: documentId },
    include: { request: true },
  });

  if (!doc || doc.requestId !== requestId) {
    throw notFound('Verification document not found');
  }

  // Only ADMIN or the document owner can view the private document
  if (actor.role !== 'ADMIN' && doc.request.userId !== actor.userId) {
    throw forbidden('You are not authorized to access this private credential document');
  }

  const fullPath = path.join(PRIVATE_VERIFICATION_DIR, path.basename(doc.storagePath));
  if (!fs.existsSync(fullPath)) {
    throw notFound('Document file is missing from private storage');
  }

  const fileBuffer = fs.readFileSync(fullPath);
  const currentHash = createHash('sha256').update(fileBuffer).digest('hex');

  if (currentHash !== doc.sha256Hash) {
    throw new AppError(
      500,
      'DOCUMENT_TAMPER_DETECTED',
      'Stored credential document failed SHA-256 integrity verification',
    );
  }

  // Record audit log when an administrator inspects the document
  if (actor.role === 'ADMIN') {
    await prisma.verificationAuditLog.create({
      data: {
        requestId,
        actorId: actor.userId,
        action: 'DOCUMENT_INSPECTED',
        previousState: doc.request.status,
        newState: doc.request.status,
        reason: `Admin inspected document: ${doc.fileName}`,
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });
  }

  return {
    doc,
    fullPath,
    fileBuffer,
  };
}
