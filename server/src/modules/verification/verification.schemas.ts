import { z } from 'zod';

export const submitVerificationSchema = z
  .object({
    type: z.enum(['HEALTHCARE_PROFESSIONAL', 'RESEARCHER']),
    title: z.string().trim().min(2, 'Chức danh tối thiểu 2 ký tự').max(120),
    specialty: z.string().trim().min(2, 'Chuyên khoa / Lĩnh vực tối thiểu 2 ký tự').max(120),
    institution: z.string().trim().min(2, 'Đơn vị công tác / Viện nghiên cứu là bắt buộc').max(160),
    licenseOrOrcidNumber: z
      .string()
      .trim()
      .min(4, 'Số chứng chỉ hành nghề (CCHN) hoặc mã ORCID / Mã công tác là bắt buộc')
      .max(100),
    issuingAuthority: z
      .string()
      .trim()
      .max(160)
      .optional(),
    documentType: z
      .enum([
        'MEDICAL_LICENSE',
        'HOSPITAL_STAFF_CARD',
        'ACADEMIC_DEGREE',
        'INSTITUTION_AFFILIATION',
        'ORCID_RECORD',
        'OTHER',
      ])
      .default('MEDICAL_LICENSE'),
    submissionNotes: z.string().trim().max(1000).optional(),
    researchInterests: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          return val
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return val;
      }, z.array(z.string().trim().min(1).max(60)).max(15))
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'RESEARCHER') {
      // If researcher provides an ORCID-like string, validate ORCID structure or institutional code
      const val = data.licenseOrOrcidNumber.trim();
      if (val.length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['licenseOrOrcidNumber'],
          message: 'Nhà nghiên cứu cần cung cấp mã ORCID (vd: 0000-0002-1825-0097), DOI hoặc mã cán bộ nghiên cứu',
        });
      }
    }
  });

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;

export const reviewDecisionSchema = z
  .object({
    action: z.enum(['CLAIM', 'APPROVE', 'REJECT', 'REQUEST_INFO', 'REVOKE']),
    note: z.string().trim().max(1000).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const rationale = data.reason || data.note;
    if (
      (data.action === 'REJECT' || data.action === 'REQUEST_INFO' || data.action === 'REVOKE') &&
      (!rationale || rationale.trim().length < 3)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'Bắt buộc phải nhập lý do cụ thể (tối thiểu 3 ký tự) khi từ chối, thu hồi hoặc yêu cầu bổ sung hồ sơ',
      });
    }
  });

export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
