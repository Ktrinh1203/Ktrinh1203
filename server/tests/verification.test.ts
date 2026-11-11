import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { PRIVATE_VERIFICATION_DIR } from '../src/middleware/uploadVerification.js';
import {
  buildDocumentEvidenceDossier,
  calculateNameSimilarity,
  validateLicenseOrOrcidFormat,
} from '../src/modules/verification/ocr.service.js';
import {
  reviewDecisionSchema,
  submitVerificationSchema,
} from '../src/modules/verification/verification.schemas.js';
import { validateStateTransition } from '../src/modules/verification/verification.service.js';
import { resolveUserExperience } from '../src/modules/users/experience.resolver.js';
import { getApp, makeAdmin, ORIGIN, registerUser, resetDatabase, type TestClient } from './helpers.js';
import request from 'supertest';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

/**
 * Helper to create an in-memory PDF buffer with valid %PDF-1.4 magic bytes and embedded text
 * for deterministic OCR extraction in tests.
 */
function makeTestPdfBuffer(lines: string[]): Buffer {
  const content = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstream\n${lines.join('\n')}\nendstream\n%%EOF\n`;
  return Buffer.from(content, 'utf8');
}

/**
 * Helper to submit a multipart verification request using an authenticated TestClient.
 */
function submitMultipartVerification(
  client: TestClient,
  fields: Record<string, string>,
  file: { buffer: Buffer; filename: string; contentType?: string },
  extraHeaders?: Record<string, string>,
) {
  let req = client.agent
    .post('/api/verifications')
    .set('Origin', ORIGIN)
    .set('X-CSRF-Token', client.csrfToken);

  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      req = req.set(k, v);
    }
  }

  for (const [key, val] of Object.entries(fields)) {
    req = req.field(key, val);
  }

  return req.attach('documents', file.buffer, {
    filename: file.filename,
    contentType: file.contentType ?? 'application/pdf',
  });
}

describe('1. Unit & Schema Validation Tests (professional-verification-architecture & document-ocr-evidence)', () => {
  it('validates clinician vs researcher credential schemas and ORCID/CCHN format validators', () => {
    const validClinician = submitVerificationSchema.safeParse({
      type: 'HEALTHCARE_PROFESSIONAL',
      title: 'Bác sĩ Chuyên khoa I Thần kinh',
      specialty: 'Thần kinh học lâm sàng',
      institution: 'Bệnh viện Chợ Rẫy',
      licenseOrOrcidNumber: '004512/BYT-CCHN',
      documentType: 'MEDICAL_LICENSE',
    });
    expect(validClinician.success).toBe(true);

    const validResearcher = submitVerificationSchema.safeParse({
      type: 'RESEARCHER',
      title: 'Nghiên cứu viên sau Tiến sĩ',
      specialty: 'Khoa học thần kinh tính toán',
      institution: 'Đại học Quốc gia',
      licenseOrOrcidNumber: '0000-0002-1825-0097',
      documentType: 'ORCID_RECORD',
    });
    expect(validResearcher.success).toBe(true);

    const missingLicense = submitVerificationSchema.safeParse({
      type: 'HEALTHCARE_PROFESSIONAL',
      title: 'Bác sĩ',
      specialty: 'Nội thần kinh',
      institution: 'Bệnh viện Bạch Mai',
      licenseOrOrcidNumber: '12', // too short
    });
    expect(missingLicense.success).toBe(false);

    // Format validator checks
    expect(validateLicenseOrOrcidFormat('012845/BYT-CCHN', 'HEALTHCARE_PROFESSIONAL')).toBe(true);
    expect(validateLicenseOrOrcidFormat('0000-0002-1825-0097', 'RESEARCHER')).toBe(true);
    expect(validateLicenseOrOrcidFormat('10.1038/s41586-020-2649-2', 'RESEARCHER')).toBe(true);

    // Review decision schema requires reason when REJECT, REQUEST_INFO, or REVOKE
    expect(reviewDecisionSchema.safeParse({ action: 'REJECT' }).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ action: 'REQUEST_INFO', reason: 'Ảnh mờ' }).success).toBe(true);
    expect(reviewDecisionSchema.safeParse({ action: 'APPROVE' }).success).toBe(true);
  });

  it('enforces state machine transition rules and blocks illegal jumps', () => {
    expect(validateStateTransition('PENDING_REVIEW', 'CLAIM').nextState).toBe('IN_REVIEW');
    expect(validateStateTransition('IN_REVIEW', 'APPROVE').nextState).toBe('VERIFIED');
    expect(validateStateTransition('IN_REVIEW', 'REQUEST_INFO').nextState).toBe('ADDITIONAL_INFO_REQUIRED');
    expect(validateStateTransition('VERIFIED', 'REVOKE').nextState).toBe('REVOKED');

    // Illegal transitions must throw INVALID_STATE_TRANSITION
    expect(() => validateStateTransition('REJECTED', 'APPROVE')).toThrowError(/Illegal state transition/);
    expect(() => validateStateTransition('PENDING_REVIEW', 'REVOKE')).toThrowError(/Illegal state transition/);
  });

  it('normalizes Vietnamese diacritics and computes accurate OCR comparison dossier', () => {
    const score = calculateNameSimilarity('BS. CKII Nguyễn Văn Minh', 'Nguyen Van Minh');
    expect(score).toBeGreaterThanOrEqual(0.82);

    const pdfBuf = makeTestPdfBuffer([
      'BO Y TE - CHUNG CHI HANH NGHE',
      'Họ và tên: Nguyễn Văn Minh',
      'Số CCHN: 012845/BYT-CCHN',
      'Chuyên khoa: Thần kinh học lâm sàng',
      'Nơi cấp: Bộ Y tế - Bệnh viện Bạch Mai',
      'Ngày cấp: 15/06/2018',
    ]);

    const dossier = buildDocumentEvidenceDossier({
      buffer: pdfBuf,
      documentType: 'MEDICAL_LICENSE',
      profileType: 'HEALTHCARE_PROFESSIONAL',
      claimedName: 'BS. Nguyễn Văn Minh',
      claimedSpecialty: 'Thần kinh học lâm sàng',
      claimedInstitution: 'Bệnh viện Bạch Mai',
      claimedLicenseOrOrcid: '012845/BYT-CCHN',
    });

    expect(dossier.status).toBe('EXTRACTED');
    expect(dossier.sourceReliabilityTier).toBe('TIER_1');
    expect(dossier.extractedFields.licenseNumber).toBe('012845/BYT-CCHN');
    expect(dossier.comparisonFlags.licenseFormatValid).toBe(true);
    expect(dossier.comparisonFlags.nameMatchScore).toBeGreaterThanOrEqual(0.85);
    expect(dossier.disclaimer).toContain('chỉ hỗ trợ trích xuất và đối chiếu');
  });
});

describe('2. End-to-End Verification Workflow & State Machine Transitions', () => {
  it('completes full lifecycle: Submit -> Claim -> Request Info -> Resubmit -> Approve -> Revoke', async () => {
    const clinician = await registerUser({
      username: 'dr_ha_neuro',
      displayName: 'TS. BS. Phạm Thu Hà',
    });
    const admin = await registerUser({ username: 'chief_admin', displayName: 'Admin Hội đồng Y khoa' });
    await makeAdmin(admin.user.id);

    const pdfBuffer = makeTestPdfBuffer([
      'BO Y TE VIET NAM',
      'Họ và tên: TS. BS. Phạm Thu Hà',
      'Số CCHN: 098765/BYT-CCHN',
      'Chuyên khoa: Thần kinh Nhi khoa',
      'Đơn vị: Bệnh viện Nhi Trung ương',
      'Ngày cấp: 20/11/2020',
    ]);

    // Step 1: Clinician submits verification request with PDF document
    const submitRes = await submitMultipartVerification(
      clinician,
      {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Tiến sĩ, Bác sĩ Nội thần kinh',
        specialty: 'Thần kinh Nhi khoa',
        institution: 'Bệnh viện Nhi Trung ương',
        licenseOrOrcidNumber: '098765/BYT-CCHN',
        documentType: 'MEDICAL_LICENSE',
        submissionNotes: 'Đính kèm bản scan CCHN chính thức.',
      },
      { buffer: pdfBuffer, filename: 'cchn_pham_thu_ha.pdf' },
    ).expect(201);

    const reqId = submitRes.body.request.id;
    expect(submitRes.body.request.status).toBe('PENDING_REVIEW');
    expect(submitRes.body.request.profile.verificationStatus).toBe('PENDING');
    expect(submitRes.body.request.documents).toHaveLength(1);
    expect(submitRes.body.request.documents[0].ocrData.status).toBe('EXTRACTED');
    expect(submitRes.body.request.documents[0].ocrData.comparisonFlags.licenseFormatValid).toBe(true);

    // Step 2: Admin claims request (PENDING_REVIEW -> IN_REVIEW)
    const claimRes = await admin
      .post(`/api/admin/verifications/requests/${reqId}/decision`, {
        action: 'CLAIM',
        note: 'Đang kiểm tra hồ sơ CCHN',
      })
      .expect(200);
    expect(claimRes.body.request.status).toBe('IN_REVIEW');

    // Step 3: Admin requests additional info (IN_REVIEW -> ADDITIONAL_INFO_REQUIRED)
    const reqInfoRes = await admin
      .post(`/api/admin/verifications/requests/${reqId}/decision`, {
        action: 'REQUEST_INFO',
        reason: 'Vui lòng bổ sung mặt sau Chứng chỉ hành nghề hoặc thẻ công tác tại BV Nhi TW',
      })
      .expect(200);
    expect(reqInfoRes.body.request.status).toBe('ADDITIONAL_INFO_REQUIRED');
    expect(reqInfoRes.body.request.profile.verificationStatus).toBe('PENDING');

    // Verify notification sent to clinician
    const notifs1 = (await clinician.get('/api/notifications').expect(200)).body;
    expect(notifs1.items.some((n: any) => n.type === 'VERIFICATION_UPDATE')).toBe(true);

    // Step 4: Clinician resubmits updated evidence (ADDITIONAL_INFO_REQUIRED -> PENDING_REVIEW)
    const resubmitRes = await submitMultipartVerification(
      clinician,
      {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Tiến sĩ, Bác sĩ Nội thần kinh',
        specialty: 'Thần kinh Nhi khoa',
        institution: 'Bệnh viện Nhi Trung ương',
        licenseOrOrcidNumber: '098765/BYT-CCHN',
        documentType: 'HOSPITAL_STAFF_CARD',
        submissionNotes: 'Đã bổ sung thêm quyết định bổ nhiệm tại BV Nhi TW.',
      },
      { buffer: pdfBuffer, filename: 'the_cong_tac_nhi_tw.pdf' },
    ).expect(201);

    expect(resubmitRes.body.request.id).toBe(reqId);
    expect(resubmitRes.body.request.status).toBe('PENDING_REVIEW');
    expect(resubmitRes.body.request.documents).toHaveLength(2);

    // Step 5: Admin approves request (PENDING_REVIEW -> VERIFIED)
    const approveRes = await admin
      .post(`/api/admin/verifications/requests/${reqId}/decision`, {
        action: 'APPROVE',
        note: 'Đã đối chiếu CCHN và thẻ công tác hợp lệ.',
      })
      .expect(200);

    expect(approveRes.body.request.status).toBe('VERIFIED');
    expect(approveRes.body.request.profile.verificationStatus).toBe('VERIFIED');
    expect(approveRes.body.request.profile.verifiedById).toBe(admin.user.id);

    // Public profile reflects VERIFIED badge
    const publicProfile = (await clinician.get('/api/users/dr_ha_neuro').expect(200)).body.user;
    expect(publicProfile.professionalProfiles[0].verificationStatus).toBe('VERIFIED');

    // Step 6: Admin revokes credential (VERIFIED -> REVOKED)
    const revokeRes = await admin
      .post(`/api/admin/verifications/requests/${reqId}/decision`, {
        action: 'REVOKE',
        reason: 'Chứng chỉ hết hiệu lực cần gia hạn định kỳ',
      })
      .expect(200);

    expect(revokeRes.body.request.status).toBe('REVOKED');
    expect(revokeRes.body.request.profile.verificationStatus).toBe('REJECTED');

    // Audit trail contains all 5 transitions in chronological history
    expect(revokeRes.body.request.auditLogs.length).toBeGreaterThanOrEqual(5);
  });
});

describe('3. Security & Authorization Invariants (verification-security-review)', () => {
  it('strictly blocks Admin Self-Approval (403 SELF_VERIFICATION_PROHIBITED) on both Dossier and Profile endpoints', async () => {
    const doctorAdmin = await registerUser({
      username: 'admin_doctor',
      displayName: 'BS. Quản trị viên',
    });
    await makeAdmin(doctorAdmin.user.id);

    const pdfBuffer = makeTestPdfBuffer([
      'Họ và tên: BS. Quản trị viên',
      'Số CCHN: 055555/BYT-CCHN',
    ]);

    const submitRes = await submitMultipartVerification(
      doctorAdmin,
      {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Nội trú',
        specialty: 'Thần kinh học',
        institution: 'Bệnh viện Đại học Y',
        licenseOrOrcidNumber: '055555/BYT-CCHN',
        documentType: 'MEDICAL_LICENSE',
      },
      { buffer: pdfBuffer, filename: 'self_admin_cchn.pdf' },
    ).expect(201);

    const reqId = submitRes.body.request.id;
    const profileId = submitRes.body.request.profileId;

    // Attempt 1: Admin tries to approve their own VerificationRequest via Dossier endpoint
    const selfDossierAttempt = await doctorAdmin
      .post(`/api/admin/verifications/requests/${reqId}/decision`, {
        action: 'APPROVE',
        note: 'Tự duyệt hồ sơ của mình',
      })
      .expect(403);

    expect(selfDossierAttempt.body.error.code).toBe('SELF_VERIFICATION_PROHIBITED');

    // Attempt 2: Admin tries to claim their own VerificationRequest
    const selfClaimAttempt = await doctorAdmin
      .post(`/api/admin/verifications/requests/${reqId}/decision`, {
        action: 'CLAIM',
      })
      .expect(403);

    expect(selfClaimAttempt.body.error.code).toBe('SELF_VERIFICATION_PROHIBITED');

    // Attempt 3: Admin tries to verify their own ProfessionalProfile via legacy endpoint
    const selfLegacyAttempt = await doctorAdmin
      .patch(`/api/admin/verifications/${profileId}`, {
        status: 'VERIFIED',
      })
      .expect(403);

    expect(selfLegacyAttempt.body.error.code).toBe('SELF_VERIFICATION_PROHIBITED');

    // Verify status remains PENDING_REVIEW / PENDING in database
    const checkProfile = await prisma.professionalProfile.findUniqueOrThrow({
      where: { id: profileId },
    });
    expect(checkProfile.verificationStatus).toBe('PENDING');
  });

  it('protects private credential documents against unauthenticated and unauthorized users while logging Admin inspection', async () => {
    const applicant = await registerUser({ username: 'applicant_user', displayName: 'Lê Hoàng Nam' });
    const intruder = await registerUser({ username: 'intruder_user', displayName: 'Người lạ' });
    const reviewer = await registerUser({ username: 'reviewer_admin', displayName: 'Admin Thẩm định' });
    await makeAdmin(reviewer.user.id);

    const pdfBuffer = makeTestPdfBuffer(['Họ và tên: Lê Hoàng Nam', 'ORCID: 0000-0001-2345-6789']);
    const submitRes = await submitMultipartVerification(
      applicant,
      {
        type: 'RESEARCHER',
        title: 'Nghiên cứu sinh Tiến sĩ',
        specialty: 'Khoa học thần kinh nhận thức',
        institution: 'Viện Hàn lâm KH&CN',
        licenseOrOrcidNumber: '0000-0001-2345-6789',
        documentType: 'ORCID_RECORD',
      },
      { buffer: pdfBuffer, filename: 'nam_orcid.pdf' },
    ).expect(201);

    const reqId = submitRes.body.request.id;
    const docId = submitRes.body.request.documents[0].id;
    const storagePath = submitRes.body.request.documents[0].storagePath;

    // 1. Unauthenticated request receives 401
    await request(getApp()).get(`/api/verifications/${reqId}/documents/${docId}`).expect(401);

    // 2. Unrelated authenticated user receives 403
    await intruder.get(`/api/verifications/${reqId}/documents/${docId}`).expect(403);

    // 3. Static /uploads route does NOT expose private verification documents (404)
    await request(getApp()).get(`/uploads/${storagePath}`).expect(404);

    // 4. Document owner can view their own document with strict security headers
    const ownerDocRes = await applicant
      .get(`/api/verifications/${reqId}/documents/${docId}`)
      .expect(200);
    expect(ownerDocRes.headers['x-content-type-options']).toBe('nosniff');
    expect(ownerDocRes.headers['content-security-policy']).toContain("default-src 'none'");

    // 5. Admin reviewer can stream document via admin endpoint and generates DOCUMENT_INSPECTED audit log
    const adminDocRes = await reviewer
      .get(`/api/admin/verifications/requests/${reqId}/documents/${docId}`)
      .expect(200);
    expect(adminDocRes.headers['x-content-type-options']).toBe('nosniff');

    const auditLogs = await prisma.verificationAuditLog.findMany({
      where: { requestId: reqId, action: 'DOCUMENT_INSPECTED' },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]!.actorId).toBe(reviewer.user.id);
  });
});

describe('4. Negative Tests, Anti-Forgery & Edge-Case Failure Handling', () => {
  it('rejects disguised executables (magic bytes mismatch) and zero-byte files', async () => {
    const user = await registerUser({ username: 'upload_tester' });

    // 1. Zero-byte file -> 400 EMPTY_DOCUMENT_FILE
    const emptyRes = await submitMultipartVerification(
      user,
      {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ',
        specialty: 'Thần kinh',
        institution: 'Bệnh viện Đa khoa',
        licenseOrOrcidNumber: '012345/BYT-CCHN',
      },
      { buffer: Buffer.alloc(0), filename: 'empty.pdf' },
    ).expect(400);
    expect(emptyRes.body.error.code).toBe('EMPTY_DOCUMENT_FILE');

    // 2. Windows MZ executable disguised as a .png image -> 400 INVALID_FILE_SIGNATURE
    const fakePngExecutable = Buffer.from('MZ\x90\x00\x03\x00\x00\x00malicious_payload', 'binary');
    const spoofRes = await submitMultipartVerification(
      user,
      {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ',
        specialty: 'Thần kinh',
        institution: 'Bệnh viện Đa khoa',
        licenseOrOrcidNumber: '012345/BYT-CCHN',
      },
      { buffer: fakePngExecutable, filename: 'disguised_malware.png', contentType: 'image/png' },
    ).expect(400);
    expect(spoofRes.body.error.code).toBe('INVALID_FILE_SIGNATURE');
  });

  it('detects file tampering via SHA-256 checksum verification when streaming a document', async () => {
    const user = await registerUser({ username: 'tamper_test_user' });
    const pdfBuffer = makeTestPdfBuffer(['Original authentic document content']);

    const submitRes = await submitMultipartVerification(
      user,
      {
        type: 'RESEARCHER',
        title: 'Nghiên cứu viên',
        specialty: 'Neuroscience',
        institution: 'Viện Nghiên cứu Não bộ',
        licenseOrOrcidNumber: '0000-0009-8888-7777',
      },
      { buffer: pdfBuffer, filename: 'authentic.pdf' },
    ).expect(201);

    const reqId = submitRes.body.request.id;
    const doc = submitRes.body.request.documents[0];
    const fullPath = path.join(PRIVATE_VERIFICATION_DIR, path.basename(doc.storagePath));

    // Tamper with the stored file on disk after upload
    fs.writeFileSync(fullPath, Buffer.from('%PDF-1.4\nTampered forged content\n%%EOF'));

    const streamRes = await user.get(`/api/verifications/${reqId}/documents/${doc.id}`).expect(500);
    expect(streamRes.body.error.code).toBe('DOCUMENT_TAMPER_DETECTED');
  });

  it('handles OCR extraction failure gracefully without blocking manual review or auto-approving', async () => {
    const user = await registerUser({ username: 'ocr_fallback_user', displayName: 'Trần Văn Bình' });
    const admin = await registerUser({ username: 'ocr_fallback_admin' });
    await makeAdmin(admin.user.id);

    const pdfBuffer = makeTestPdfBuffer(['Họ và tên: Trần Văn Bình']);

    const submitRes = await submitMultipartVerification(
      user,
      {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Nội khoa',
        specialty: 'Thần kinh học',
        institution: 'Bệnh viện Trung ương Huế',
        licenseOrOrcidNumber: '077889/BYT-CCHN',
      },
      { buffer: pdfBuffer, filename: 'scan_blurred.pdf' },
      { 'x-simulate-ocr-failure': 'true' },
    ).expect(201);

    const req = submitRes.body.request;
    expect(req.status).toBe('PENDING_REVIEW');
    expect(req.documents[0].ocrData.status).toBe('FAILED');
    expect(req.documents[0].ocrData.comparisonFlags.lowLegibilityWarning).toBe(true);

    // Admin can still manually inspect and approve the request even when OCR failed
    const approveRes = await admin
      .post(`/api/admin/verifications/requests/${req.id}/decision`, {
        action: 'APPROVE',
        note: 'Đã kiểm tra trực tiếp bản scan gốc hợp lệ dù OCR không đọc được.',
      })
      .expect(200);

    expect(approveRes.body.request.status).toBe('VERIFIED');
  });
});

describe('5. Phase 3 – Automatic Role Resolution, Credential Integrity & EEG Data-Owner Consent Security', () => {
  it('resolves all 7 logical role & verification states and multi-role accounts deterministically', () => {
    // 1. GENERAL_USER -> GENERAL_MODE
    const generalRes = resolveUserExperience({ professionalProfiles: [] });
    expect(generalRes.accountRole).toBe('GENERAL_USER');
    expect(generalRes.experience).toBe('GENERAL_MODE');
    expect(generalRes.canAccessProfessionalMode).toBe(false);
    expect(generalRes.enableVerificationCenter).toBe(false);
    expect(generalRes.enableResubmission).toBe(false);

    // 2. DOCTOR + VERIFIED -> PROFESSIONAL_MODE
    const doctorVerified = resolveUserExperience({
      professionalProfiles: [
        {
          type: 'HEALTHCARE_PROFESSIONAL',
          title: 'Bác sĩ Chuyên khoa II Thần kinh',
          specialty: 'Thần kinh học lâm sàng',
          verificationStatus: 'VERIFIED',
        },
      ],
    });
    expect(doctorVerified.accountRole).toBe('DOCTOR');
    expect(doctorVerified.experience).toBe('PROFESSIONAL_MODE');
    expect(doctorVerified.canAccessProfessionalMode).toBe(true);

    // 3. HEALTHCARE_WORKER + VERIFIED -> PROFESSIONAL_MODE
    const healthcareWorkerVerified = resolveUserExperience({
      professionalProfiles: [
        {
          type: 'HEALTHCARE_PROFESSIONAL',
          title: 'Kỹ thuật viên Điện não đồ lâm sàng',
          specialty: 'Thăm dò chức năng thần kinh',
          verificationStatus: 'VERIFIED',
        },
      ],
    });
    expect(healthcareWorkerVerified.accountRole).toBe('HEALTHCARE_WORKER');
    expect(healthcareWorkerVerified.experience).toBe('PROFESSIONAL_MODE');
    expect(healthcareWorkerVerified.canAccessProfessionalMode).toBe(true);

    // 4. RESEARCHER + VERIFIED -> PROFESSIONAL_MODE
    const researcherVerified = resolveUserExperience({
      professionalProfiles: [
        {
          type: 'RESEARCHER',
          title: 'Phó Giáo sư, Trưởng phòng thí nghiệm BCI',
          specialty: 'Khoa học thần kinh tính toán',
          verificationStatus: 'VERIFIED',
        },
      ],
    });
    expect(researcherVerified.accountRole).toBe('RESEARCHER');
    expect(researcherVerified.experience).toBe('PROFESSIONAL_MODE');
    expect(researcherVerified.canAccessProfessionalMode).toBe(true);

    // 5. RESEARCH_STUDENT + VERIFIED -> PROFESSIONAL_MODE
    const studentVerified = resolveUserExperience({
      professionalProfiles: [
        {
          type: 'RESEARCHER',
          title: 'Nghiên cứu sinh Khoa học Thần kinh & Kỹ thuật Y sinh',
          specialty: 'Xử lý tín hiệu EEG',
          verificationStatus: 'VERIFIED',
        },
      ],
    });
    expect(studentVerified.accountRole).toBe('RESEARCH_STUDENT');
    expect(studentVerified.experience).toBe('PROFESSIONAL_MODE');
    expect(studentVerified.canAccessProfessionalMode).toBe(true);

    // 6. PENDING -> GENERAL_MODE + enable_verification_center = true
    const pendingStudent = resolveUserExperience({
      professionalProfiles: [
        {
          type: 'RESEARCHER',
          title: 'Học viên Cao học Kỹ thuật Y sinh',
          specialty: 'Xử lý tín hiệu EEG',
          verificationStatus: 'PENDING',
        },
      ],
    });
    expect(pendingStudent.accountRole).toBe('RESEARCH_STUDENT');
    expect(pendingStudent.verificationStatus).toBe('PENDING');
    expect(pendingStudent.experience).toBe('GENERAL_MODE');
    expect(pendingStudent.canAccessProfessionalMode).toBe(false);
    expect(pendingStudent.enableVerificationCenter).toBe(true);
    expect(pendingStudent.enableResubmission).toBe(false);

    // 7. REJECTED -> GENERAL_MODE + enable_resubmission = true
    const rejectedWorker = resolveUserExperience({
      professionalProfiles: [
        {
          type: 'HEALTHCARE_PROFESSIONAL',
          title: 'Kỹ thuật viên Điện não đồ',
          specialty: 'Thăm dò chức năng',
          verificationStatus: 'REJECTED',
        },
      ],
    });
    expect(rejectedWorker.accountRole).toBe('HEALTHCARE_WORKER');
    expect(rejectedWorker.verificationStatus).toBe('REJECTED');
    expect(rejectedWorker.experience).toBe('GENERAL_MODE');
    expect(rejectedWorker.canAccessProfessionalMode).toBe(false);
    expect(rejectedWorker.enableResubmission).toBe(true);

    // 8. Multi-role consistency without duplicating accounts (e.g., Verified Doctor + Pending Researcher)
    const dualRole = resolveUserExperience({
      professionalProfiles: [
        {
          type: 'RESEARCHER',
          title: 'Nghiên cứu viên BCI',
          specialty: 'Neuroscience',
          verificationStatus: 'PENDING',
        },
        {
          type: 'HEALTHCARE_PROFESSIONAL',
          title: 'Bác sĩ Nội thần kinh',
          specialty: 'Lâm sàng',
          verificationStatus: 'VERIFIED',
        },
      ],
    });
    expect(dualRole.isDualRoleProfessional).toBe(true);
    expect(dualRole.experience).toBe('PROFESSIONAL_MODE');
    expect(dualRole.accountRole).toBe('DOCTOR');
    expect(dualRole.enableVerificationCenter).toBe(true);
  });

  it('prevents credential tampering after approval and ignores spoofed frontend mode headers', async () => {
    const admin = await registerUser({ username: 'admin_phase3_1', displayName: 'Admin Phase 3' });
    await makeAdmin(admin.user.id);

    const doc = await registerUser({ username: 'dr_tamper_check', displayName: 'BS. Kiểm tra' });
    const profRes = await doc
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Chuyên khoa I',
        specialty: 'Thần kinh học',
        institution: 'Bệnh viện Bạch Mai',
        licenseOrOrcidNumber: '011223/BYT-CCHN',
      })
      .expect(200);

    // Initially PENDING -> GENERAL_MODE + enableVerificationCenter
    const mePending = (await doc.get('/api/auth/me').expect(200)).body.user;
    expect(mePending.experienceResolution.experience).toBe('GENERAL_MODE');
    expect(mePending.experienceResolution.enableVerificationCenter).toBe(true);

    // Spoofing frontend mode headers must NEVER bypass backend authorization
    await doc
      .get('/api/eeg-datasets/workspace')
      .set('X-Client-Mode', 'PROFESSIONAL_MODE')
      .set('X-Experience-Mode', 'professional')
      .expect(403);

    // Admin approves credential -> experience becomes PROFESSIONAL_MODE
    await admin
      .patch(`/api/admin/verifications/${profRes.body.profile.id}`, { status: 'VERIFIED' })
      .expect(200);

    const meVerified = (await doc.get('/api/auth/me').expect(200)).body.user;
    expect(meVerified.experienceResolution.experience).toBe('PROFESSIONAL_MODE');
    expect(meVerified.experienceResolution.accountRole).toBe('DOCTOR');

    // If the verified doctor alters their license number or institution, status resets to PENDING
    await doc
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Chuyên khoa I',
        specialty: 'Thần kinh học',
        institution: 'Bệnh viện Khác Chưa Xác Minh',
        licenseOrOrcidNumber: '999999/FAKE-CCHN',
      })
      .expect(200);

    const meAfterEdit = (await doc.get('/api/auth/me').expect(200)).body.user;
    expect(meAfterEdit.experienceResolution.verificationStatus).toBe('PENDING');
    expect(meAfterEdit.experienceResolution.experience).toBe('GENERAL_MODE');
    expect(meAfterEdit.experienceResolution.canAccessProfessionalMode).toBe(false);
  });

  it('enforces explicit Data-Owner Consent for EEG datasets (professional status alone does NOT grant access to every patient dataset)', async () => {
    const admin = await registerUser({ username: 'admin_phase3_2', displayName: 'Admin EEG' });
    await makeAdmin(admin.user.id);

    const patient = await registerUser({ username: 'patient_lan', displayName: 'Bệnh nhân Lan' });
    const drConsented = await registerUser({ username: 'dr_consented', displayName: 'BS. Được Ủy Quyền' });
    const drUnconsented = await registerUser({ username: 'dr_unconsented', displayName: 'BS. Chưa Ủy Quyền' });

    const p1 = await drConsented
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Chuyên khoa II',
        specialty: 'Thần kinh',
        institution: 'BV Bạch Mai',
        licenseOrOrcidNumber: '010101/BYT-CCHN',
      })
      .expect(200);
    const p2 = await drUnconsented
      .post('/api/users/me/professional', {
        type: 'HEALTHCARE_PROFESSIONAL',
        title: 'Bác sĩ Chuyên khoa I',
        specialty: 'Thần kinh',
        institution: 'BV Chợ Rẫy',
        licenseOrOrcidNumber: '020202/BYT-CCHN',
      })
      .expect(200);

    await admin.patch(`/api/admin/verifications/${p1.body.profile.id}`, { status: 'VERIFIED' }).expect(200);
    await admin.patch(`/api/admin/verifications/${p2.body.profile.id}`, { status: 'VERIFIED' }).expect(200);

    // 1. Patient uploads a personal EEG dataset (default 0 consented professionals)
    const createRes = await patient
      .post('/api/eeg-datasets', {
        title: 'Bản ghi EEG Giấc ngủ Cá nhân của Lan',
        duration: '30 phút',
        samplingRate: '250 Hz',
        channelsCount: 8,
      })
      .expect(201);
    const datasetId = createRes.body.dataset.id;

    // 2. Verified doctor WITHOUT consent cannot see the dataset in workspace or fetch it by ID
    const unconsentedWorkspace = await drUnconsented.get('/api/eeg-datasets/workspace').expect(200);
    expect(unconsentedWorkspace.body.datasets.some((d: any) => d.id === datasetId)).toBe(false);

    const unconsentedDirect = await drUnconsented.get(`/api/eeg-datasets/${datasetId}`).expect(403);
    expect(unconsentedDirect.body.error.code).toBe('EEG_CONSENT_REQUIRED');

    // 3. Verified doctor cannot grant consent to themselves on a patient's dataset
    const illegalGrant = await drUnconsented
      .post(`/api/eeg-datasets/${datasetId}/consent`, {
        professionalUsername: 'dr_unconsented',
      })
      .expect(403);
    expect(illegalGrant.body.error.code).toBe('ONLY_DATA_OWNER_CAN_MANAGE_CONSENT');

    // 4. Patient (Data Owner) explicitly grants consent to dr_consented
    const grantRes = await patient
      .post(`/api/eeg-datasets/${datasetId}/consent`, {
        professionalUsername: 'dr_consented',
      })
      .expect(200);
    expect(grantRes.body.dataset.consentedProfessionals).toHaveLength(1);
    expect(grantRes.body.dataset.consentedProfessionals[0].username).toBe('dr_consented');

    // 5. dr_consented can now access the dataset, while dr_unconsented is still blocked
    const consentedView = await drConsented.get(`/api/eeg-datasets/${datasetId}`).expect(200);
    expect(consentedView.body.dataset.id).toBe(datasetId);
    expect(
      consentedView.body.dataset.accessHistory.some((h: any) => h.action === 'DATASET_ACCESSED'),
    ).toBe(true);

    await drUnconsented.get(`/api/eeg-datasets/${datasetId}`).expect(403);

    // 6. Patient revokes consent from dr_consented -> access is immediately terminated
    await patient.del(`/api/eeg-datasets/${datasetId}/consent/dr_consented`).expect(200);
    const afterRevoke = await drConsented.get(`/api/eeg-datasets/${datasetId}`).expect(403);
    expect(afterRevoke.body.error.code).toBe('EEG_CONSENT_REQUIRED');
  });
});
