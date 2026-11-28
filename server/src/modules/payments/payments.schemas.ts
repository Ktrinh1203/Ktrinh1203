import { z } from 'zod';
import { env } from '../../config/env.js';

export const orderCodeParamSchema = z
  .string()
  .trim()
  .regex(/^NL[A-Za-z0-9]{8}$/i, 'Mã đơn nạp không hợp lệ');

export const createTopupOrderSchema = z
  .object({
    packageId: z.string().trim().min(1).max(40).optional(),
    amountVnd: z.coerce
      .number()
      .int()
      .min(10_000, 'Số tiền nạp tối thiểu là 10.000 VNĐ')
      .max(50_000_000, 'Số tiền nạp tối đa mỗi giao dịch là 50.000.000 VNĐ')
      .optional(),
  })
  .refine((data) => Boolean(data.packageId) || typeof data.amountVnd === 'number', {
    message: 'Vui lòng chọn gói nạp hoặc nhập số tiền VNĐ hợp lệ',
    path: ['packageId'],
  })
  .refine((data) => !(Boolean(data.packageId) && typeof data.amountVnd === 'number'), {
    message: 'Chỉ được chọn gói nạp (packageId) hoặc nhập số tiền (amountVnd), không gửi đồng thời cả hai',
    path: ['packageId'],
  })
  .refine(
    (data) => typeof data.amountVnd !== 'number' || data.amountVnd % env.VND_PER_CREDIT === 0,
    {
      message: `Số tiền nạp phải chia hết cho ${env.VND_PER_CREDIT.toLocaleString('vi-VN')} VNĐ để quy đổi tròn Credit`,
      path: ['amountVnd'],
    },
  );

export type CreateTopupOrderInput = z.infer<typeof createTopupOrderSchema>;

export const bankProfileSchema = z.object({
  bankBin: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/, 'Mã BIN ngân hàng không hợp lệ (6-8 chữ số)'),
  bankName: z.string().trim().min(2, 'Tên ngân hàng tối thiểu 2 ký tự').max(80),
  bankAccountNo: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{5,34}$/, 'Số tài khoản ngân hàng không hợp lệ'),
  bankAccountName: z
    .string()
    .trim()
    .min(2, 'Tên chủ tài khoản tối thiểu 2 ký tự')
    .max(120),
});

export type BankProfileInput = z.infer<typeof bankProfileSchema>;

export const transferCreditsSchema = z.object({
  recipientCodeOrUsername: z
    .string()
    .trim()
    .min(2, 'Vui lòng nhập username hoặc mã nhận tiền NL-...')
    .max(64),
  amountCredits: z.coerce
    .number()
    .int()
    .min(1, 'Số Credit chuyển tối thiểu là 1 Credit')
    .max(1_000_000, 'Số Credit chuyển vượt quá hạn mức mỗi giao dịch'),
  note: z.string().trim().max(240).optional(),
  idempotencyKey: z.string().trim().min(4).max(100).optional(),
});

export type TransferCreditsInput = z.infer<typeof transferCreditsSchema>;

export const createPayoutRequestSchema = z.object({
  amountCredits: z.coerce
    .number()
    .int()
    .min(50, 'Số Credit rút tối thiểu là 50 Credit')
    .max(1_000_000, 'Số Credit rút vượt quá hạn mức'),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z
    .string()
    .trim()
    .min(1, 'idempotencyKey không được để trống')
    .max(120, 'idempotencyKey tối đa 120 ký tự')
    .optional(),
  bankBin: z.string().trim().regex(/^\d{6,8}$/).optional(),
  bankName: z.string().trim().min(2).max(80).optional(),
  bankAccountNo: z.string().trim().regex(/^[A-Za-z0-9]{5,34}$/).optional(),
  bankAccountName: z.string().trim().min(2).max(120).optional(),
});

export type CreatePayoutRequestInput = z.infer<typeof createPayoutRequestSchema>;

export const reviewPayoutRequestSchema = z
  .object({
    decision: z.enum(['PAID', 'REJECTED']).optional(),
    action: z.enum(['PAID', 'REJECTED', 'APPROVE', 'REJECT']).optional(),
    bankRef: z.string().trim().max(120).optional(),
    adminNote: z.string().trim().max(500).optional(),
  })
  .refine((d) => Boolean(d.decision || d.action), {
    message: 'Vui lòng chọn quyết định PAID hoặc REJECTED',
    path: ['decision'],
  });

export type ReviewPayoutRequestInput = z.infer<typeof reviewPayoutRequestSchema>;
