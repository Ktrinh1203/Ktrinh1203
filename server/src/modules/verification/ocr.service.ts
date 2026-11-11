import type { CredentialDocumentType, ProfessionalType } from '@prisma/client';

export interface ExtractedCredentialFields {
  fullName?: string;
  licenseNumber?: string;
  issuingAuthority?: string;
  issueDate?: string;
  specialty?: string;
}

export interface ComparisonFlags {
  nameMatchScore: number;       // Token/character similarity (0.0 - 1.0)
  nameMismatchWarning: boolean; // Flagged if similarity < 0.75
  specialtyMatchWarning: boolean;
  licenseFormatValid: boolean;
  licenseDocumentMatch: boolean; // Whether license number was found in document
  dateInvalidWarning: boolean;
  lowLegibilityWarning: boolean;
  domainRelevanceWarning: boolean; // Flagged if document lacks medical/neuroscience keywords
}

export type SourceReliabilityTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'FLAGGED';

export interface EvidenceDossier {
  status: 'EXTRACTED' | 'MANUAL_REVIEW_REQUIRED' | 'FAILED';
  extractedFields: ExtractedCredentialFields;
  comparisonFlags: ComparisonFlags;
  sourceReliabilityTier: SourceReliabilityTier;
  ocrRawSnippet: string;
  disclaimer: string;
  processedAt: string;
}

const OCR_DISCLAIMER =
  'Trợ lý OCR chỉ hỗ trợ trích xuất và đối chiếu thông tin trên tài liệu. Độ tương khớp cao không đồng nghĩa chứng chỉ hợp pháp; Quản trị viên chịu trách nhiệm thẩm định cuối cùng (Human-in-the-Loop).';

/**
 * Normalizes Vietnamese text (NFC) and strips diacritics for fuzzy comparison.
 */
export function normalizeForComparison(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/^(bs\.?|pgs\.?|ts\.?|ths\.?|ckii|cki|gs\.?)\s+/gi, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes token similarity ( Sørensen–Dice / Jaccard token overlap ) between two strings.
 */
export function calculateNameSimilarity(claimedName: string, extractedName?: string): number {
  if (!extractedName || !claimedName) return 0;
  const aTokens = normalizeForComparison(claimedName).split(' ').filter(Boolean);
  const bTokens = normalizeForComparison(extractedName).split(' ').filter(Boolean);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;

  const bSet = new Set(bTokens);
  let matches = 0;
  for (const token of aTokens) {
    if (bSet.has(token)) matches++;
  }
  return Number(((2 * matches) / (aTokens.length + bTokens.length)).toFixed(2));
}

/**
 * Validates whether a license number or ORCID matches expected institutional patterns.
 */
export function validateLicenseOrOrcidFormat(
  value: string | undefined,
  profileType: ProfessionalType,
): boolean {
  if (!value || !value.trim()) return false;
  const trimmed = value.trim();
  if (profileType === 'HEALTHCARE_PROFESSIONAL') {
    // Vietnamese Medical Practice Certificate (CCHN) format e.g. 012345/BYT-CCHN or 004512/HNO-CCHN
    return /^[0-9]{4,8}\/[A-Z0-9_-]{2,15}$/i.test(trimmed);
  }
  // Researcher ORCID iD (e.g. 0000-0002-1825-0097) or DOI / Staff Code
  return /^(\d{4}-\d{4}-\d{4}-\d{3}[\dX]|10\.\d{4,9}\/[-._;()/:A-Z0-9]+|[A-Z0-9_-]{4,25})$/i.test(trimmed);
}

/**
 * Extracts readable text from a file buffer (such as PDF text blocks or embedded UTF-8 annotations)
 * and parses structured Vietnamese bureaucratic fields.
 */
export function extractRawTextFromBuffer(buffer: Buffer): string {
  try {
    // Scan buffer for printable UTF-8 segments (works for text-embedded PDFs & annotated test images)
    const raw = buffer.toString('utf8');
    // Look for explicit OCR_TEXT_BLOCK markers or readable Vietnamese/ASCII segments
    const markerMatch = raw.match(/OCR_TEXT_START([\s\S]*?)OCR_TEXT_END/);
    if (markerMatch && markerMatch[1]) {
      return markerMatch[1].normalize('NFC').trim();
    }

    // Extract PDF text literals inside parentheses or readable lines
    const printableLines = raw
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= 4 && /[a-zA-Z0-9\u00C0-\u1EF9]/.test(l) && !l.startsWith('%PDF'));

    return printableLines.slice(0, 40).join('\n').normalize('NFC');
  } catch {
    return '';
  }
}

/**
 * Parses Vietnamese credential fields from raw extracted text.
 */
export function parseCredentialEntities(rawText: string): ExtractedCredentialFields {
  const normalized = rawText.normalize('NFC');
  const fields: ExtractedCredentialFields = {};

  // 1. Full Name: "Họ và tên: Nguyễn Văn Minh" or "Name: ..."
  const nameMatch = normalized.match(/(?:Họ và tên|Ho va ten|Full Name|Cá nhân)[:\s]+([^\n\r,;]+)/i);
  if (nameMatch?.[1]) {
    fields.fullName = nameMatch[1].trim();
  }

  // 2. License / CCHN / ORCID Number
  const licenseMatch =
    normalized.match(/(?:Số CCHN|So CCHN|Số chứng chỉ|License No|ORCID)[:\s]+([A-Z0-9\/._-]{4,30})/i) ||
    normalized.match(/\b([0-9]{4,8}\/[A-Z]{2,6}-CCHN)\b/i) ||
    normalized.match(/\b(\d{4}-\d{4}-\d{4}-\d{3}[\dX])\b/i);
  if (licenseMatch?.[1]) {
    fields.licenseNumber = licenseMatch[1].trim();
  }

  // 3. Issuing Authority: Bộ Y Tế, Sở Y Tế, Viện, Trường Đại học...
  const authorityMatch = normalized.match(
    /(?:Cơ quan cấp|Đơn vị cấp|Nơi cấp|Issuing Authority|BỘ Y TẾ|SỞ Y TẾ[^\n\r]*|TRƯỜNG ĐẠI HỌC[^\n\r]*|VIỆN[^\n\r]*)(?:[:\s]+([^\n\r]+))?/i,
  );
  if (authorityMatch) {
    fields.issuingAuthority = (authorityMatch[1] || authorityMatch[0]).replace(/^(Cơ quan cấp|Đơn vị cấp|Nơi cấp)[:\s]*/i, '').trim();
  }

  // 4. Issue Date
  const dateMatch =
    normalized.match(/Ngày\s+([0-9]{1,2})\s+tháng\s+([0-9]{1,2})\s+năm\s+([0-9]{4})/i) ||
    normalized.match(/(?:Ngày cấp|Issue Date)[:\s]+([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i);
  if (dateMatch) {
    if (dateMatch[3]) {
      fields.issueDate = `${dateMatch[1]!.padStart(2, '0')}/${dateMatch[2]!.padStart(2, '0')}/${dateMatch[3]}`;
    } else if (dateMatch[1]) {
      fields.issueDate = dateMatch[1].trim();
    }
  }

  // 5. Specialty / Research Field
  const specMatch = normalized.match(/(?:Phạm vi hoạt động chuyên môn|Chuyên khoa|Lĩnh vực|Specialty)[:\s]+([^\n\r]+)/i);
  if (specMatch?.[1]) {
    fields.specialty = specMatch[1].trim();
  }

  return fields;
}

/**
 * Generates an EvidenceDossier for a verification document.
 * Fail-safe: Never throws; on unreadable input or timeout, returns MANUAL_REVIEW_REQUIRED.
 */
export function buildDocumentEvidenceDossier(params: {
  buffer: Buffer;
  documentType: CredentialDocumentType;
  profileType: ProfessionalType;
  claimedName: string;
  claimedSpecialty: string;
  claimedInstitution?: string | null;
  claimedLicenseOrOrcid?: string | null;
  simulateFailure?: boolean;
}): EvidenceDossier {
  try {
    if (params.simulateFailure) {
      throw new Error('Simulated OCR engine timeout');
    }

    const rawText = extractRawTextFromBuffer(params.buffer);
    const extractedFields = parseCredentialEntities(rawText);

    // Domain relevance heuristic: check if document mentions medical/clinical/academic/neuro terms
    // or if it contains non-domain contents (like microcontrollers, datasheets, hardware manuals)
    const normalizedRaw = normalizeForComparison(rawText);
    const domainKeywords = [
      'y te', 'kham chua benh', 'chung chi hanh nghe', 'bac si', 'benh vien', 'chuyen khoa',
      'y khoa', 'noi khoa', 'than kinh', 'ngoai khoa', 'duoc', 'dieu duong', 'cchn',
      'orcid', 'research', 'university', 'dai hoc', 'vien nghien cuu', 'hoc thuat',
      'giao su', 'tien si', 'thac si', 'khoa hoc', 'brain', 'neuro', 'eeg', 'bci'
    ];
    const irrelevanceKeywords = [
      'atmega', 'microcontroller', 'datasheet', 'avr', 'pinout', 'baud rate', 'eeprom',
      'schematic', 'voltage', 'operating voltage', 'instruction set'
    ];

    const hasDomainKeywords = domainKeywords.some((kw) => normalizedRaw.includes(kw));
    const hasIrrelevanceKeywords = irrelevanceKeywords.some((kw) => normalizedRaw.includes(kw));
    const domainRelevanceWarning = hasIrrelevanceKeywords || (normalizedRaw.length > 50 && !hasDomainKeywords);

    // If no structured fields were found in binary image scan, populate candidate comparison
    const hasExtractedEntities = Boolean(
      extractedFields.fullName || extractedFields.licenseNumber || extractedFields.specialty,
    );

    const licenseFormatValid = validateLicenseOrOrcidFormat(
      params.claimedLicenseOrOrcid || undefined,
      params.profileType,
    );

    // Check if the claimed license was actually found inside the extracted document text
    let licenseDocumentMatch = false;
    if (params.claimedLicenseOrOrcid) {
      const cleanClaimed = params.claimedLicenseOrOrcid.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
      const cleanDocText = normalizedRaw.replace(/[^a-z0-9]/g, '');
      if (cleanDocText.includes(cleanClaimed)) {
        licenseDocumentMatch = true;
      }
    }

    const nameMatchScore = hasExtractedEntities
      ? calculateNameSimilarity(params.claimedName, extractedFields.fullName)
      : 0;

    const nameMismatchWarning = hasExtractedEntities && Boolean(extractedFields.fullName) && nameMatchScore < 0.75;

    const specialtyMatchWarning =
      hasExtractedEntities &&
      Boolean(extractedFields.specialty) &&
      !normalizeForComparison(extractedFields.specialty!).includes(
        normalizeForComparison(params.claimedSpecialty).split(' ')[0] || '',
      );

    // Check if date is in the future
    let dateInvalidWarning = false;
    if (extractedFields.issueDate) {
      const parts = extractedFields.issueDate.split(/[\/\-]/);
      if (parts.length === 3) {
        const year = Number(parts[2]);
        if (year > new Date().getFullYear() || year < 1950) {
          dateInvalidWarning = true;
        }
      }
    }

    const lowLegibilityWarning = !hasExtractedEntities;

    // Determine Source Reliability Tier
    let sourceReliabilityTier: SourceReliabilityTier = 'TIER_2';
    if (nameMismatchWarning || dateInvalidWarning || domainRelevanceWarning) {
      sourceReliabilityTier = 'FLAGGED';
    } else if (
      params.documentType === 'ORCID_RECORD' ||
      (params.documentType === 'MEDICAL_LICENSE' && licenseFormatValid && licenseDocumentMatch && !lowLegibilityWarning)
    ) {
      sourceReliabilityTier = 'TIER_1';
    } else if (params.documentType === 'OTHER' || !hasExtractedEntities) {
      sourceReliabilityTier = 'TIER_3';
    }

    return {
      status: hasExtractedEntities && !domainRelevanceWarning ? 'EXTRACTED' : 'MANUAL_REVIEW_REQUIRED',
      extractedFields,
      comparisonFlags: {
        nameMatchScore,
        nameMismatchWarning,
        specialtyMatchWarning,
        licenseFormatValid,
        licenseDocumentMatch,
        dateInvalidWarning,
        lowLegibilityWarning,
        domainRelevanceWarning,
      },
      sourceReliabilityTier,
      ocrRawSnippet: hasExtractedEntities
        ? rawText.slice(0, 400)
        : rawText.length > 0
          ? rawText.slice(0, 400)
          : 'Tài liệu dạng ảnh quét (raster scan) — Yêu cầu Quản trị viên đối chiếu trực tiếp trên bản xem trước.',
      disclaimer: OCR_DISCLAIMER,
      processedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: 'FAILED',
      extractedFields: {},
      comparisonFlags: {
        nameMatchScore: 0,
        nameMismatchWarning: false,
        specialtyMatchWarning: false,
        licenseFormatValid: validateLicenseOrOrcidFormat(
          params.claimedLicenseOrOrcid ?? undefined,
          params.profileType,
        ),
        licenseDocumentMatch: false,
        dateInvalidWarning: false,
        lowLegibilityWarning: true,
        domainRelevanceWarning: false,
      },
      sourceReliabilityTier: 'TIER_3',
      ocrRawSnippet: 'Không thể bóc tách tự động văn bản (OCR fallback). Đã chuyển vào hàng đợi duyệt thủ công.',
      disclaimer: OCR_DISCLAIMER,
      processedAt: new Date().toISOString(),
    };
  }
}
