---
name: verification-security-review
description: Use when auditing or implementing security controls, authorization boundaries, document access protections, audit logging, and anti-forgery mechanisms in the professional credential verification system.
---

# Verification Security Review

## Overview

This skill establishes mandatory security controls, authorization boundaries, document access protections, and audit logging standards for the professional credential verification system in **NeuroLink** (`PBL4_Web`). It guarantees that all uploaded credential documents and extracted texts are handled as untrusted data, preventing privilege escalation, unauthorized document access, and self-approval vulnerabilities.

## Purpose & Activation Criteria

Activate this skill when:
- Conducting security reviews or penetration-style threat assessments of verification endpoints.
- Designing or auditing Express authorization middleware (`requireAdmin`, session checkers, role guards).
- Implementing access controls for uploaded verification documents (preventing public URL exposure).
- Designing immutable audit logging for credential state changes.
- Verifying protection against OWASP Top 10 vulnerabilities within the verification module (Stored XSS, Broken Object Level Authorization, IDOR, SSRF).

---

## 1. Threat Model for Professional Verification

```
  [ Attacker / Malicious User ]
               │
      Threat 1 ├─► Tampering with Verification Status (IDOR / Broken Auth)
               │
      Threat 2 ├─► Self-Approval (Admin verifying their own profile)
               │
      Threat 3 ├─► Direct Document Access / PII Leakage (Public /uploads access)
               │
      Threat 4 ├─► Malicious File Uploads (Polyglots, SVG XSS, Executables)
               │
      Threat 5 ├─► Stored XSS via Untrusted OCR Text in Admin UI
               │
      Threat 6 ├─► Audit Log Deletion or State Corruption
```

### Threat Descriptions & Severity

| Threat Vector | Severity | Attack Scenario | Required Defense |
|---|---|---|---|
| **Self-Approval** | **CRITICAL** | A rogue or compromised Admin user submits clinical credentials and approves their own verification request. | Hardcoded server-side invariant: `request.userId !== adminId`. |
| **Document PII Leakage** | **HIGH** | Medical licenses contain full legal names, national ID numbers, and home addresses. Storing them in public `/uploads` allows unauthenticated web scraping. | Private directory storage + authenticated stream endpoint with admin authorization check. |
| **State Tampering** | **HIGH** | A regular user sends a `PATCH /api/users/me/professional` payload containing `verificationStatus: 'VERIFIED'`. | Strict Zod input stripping; status changes accepted only on dedicated admin endpoints. |
| **Malicious File Upload** | **HIGH** | Attacker uploads an SVG containing `<script>` or an executable disguised as `.png`. | Disallow SVGs; enforce whitelist (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`); magic byte validation. |
| **OCR Text Injection** | **MEDIUM** | Attacker crafts a fake certificate with malicious HTML payload (`<img src=x onerror=...>`). OCR extracts it and it renders raw in Admin dashboard. | Context-aware output encoding (React JSX auto-escaping; no `dangerouslySetInnerHTML`). |

---

## 2. Core Security Controls & Invariants

### 1. Server-Side Authorization Invariants
- **Applicant Invariant**: A user can only create, view, or update verification requests where `request.userId === authenticatedUser.id`.
- **Reviewer Invariant**: Only authenticated users with `role === Role.ADMIN` can list pending requests, claim reviews, or execute state transitions.
- **Anti-Self-Approval Invariant**: Under no circumstance may an administrator approve, reject, or alter the verification status of their own request:
  ```typescript
  if (verificationRequest.userId === adminUserId) {
    throw forbidden('Administrators cannot review or approve their own verification requests');
  }
  ```

### 2. Document Access Control & Private Storage
- **Public Uploads Boundary**: In NeuroLink, public post media is stored in `uploads/` and served via `express.static`. **Credential documents MUST NOT be saved in `uploads/`**.
- **Private Storage**: Store verification documents in an unexposed private directory, e.g., `server/storage/verification_docs/`.
- **Controlled Retrieval**: Documents must be accessible exclusively through a protected route:
  ```
  GET /api/admin/verifications/:requestId/documents/:docId
  ```
  This endpoint MUST:
  1. Verify active session and `req.auth.user.role === 'ADMIN'`.
  2. Verify that `docId` belongs to `requestId`.
  3. Log document view access to the audit trail.
  4. Stream the file using `res.sendFile()` with `Content-Disposition: inline` and strict security headers (`X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`).

### 3. Untrusted Input Handling (Files & OCR)
- **MIME & Extension Enforcement**: Whitelist strictly `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Prohibit SVG, HTML, executable formats.
- **Magic Bytes Verification**: Inspect file buffer headers before moving to private storage.
- **Sanitized Filenames**: Generate cryptographically random UUIDs for stored files (`crypto.randomUUID() + ext`). Never use original client-supplied filenames on disk.
- **Text Output Encoding**: Treat all extracted OCR strings as untrusted text. Never render extracted text using `innerHTML` or unescaped templates.

### 4. Immutable Audit Logging
- Every administrative action (Claim, Request Info, Approve, Reject, Revoke) must write an audit record to `VerificationAuditLog`.
- The audit record creation and the status update must occur atomically inside a Prisma transaction:
  ```typescript
  await prisma.$transaction(async (tx) => {
    // 1. Update verification state
    const updated = await tx.verificationRequest.update({ ... });
    // 2. Update profile badge status
    await tx.professionalProfile.update({ ... });
    // 3. Write immutable audit log
    await tx.verificationAuditLog.create({
      data: {
        requestId: request.id,
        actorId: adminId,
        previousState: previousStatus,
        newState: targetStatus,
        reason: input.reason || null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });
  });
  ```
- No API endpoint or service method shall be provided to update or delete `VerificationAuditLog` records.

---

## 3. Step-by-Step Security Review Procedure

When reviewing any verification code or PR:

1. **Step 1: Check Input Validation Schemas**
   - Verify that Zod schemas for user profile update (`server/src/modules/users/professional.schemas.ts`) strip or forbid `verificationStatus`, `verifiedAt`, and `verifiedById`.
   - Ensure rejection reasons are mandatory and validated against length limits.

2. **Step 2: Verify Authorization Middleware**
   - Confirm that all reviewer endpoints are protected by both `requireAuth` and `requireAdmin`.
   - Confirm that applicant endpoints check `req.auth.userId === targetUserId`.

3. **Step 3: Validate Anti-Self-Approval Defense**
   - Search the service methods for the anti-self-approval check.
   - Verify that tests exist asserting a `403 Forbidden` response when an admin attempts to verify their own profile.

4. **Step 4: Inspect Document Storage Paths**
   - Confirm that upload handlers write outside `env.UPLOAD_DIR`.
   - Verify that static file middleware (`express.static`) does not serve the verification document directory.

5. **Step 5: Audit Log Integrity Check**
   - Confirm that every state transition is encapsulated in a transaction with an audit log write.
   - Verify that log records capture `actorId`, `ipAddress`, and `timestamp`.

---

## 4. Security and Reliability Constraints

- **Rate Limiting**: Apply dedicated rate limiting (`authLimiter` or `writeLimiter` from `server/src/middleware/rateLimit.ts`) to verification submissions to prevent document storage exhaustion attacks.
- **CSRF Protection**: All state-changing endpoints (`POST`, `PATCH`, `DELETE`) must pass `csrfProtection` middleware with valid `X-CSRF-Token` headers.
- **Session Hijacking Defenses**: Retain `HttpOnly`, `SameSite=Lax`, and session rotation on privilege change.

---

## 5. Expected Outputs

Security tasks following this skill must produce:
1. **Threat Mitigation Matrix**: Evidence that all 6 threat vectors have active code-level defenses.
2. **Access Control Audit**: Proof of private document storage and authenticated streaming routes.
3. **Transaction Audit Report**: Verification that state updates and audit logs are atomic.
4. **Vulnerability Assessment Report**: Confirmation of no IDOR, Stored XSS, or Privilege Escalation risks.

---

## 6. Completion Checklist

- [ ] Anti-self-approval rule strictly enforced on all review actions.
- [ ] Credential documents isolated from public static file directories.
- [ ] Authenticated, audit-logged document streaming endpoint established.
- [ ] Client-provided input schemas strictly sanitize `verificationStatus`.
- [ ] Disallow executable and SVG uploads; enforce magic byte checking.
- [ ] Atomic Prisma transactions used for state changes + audit log creation.
- [ ] OCR extracted text rendered with context-aware escaping.
- [ ] Zero connection or references to external EEG database systems.
