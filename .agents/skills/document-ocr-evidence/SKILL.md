---
name: document-ocr-evidence
description: Use when designing or reviewing OCR-based document extraction, credential evidence comparison pipelines, source reliability assessment, and reviewer verification dossiers in NeuroLink.
---

# Document OCR and Evidence Assessment

## Overview

This skill establishes protocols for processing uploaded credential documents, extracting textual evidence via Optical Character Recognition (OCR), evaluating source reliability, and presenting side-by-side dossiers for human administrators in **NeuroLink** (`PBL4_Web`).

## Purpose & Activation Criteria

Activate this skill when:
- Designing or implementing document intake pipelines for medical practice licenses, diplomas, and research affiliations.
- Integrating or configuring text extraction (OCR engines, document parsers) in the Node.js/TypeScript backend.
- Structuring algorithms to compare extracted document text against user-declared profile data.
- Establishing source reliability hierarchies and manual reviewer checklists.
- Preventing automated credential forgery vulnerabilities.

---

## 1. Non-Negotiable Core Principles

### Rule 1: OCR is an Extraction Aid, NEVER an Authenticator
OCR extracts characters from an image or PDF. It **cannot verify authenticity, provenance, or legal validity**.
- A high OCR confidence score (e.g. 99.8%) merely means the image was legible; it does not mean the certificate is genuine.
- Any automated claim that a document is "verified" based solely on OCR or AI confidence is strictly prohibited.

### Rule 2: No Fabricated Verification APIs
- Never invent external verification APIs (e.g. fake "National Medical Registry API" or fictitious university endpoint).
- Do not assume government or institutional databases have public machine-readable APIs unless an official, tested integration is explicitly documented and authorized.
- When an external source cannot be queried automatically, classify the source as requiring manual verification by an administrator.

### Rule 3: Zero Auto-Approval
- The output of the OCR and evidence pipeline is strictly an **internal evidentiary dossier** prepared for human review.
- The pipeline MUST NOT transition a `VerificationRequest` to `VERIFIED`.

---

## 2. Evidence Assessment Hierarchy

Evidence must be categorized according to verifiable authority:

| Tier | Classification | Evidence Examples | Validation Method |
|---|---|---|---|
| **Tier 1** | **Primary Direct Evidence** | Verified institutional email domain (`@bachmai.gov.vn`, `@hust.edu.vn`), verifiable public ORCID API record, published DOI record in CrossRef/PubMed matching applicant name. | Direct cryptographic or official public registry cross-reference. |
| **Tier 2** | **Secondary Structured Evidence** | Medical Practice Certificate (CCHN), Hospital Staff Card, PhD/MD Degree Diploma, Board Certification. | OCR extraction + human administrator manual inspection of seals, serial numbers, issuing bodies. |
| **Tier 3** | **Supplemental Evidence** | Conference badge, appointment decision letter, recommendation letter, lab membership page. | Secondary reference for human reviewer; insufficient on its own for clinical verification. |
| **Flagged** | **Suspicious / Inconclusive** | Low-resolution image, mismatch between account name and certificate name, inconsistent fonts, altered dates, cropped borders. | Highlighted in reviewer dossier with mandatory manual escalation. |

---

## 3. End-to-End Extraction & Comparison Workflow

```
[Uploaded Document (PDF / Image)]
               │
               ▼
   1. Intake & Security Sanitization (MIME, Magic Bytes, SHA-256)
               │
               ▼
   2. Text & Layout Extraction (OCR Engine)
               │
               ▼
   3. Vietnamese Entity Parsing & Field Normalization
      - Full Legal Name
      - Certificate / License Serial Number
      - Issuing Authority (e.g., Sở Y Tế, Bộ Y Tế, Trường ĐH)
      - Issue Date / Expiration Date
      - Clinical Specialty or Research Field
               │
               ▼
   4. Cross-Field Evidence Comparison
      - Compare Extracted Name ⟷ User.displayName / Legal Name
      - Compare Claimed Specialty ⟷ Extracted Specialty
      - Check Date Sanity (Not in future; not expired)
               │
               ▼
   5. Generate Reviewer Dossier Payload (JSON for Admin UI)
      - Document Preview (Authenticated Stream)
      - Parsed Candidate Fields
      - Confidence Indicators & Discrepancy Warnings
```

---

## 4. Technical Implementation Guidelines

### Intake & Pre-processing
In the Node.js/Express backend (`server/src/`):
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- **Max File Size**: 10 MB per document (enforced via Multer middleware before disk writing).
- **Checksum Calculation**: Compute `crypto.createHash('sha256').update(buffer).digest('hex')` immediately. Store the hash in `VerificationDocument.sha256Hash` to guarantee tamper-evidence.
- **Magic Bytes Validation**: Inspect leading bytes to verify the actual file signature matches the claimed extension (reject polyglots or renamed executables).

### Text Extraction & Parsing Standards
- Normalize all extracted text using Unicode NFC (`text.normalize('NFC')`) to handle Vietnamese compound vs. precomposed diacritics correctly.
- Use resilient regular expressions for Vietnamese medical licenses:
  - Example CCHN format pattern: `/(?:Số|So)\s*(?:CCHN)?[:.]?\s*([0-9]{4,8}\/[A-Z0-9_-]+)/i`
- Extract date patterns across common Vietnamese bureaucratic formats:
  - `Ngày [0-9]{1,2} tháng [0-9]{1,2} năm [0-9]{4}`
  - `[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}`

### Discrepancy Flagging Logic
Calculate comparison flags to highlight for human reviewers:

```typescript
// Pattern for Reviewer Dossier Generation
interface EvidenceDossier {
  extractedFields: {
    fullName?: string;
    licenseNumber?: string;
    issuingAuthority?: string;
    issueDate?: string;
    specialty?: string;
  };
  comparisonFlags: {
    nameMatchScore: number;       // Levenshtein or token similarity (0.0 - 1.0)
    nameMismatchWarning: boolean; // Flagged if similarity < 0.85
    specialtyMatchWarning: boolean;
    dateInvalidWarning: boolean;
    lowLegibilityWarning: boolean;
  };
  sourceReliabilityTier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'FLAGGED';
  ocrRawSnippet: string;
}
```

---

## 5. Reviewer Dossier Display Requirements

When presenting extracted evidence in the Admin Dashboard (`client/src/pages/AdminPage.tsx` or verification component):

1. **Side-by-Side Presentation**:
   - Left side: High-resolution authenticated document viewer (PDF viewer or zoomable image canvas).
   - Right side: Side-by-side comparison table showing:
     - Field Name (e.g., Họ và tên, Số chứng chỉ, Chuyên khoa, Đơn vị cấp).
     - User Declared Value (what the user typed in their profile).
     - OCR Extracted Value (what the OCR extracted).
     - Verification Flag (Match, Mismatch, Inconclusive).
2. **Reviewer Decision Actions**:
   - `Approve`: Confirms credential authenticity, sets status to `VERIFIED`.
   - `Request More Information`: Prompts modal for specific missing details sent to user.
   - `Reject`: Requires mandatory rejection reason from controlled taxonomy (e.g., `UNVERIFIABLE_DOCUMENT`, `NAME_MISMATCH`, `EXPIRED_LICENSE`, `FRAUDULENT_DOCUMENT`, `OTHER`).

---

## 6. Security & Reliability Constraints

- **Untrusted Input Rule**: All OCR extracted text must be treated as completely untrusted user input. Sanitize and escape all strings before rendering in HTML to prevent Stored XSS in admin dashboards.
- **No Direct Shell Execution**: Never pass document filenames or extracted text to shell commands (e.g. avoid `exec("tesseract " + filename)`). Use safe native Node.js bindings or worker child processes with sanitized array arguments.
- **Fail-Safe Fallback**: If an OCR process fails, times out, or encounters an unreadable scan, the pipeline must log the failure gracefully, set `ocrData = { error: 'OCR_UNREADABLE' }`, and queue the document for manual visual review by the administrator.

---

## 7. Expected Outputs

Engineering tasks applying this skill must produce:
1. **Extraction Schema**: TypeScript interfaces and Zod validation schemas for OCR candidate fields.
2. **Comparison Logic**: Deterministic functions calculating match scores between user claims and extracted text.
3. **Reviewer Dossier Contract**: Clean API response format delivering document stream URLs and comparative evidence to the frontend.
4. **Error Handling Architecture**: Safe handling of unreadable files, corrupt PDFs, and OCR timeouts.

---

## 8. Completion Checklist

- [ ] Clear disclaimer that OCR is an extraction aid and cannot prove authenticity.
- [ ] Prohibition of automated verification approval enforced.
- [ ] No fabricated or unverified external verification APIs referenced.
- [ ] Multi-tier evidence reliability hierarchy established.
- [ ] Document intake security (MIME validation, SHA-256 tamper-evident hash) specified.
- [ ] Side-by-side human review dossier UI pattern defined.
- [ ] Vietnamese Unicode (NFC) normalization and bureaucratic date parsing addressed.
- [ ] Fail-safe fallback to manual inspection for low-quality or corrupt files guaranteed.
