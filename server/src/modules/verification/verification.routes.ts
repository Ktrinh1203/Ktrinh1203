import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAdmin, requireAuth } from '../../middleware/auth.js';
import { uploadVerificationDocs } from '../../middleware/uploadVerification.js';
import { reviewDecisionSchema, submitVerificationSchema } from './verification.schemas.js';
import * as verificationService from './verification.service.js';

export const verificationRouter = Router();
export const adminVerificationRouter = Router();

function extractAuditMeta(req: any): verificationService.AuditMeta {
  return {
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get('user-agent') || null,
  };
}

// ============================================================================
// Applicant / User Verification Endpoints (/api/verifications)
// ============================================================================

verificationRouter.use(requireAuth);

verificationRouter.get('/my', async (req, res) => {
  const auth = getAuth(req);
  const requests = await verificationService.getUserVerificationRequests(auth.userId);
  res.json({ requests });
});

verificationRouter.post(
  '/',
  uploadVerificationDocs.array('documents', 3),
  async (req, res) => {
    const auth = getAuth(req);
    const input = submitVerificationSchema.parse(req.body);
    const files = (req.files as Express.Multer.File[]) || [];
    const simulateOcrFailure = req.headers['x-simulate-ocr-failure'] === 'true';

    const request = await verificationService.submitVerificationRequest(
      auth.userId,
      input,
      files,
      extractAuditMeta(req),
      { simulateOcrFailure },
    );

    res.status(201).json({ request });
  },
);

verificationRouter.get('/:id/documents/:docId', async (req, res) => {
  const auth = getAuth(req);
  const requestId = z.string().uuid().parse(req.params.id);
  const documentId = z.string().uuid().parse(req.params.docId);

  const { doc, fileBuffer } = await verificationService.getProtectedVerificationDocument(
    requestId,
    documentId,
    auth,
    extractAuditMeta(req),
  );

  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(doc.fileName)}"`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.send(fileBuffer);
});

// ============================================================================
// Admin Reviewer Dossier Endpoints (/api/admin/verifications)
// ============================================================================

adminVerificationRouter.use(requireAdmin);

adminVerificationRouter.get('/requests', async (req, res) => {
  const status = req.query.status as any;
  const type = req.query.type as any;
  const requests = await verificationService.adminListVerificationRequests({ status, type });
  res.json({ requests });
});

adminVerificationRouter.get('/requests/:id', async (req, res) => {
  const requestId = z.string().uuid().parse(req.params.id);
  const request = await verificationService.adminGetVerificationDossier(requestId);
  res.json({ request });
});

adminVerificationRouter.post('/requests/:id/decision', async (req, res) => {
  const auth = getAuth(req);
  const requestId = z.string().uuid().parse(req.params.id);
  const input = reviewDecisionSchema.parse(req.body);
  const request = await verificationService.adminReviewVerificationRequest(
    requestId,
    auth.userId,
    input,
    extractAuditMeta(req),
  );
  res.json({ request });
});

adminVerificationRouter.get('/requests/:id/documents/:docId', async (req, res) => {
  const auth = getAuth(req);
  const requestId = z.string().uuid().parse(req.params.id);
  const documentId = z.string().uuid().parse(req.params.docId);

  const { doc, fileBuffer } = await verificationService.getProtectedVerificationDocument(
    requestId,
    documentId,
    auth,
    extractAuditMeta(req),
  );

  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(doc.fileName)}"`,
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.send(fileBuffer);
});
