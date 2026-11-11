---
name: verification-testing
description: Use when designing, writing, or reviewing unit, integration, authorization, workflow, and failure-handling tests for the professional credential verification system in NeuroLink.
---

# Verification Testing Standards

## Overview

This skill defines testing strategies, test suite organization, assertion patterns, and negative security test cases for the professional credential verification system in **NeuroLink** (`PBL4_Web`). It ensures that all verification state transitions, authorization guards, document protections, and OCR failure modes are rigorously validated prior to production deployment.

## Purpose & Activation Criteria

Activate this skill when:
- Writing or refactoring tests for the verification module in `server/tests/`.
- Validating state machine transitions, anti-self-approval defenses, and RBAC authorization barriers.
- Testing document upload sanitization, tamper-detection (SHA-256), and protected streaming routes.
- Writing negative tests for forged statuses, unauthorized reviews, malformed files, or unavailable sources.
- Ensuring test isolation against the dedicated PostgreSQL test database (`pbl4_web_test`).

---

## 1. Testing Stack & Environment Architecture

NeuroLink's test architecture is structured as follows:
- **Test Runner**: Vitest (`server/vitest.config.ts`).
- **HTTP Integration**: Supertest against the configured Express application (`createApp()` from `server/src/app.ts`).
- **Database**: PostgreSQL 16 test database (`pbl4_web_test`), completely isolated from development and production databases.
- **Assertions**: Vitest built-in assertions (`expect()`).
- **Fixture Management**: Dedicated helper utilities for creating authenticated user sessions, admin sessions, and clean tear-downs (`server/tests/helpers.ts`).

---

## 2. Test Suite Classification & Coverage Requirements

Tests must be divided into five distinct operational categories:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Verification Test Suite Taxonomy                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌────────────────┬──────────────┼───────────────┬────────────────┐
    ▼                ▼              ▼               ▼                ▼
[Unit Tests]  [Workflow Tests] [RBAC Tests]  [Negative Tests] [Failure Tests]
  - State logic  - End-to-end   - Admin-only   - Self-approval   - Malformed files
  - Zod schemas  - Info request - User boundary- Forged status   - OCR timeouts
  - File checks  - Rejection    - Doc streaming- Stored XSS      - DB rollback
```

---

## 3. Mandatory Test Cases by Category

### Category A: Unit & Schema Validation Tests
1. **Schema Validation for Clinicians**:
   - Accepts valid input: Medical title, clinical specialty, valid license number, hospital affiliation.
   - Rejects empty license number or missing clinical specialty for `HEALTHCARE_PROFESSIONAL`.
2. **Schema Validation for Researchers**:
   - Accepts valid input: Academic title, neuroscience research field, institution, ORCID identifier.
   - Validates ORCID format (e.g. `0000-0002-1825-0097`).
3. **State Machine Transition Matrix**:
   - Asserts that legal transitions succeed (e.g., `PENDING_REVIEW` -> `IN_REVIEW` -> `VERIFIED`).
   - Asserts that illegal transitions throw descriptive domain errors (e.g., direct jump from `UNVERIFIED` -> `VERIFIED`).

### Category B: Workflow & Lifecycle Integration Tests
1. **Happy Path Approval**:
   - User submits profile + evidence document -> Request status is `PENDING_REVIEW`.
   - Admin claims review -> Request status is `IN_REVIEW`.
   - Admin approves with note -> Request status is `VERIFIED`, `ProfessionalProfile.verificationStatus` becomes `VERIFIED`, badge renders with verified checkmark.
   - In-app notification dispatched to applicant.
2. **Supplemental Information Workflow**:
   - Admin requests more info with note -> Status becomes `ADDITIONAL_INFO_REQUIRED`.
   - User uploads updated document -> Status reverts to `PENDING_REVIEW`.
3. **Rejection Workflow**:
   - Admin rejects request with mandatory reason -> Status is `REJECTED`, `ProfessionalProfile.verificationStatus` becomes `REJECTED`.
   - Notification contains clear rejection rationale.

### Category C: Authorization & Security Invariant Tests
1. **Non-Admin Review Blocked (403 Forbidden)**:
   - Regular user attempts to access `GET /api/admin/verifications` -> Expect `403`.
   - Regular user attempts to call `POST /api/admin/verifications/:id/approve` -> Expect `403`.
2. **Anti-Self-Approval Blocked (403 Forbidden)**:
   - Admin user submits their own professional profile for verification.
   - Same admin attempts to call `POST /api/admin/verifications/:id/approve` on their own request.
   - System MUST reject the action with `403 Forbidden` and error code `SELF_VERIFICATION_PROHIBITED`.
3. **Protected Document Retrieval**:
   - Unauthenticated request to document stream -> Expect `401 Unauthenticated`.
   - Regular user request to another user's document stream -> Expect `403 Forbidden`.
   - Authorized admin request -> Streams document with `Content-Type` matching MIME type and security headers.
   - Access event is recorded in audit logs.

### Category D: Negative Security Tests
1. **Status Tampering via User Endpoint**:
   - User sends `PATCH /api/users/me/professional` with `{ verificationStatus: 'VERIFIED' }`.
   - Endpoint must ignore or reject the field and keep status `UNVERIFIED` or `PENDING`.
2. **Forged State Jump**:
   - Admin attempts to transition a request directly from `UNVERIFIED` to `VERIFIED` without submission.
   - Endpoint must reject with `400 Bad Request` or `422 Unprocessable Entity`.
3. **Tampered Document Detection**:
   - File content altered after upload (checksum mismatch against `sha256Hash`).
   - Pipeline detects discrepancy and halts processing.

### Category E: Failure Handling & Edge Case Tests
1. **Malformed File Intake**:
   - Upload zero-byte file -> Expect `400 Bad Request`.
   - Upload 15MB file (exceeds 10MB limit) -> Expect `413 Payload Too Large`.
   - Upload `.exe` renamed as `.png` (magic bytes mismatch) -> Expect `400 Invalid File Type`.
2. **OCR Engine Unavailable / Timeout**:
   - OCR mock simulates network failure or timeout.
   - Pipeline gracefully records `{ ocrData: { status: 'FAILED' } }` without crashing the request.
   - Request remains queued for manual human inspection.
3. **Transaction Rollback on Audit Failure**:
   - Simulate database failure during audit log insertion.
   - Prisma transaction rolls back completely: request status and profile status remain unchanged.

---

## 4. Vitest Implementation Patterns (Reference)

```typescript
// Test Pattern Example for verification.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createTestUser, createTestAdmin } from './helpers.js';

describe('Verification Security & Workflow', () => {
  const app = createApp();

  it('strictly forbids administrators from approving their own verification', async () => {
    // 1. Arrange: Create an admin who also has a professional profile
    const { user: admin, session: adminSession } = await createTestAdmin();
    const req = await prisma.verificationRequest.create({
      data: {
        userId: admin.id,
        profileId: admin.professionalProfiles[0].id,
        status: 'PENDING_REVIEW',
        claimedTitle: 'Chief Neurologist',
        claimedSpecialty: 'Neurology',
      },
    });

    // 2. Act: Admin attempts to approve their own request
    const res = await supertest(app)
      .post(`/api/admin/verifications/${req.id}/decision`)
      .set('Cookie', `pbl4_sid=${adminSession.token}`)
      .set('X-CSRF-Token', adminSession.csrfToken)
      .send({ action: 'APPROVE', note: 'Self approval attempt' });

    // 3. Assert: Request rejected with 403
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELF_VERIFICATION_PROHIBITED');

    // Verify DB state remains unapproved
    const freshReq = await prisma.verificationRequest.findUnique({ where: { id: req.id } });
    expect(freshReq?.status).toBe('PENDING_REVIEW');
  });

  it('prevents regular users from accessing private verification evidence documents', async () => {
    const { session: normalUserSession } = await createTestUser();
    const fakeDocId = '00000000-0000-0000-0000-000000000001';

    const res = await supertest(app)
      .get(`/api/admin/verifications/req-123/documents/${fakeDocId}`)
      .set('Cookie', `pbl4_sid=${normalUserSession.token}`);

    expect(res.status).toBe(403);
  });
});
```

---

## 5. Step-by-Step Working Procedure for Verification Testing

1. **Step 1: Set Up Test Fixtures in `pbl4_web_test`**
   - Ensure clean database state using Prisma transactions or explicit cleanup hooks (`beforeEach`/`afterEach`).
   - Create distinct fixtures: Applicant User, Non-Admin User, Reviewer Admin, Self-Applicant Admin.

2. **Step 2: Write Schema & State Transition Unit Tests First (TDD)**
   - Test invalid state transitions directly against domain service functions.
   - Verify that all invalid state machine paths are blocked.

3. **Step 3: Implement Integration Workflow Tests**
   - Test complete HTTP lifecycle from submission to reviewer decision.
   - Verify that badge icons, status fields, and audit log entries reflect the final state.

4. **Step 4: Execute Security Negative Test Suite**
   - Test self-approval barrier.
   - Test document stream route access barriers.
   - Test CSRF and rate limiting barriers.

5. **Step 5: Execute Edge Case & Rollback Tests**
   - Verify transaction rollback on error.
   - Verify file upload constraints and OCR fallback handling.

---

## 6. Security and Reliability Constraints

- **Test Isolation**: Never run verification tests against the development database (`pbl4_web`). Always ensure `DATABASE_URL` is set to `TEST_DATABASE_URL` (`pbl4_web_test`).
- **No Mocking of Security Middleware**: In integration tests, never mock `requireAuth`, `requireAdmin`, or `csrfProtection`. Tests must exercise the real middleware chain.
- **Evidence Cleanup**: Any test files created in temporary test directories must be deleted in `afterAll` hooks to prevent disk clutter.

---

## 7. Expected Outputs

Engineering tasks applying this skill must produce:
1. **Comprehensive Test Suite**: Structured test files in `server/tests/` (e.g. `verification.test.ts`, `verification_auth.test.ts`).
2. **Coverage Evidence**: All state machine paths, authorization blocks, and failure modes covered by passing tests.
3. **Reproducible Test Fixtures**: Clean helper functions generating realistic clinical and academic verification payloads.

---

## 8. Completion Checklist

- [ ] Unit tests for state machine transitions implemented.
- [ ] Schema validation tests for clinician license vs. researcher ORCID.
- [ ] Happy path approval, supplemental info, and rejection workflows tested.
- [ ] Anti-self-approval rule verified with negative test (expecting 403).
- [ ] Protected document streaming verified with authorization negative tests.
- [ ] Status tampering via user endpoints verified to be blocked.
- [ ] Malformed document intake (size, MIME, magic bytes) tested.
- [ ] OCR timeout/failure handled gracefully without crashing request.
- [ ] Atomic rollback verified when audit log creation fails.
- [ ] All tests pass cleanly in isolated `pbl4_web_test` environment.
